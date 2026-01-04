import os
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from sqlmodel import Session
from app.crud.user import create_user, authenticate_user_by_email
from app.core.security import create_access_token, create_refresh_token, get_password_hash
from app.schemas.auth import Token, UserSignupSchema, LoginRequest, SelectDocumentRequest
from app.api.deps import get_db, get_current_user
from app.models import User
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
    session: Session = Depends(get_db),
    response: Response = None
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
        access_token_expires = timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")))
        refresh_token_expires = timedelta(days=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")))
        
        access_token = create_access_token(
            data={
                "user_id": db_user.id,
                "name": db_user.name,
                "email": db_user.email,
            },
            expires_delta=access_token_expires
        )
        
        refresh_token = create_refresh_token(
            data={
                "user_id": db_user.id,
                "email": db_user.email,
            },
            expires_delta=refresh_token_expires
        )

        # リフレッシュトークンをHTTPOnly クッキーに設定
        if response:
            response.set_cookie(
                key="refresh_token",
                value=refresh_token,
                httponly=True,
                secure=os.getenv("ENV") == "production",
                samesite="lax",
                max_age=int(refresh_token_expires.total_seconds())
            )

        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            user_id=str(db_user.id),
            name=db_user.name,
            email=db_user.email,
            preferred_document_id=None
        )
    except Exception as e:
        logger.error(f"Error creating tokens: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="トークン生成中にエラーが発生しました"
        )

@router.post("/token", response_model=Token)
def login_for_access_token(
    login_req: LoginRequest,
    session: Session = Depends(get_db),
    response: Response = None
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

        access_token_expires = timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")))
        refresh_token_expires = timedelta(days=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")))
        
        access_token = create_access_token(
            data={
                "user_id": user.id,
                "name": user.name,
                "email": user.email
            },
            expires_delta=access_token_expires
        )
        
        refresh_token = create_refresh_token(
            data={
                "user_id": user.id,
                "email": user.email
            },
            expires_delta=refresh_token_expires
        )
        
        # リフレッシュトークンをHTTPOnly クッキーに設定
        if response:
            response.set_cookie(
                key="refresh_token",
                value=refresh_token,
                httponly=True,
                secure=os.getenv("ENV") == "production",
                samesite="lax",
                max_age=int(refresh_token_expires.total_seconds())
            )
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            user_id=str(user.id),
            name=user.name,
            email=user.email,
            preferred_document_id=None
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

@router.post("/refresh", response_model=Token)
def refresh_access_token(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
    response: Response = None
):
    """既存のJWTトークンを使って新しいトークンを発行"""
    try:
        logger.info(f"Refreshing token for user: {current_user.email} (ID: {current_user.id})")
        
        access_token_expires = timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")))
        refresh_token_expires = timedelta(days=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")))
        
        access_token = create_access_token(
            data={
                "user_id": current_user.id,
                "name": current_user.name,
                "email": current_user.email
            },
            expires_delta=access_token_expires
        )
        
        refresh_token = create_refresh_token(
            data={
                "user_id": current_user.id,
                "email": current_user.email
            },
            expires_delta=refresh_token_expires
        )
        
        # リフレッシュトークンをHTTPOnly クッキーに設定
        if response:
            response.set_cookie(
                key="refresh_token",
                value=refresh_token,
                httponly=True,
                secure=os.getenv("ENV") == "production",
                samesite="lax",
                max_age=int(refresh_token_expires.total_seconds())
            )
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            user_id=str(current_user.id),
            name=current_user.name,
            email=current_user.email
        )
    except Exception as e:
        logger.error(f"Error refreshing token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="トークンの更新中にエラーが発生しました"
        )

@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    response: Response = None,
    current_user = Depends(get_current_user)
):
    """ログアウト - リフレッシュトークンクッキーを削除"""
    try:
        logger.info(f"User {current_user.email} (ID: {current_user.id}) is logging out")
        
        if response:
            response.delete_cookie(
                key="refresh_token",
                httponly=True,
                secure=os.getenv("ENV") == "production",
                samesite="lax"
            )
        
        return {"message": "Successfully logged out"}
    except Exception as e:
        logger.error(f"Error during logout: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ログアウト処理中にエラーが発生しました"
        )


@router.post("/select-document", response_model=Token)
def select_document(
    select_req: SelectDocumentRequest,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    response: Response = None
):
    """ドキュメントを選択し、新しいトークンを生成（preferred_document_id を含む）"""
    from app.crud import document as crud_document
    
    logger.info(f"[POST /auth/select-document] User {current_user.id} selecting document {select_req.document_id}")
    
    try:
        # ドキュメントの所有権確認
        document = crud_document.get_document(session, select_req.document_id)
        if not document or document.user_id != current_user.id:
            logger.warning(f"[POST /auth/select-document] Unauthorized access to document {select_req.document_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="このドキュメントにアクセスする権限がありません"
            )
        
        # 新しいトークンを生成（preferred_document_id を含む）
        access_token_expires = timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")))
        
        access_token = create_access_token(
            data={
                "user_id": current_user.id,
                "name": current_user.name,
                "email": current_user.email,
                "preferred_document_id": select_req.document_id,
            },
            expires_delta=access_token_expires
        )
        
        # リフレッシュトークンは変更しない（既存のものをそのまま使用）
        logger.info(f"[POST /auth/select-document] New token generated with preferred_document_id={select_req.document_id}")
        
        return Token(
            access_token=access_token,
            refresh_token="",  # リフレッシュトークンは変更しない
            user_id=str(current_user.id),
            name=current_user.name,
            email=current_user.email,
            preferred_document_id=select_req.document_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[POST /auth/select-document] Error selecting document: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ドキュメント選択処理中にエラーが発生しました"
        )