from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session
from app.db.session import SessionLocal
from app.core.security import decode_access_token
from app.crud.user import get_user_by_id, get_user_by_email
from app.schemas.auth import User
import logging

logger = logging.getLogger(__name__)

# ----------------------------------------------------
# データベースセッションを取得し、クローズする
# ----------------------------------------------------

def get_db():
    """リクエストごとに新しいDBセッションを提供し、処理後にクローズするジェネレータ"""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

# ----------------------------------------------------

# Bearerトークンを取得するためのセキュリティスキームを定義
# tokenUrlはトークンを発行するエンドポイントをFastAPIに教える
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

def get_current_user(
    session: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """JWTを検証し、認証済みユーザーを返す依存関数"""
    
    logger.info(f"Received token (first 20 chars): {token[:20]}...")
    
    # 1. トークン検証とデコード
    payload = decode_access_token(token)
    
    logger.info(f"Decoded payload: {payload}")
    
    if payload is None:
        logger.error("Token decode failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効な認証情報です",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # ペイロードからユーザー情報を取得
    # 'sub'フィールドまたは'user_id'フィールドからユーザーIDを取得
    user_id = payload.get("user_id")
    email = payload.get("email")
    
    logger.info(f"Extracted user_id: {user_id}, email: {email}")
    
    if not user_id and not email:
        logger.error("No user_id or email in token payload")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="トークンにユーザー情報が含まれていません",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # データベースからユーザーを取得
    if user_id:
        user = get_user_by_id(session, user_id)
        logger.info(f"User found by ID: {user}")
    else:
        user = get_user_by_email(session, email)
        logger.info(f"User found by email: {user}")
    
    if user is None:
        logger.error(f"User not found: user_id={user_id}, email={email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ユーザーが見つかりません",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.info(f"Authentication successful for user: {user.email}")
    return user