from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session
# データベースセッションを定義したファイルからSessionLocalをインポートすることを想定
from app.db.session import SessionLocal
from app.core.security import decode_access_token
from app.crud import get_user_by_username
from app.schemas import User
from app.schemas import TokenData

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
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

def get_current_user(
    session: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """JWTを検証し、認証済みユーザーを返す依存関数"""
    
    # 1. トークン検証とデコード
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効な認証情報です",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # ペイロードからユーザー名を取得 (JWT生成時に "sub" に設定した値)
    username: str = payload.get("sub")
    
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効な認証情報です",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    token_data = TokenData(username=username) # TokenDataの利用は冗長なので削除可だが、残す
    
    # 2. ユーザー情報の取得
    user = get_user_by_username(session, token_data.username)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効な認証情報です",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user