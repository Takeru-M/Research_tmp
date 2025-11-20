# auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from sqlmodel import Session
from app.crud import create_user, authenticate_user_by_email
from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES
from app.core.security import create_access_token, get_password_hash
from app.crud import authenticate_user
from app.schemas import Token, UserSignupSchema, LoginRequest
from app.api.deps import get_db
from app.utils.validators import validate_email, validate_username, validate_password, validate_confirm_password

import logging # 💡 ロギングモジュールをインポート
logger = logging.getLogger(__name__) # 💡 このモジュール専用のロガーを作成

router = APIRouter()

@router.get("/test")
def test_auth_route():
    return {"message": "Auth route is working"}

@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(
    user_in: UserSignupSchema,
    session: Session = Depends(get_db)
):
    """新規ユーザー作成 + JWT発行"""
    validate_email(user_in.email)
    validate_username(user_in.username)
    validate_password(user_in.password)
    validate_confirm_password(user_in.password, user_in.confirm_password)

    db_user = create_user(session=session, user_in=user_in)
    logger.info(f"User {db_user.email} created successfully with ID {db_user.id}")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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

@router.post("/token", response_model=Token)
def login_for_access_token(
    login_req: LoginRequest,
    session: Session = Depends(get_db)
):
    """メールアドレス + パスワードでJWTを発行"""
    logger.info(f"Attempting to log in user: {login_req.email}")

    user = authenticate_user_by_email(session, login_req.email, login_req.password)
    if not user:
        logger.warning(f"Authentication failed for user: {login_req.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.info(f"User {user.name} (ID: {user.id}) successfully authenticated.")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "user_id": user.id,
            "name": user.name,
            "email": user.email
        },
        expires_delta=access_token_expires
    )
    
    # 💡 NextAuth でそのままセッションに入れるようにユーザー情報も返す
    return Token(
        access_token=access_token,
        user_id=str(user.id),
        name=user.name,
        email=user.email
    )