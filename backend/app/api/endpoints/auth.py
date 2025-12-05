import os
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from sqlmodel import Session
from app.crud.user import create_user, authenticate_user_by_email
from app.core.security import create_access_token, get_password_hash
from app.schemas.auth import Token, UserSignupSchema, LoginRequest
from app.api.deps import get_db
from app.utils.validators import (
    validate_email, 
    validate_username, 
    validate_password, 
    validate_confirm_password,
    ValidationError
)

import logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(
    user_in: UserSignupSchema,
    session: Session = Depends(get_db)
):
    """新規ユーザー作成 + JWT発行"""
    try:
        # バリデーション実行
        validate_email(user_in.email)
        validate_username(user_in.username)
        validate_password(user_in.password)
        validate_confirm_password(user_in.password, user_in.confirm_password)
    except ValidationError as e:
        logger.warning(f"Validation error during signup: {e.message}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    except Exception as e:
        logger.error(f"Unexpected validation error during signup: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="入力内容に誤りがあります"
        )

    try:
        db_user = create_user(session=session, user_in=user_in)
        logger.info(f"User {db_user.email} created successfully with ID {db_user.id}")
    except HTTPException as e:
        # create_user内でHTTPExceptionが発生した場合はそのまま再送出
        logger.warning(f"User creation failed: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during user creation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ユーザー登録中にエラーが発生しました"
        )

    try:
        access_token_expires = timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")))
        access_token = create_access_token(
            data={
                "user_id": db_user.id,
                "name": db_user.name,
                "email": db_user.email,
            },
            expires_delta=access_token_expires
        )

        return Token(
            access_token=access_token,
            user_id=str(db_user.id),
            name=db_user.name,
            email=db_user.email
        )
    except Exception as e:
        logger.error(f"Error creating access token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="トークン生成中にエラーが発生しました"
        )

@router.post("/token", response_model=Token)
def login_for_access_token(
    login_req: LoginRequest,
    session: Session = Depends(get_db)
):
    """メールアドレス + パスワードでJWTを発行"""
    logger.info(f"Attempting to log in user: {login_req.email}")

    # 入力バリデーション
    if not login_req.email or not login_req.email.strip():
        logger.warning("Login attempt with empty email")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="メールアドレスを入力してください"
        )
    
    if not login_req.password or not login_req.password.strip():
        logger.warning(f"Login attempt with empty password for email: {login_req.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="パスワードを入力してください"
        )

    try:
        user = authenticate_user_by_email(session, login_req.email, login_req.password)
        
        if not user:
            logger.warning(f"Authentication failed for user: {login_req.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="メールアドレスまたはパスワードが正しくありません",
                headers={"WWW-Authenticate": "Bearer"},
            )

        logger.info(f"User {user.name} (ID: {user.id}) successfully authenticated.")

        access_token_expires = timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")))
        access_token = create_access_token(
            data={
                "user_id": user.id,
                "name": user.name,
                "email": user.email
            },
            expires_delta=access_token_expires
        )
        
        return Token(
            access_token=access_token,
            user_id=str(user.id),
            name=user.name,
            email=user.email
        )
    except HTTPException:
        # 既に定義されたHTTPExceptionはそのまま再送出
        raise
    except Exception as e:
        logger.error(f"Unexpected error during login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ログイン処理中にエラーが発生しました"
        )