# auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from sqlmodel import Session
from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES
from app.core.security import create_access_token
from app.crud import authenticate_user
from app.schemas import Token
from app.api.deps import get_db

import logging # 💡 ロギングモジュールをインポート
logger = logging.getLogger(__name__) # 💡 このモジュール専用のロガーを作成

router = APIRouter()

@router.get("/test")
def test_auth_route():
    return {"message": "Auth route is working"}

@router.post("/token", response_model=Token)
def login_for_access_token(
    session: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """
    JWT Access Tokenを発行するためのログインエンドポイント。
    """
    
    # 💡 sessionがジェネレータでないか確認するログを追加
    logger.info(f"Type of session passed: {type(session)}") # ログを追加
    
    # 💡 処理開始のログ
    logger.info(f"Attempting to log in user: {form_data.username}")

    try:
        # 認証処理の呼び出し
        user = authenticate_user(session, form_data.username, form_data.password)
    except Exception as e:
        # 💡 authenticate_user内で予期せぬエラーが発生した場合のログ
        logger.error(f"Error during authentication for user {form_data.username}: {e}", exc_info=True)
        # 認証失敗として扱う
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="認証処理中に内部エラーが発生しました",
        )
    
    if not user:
        # 💡 認証失敗のログ
        logger.warning(f"Authentication failed for user: {form_data.username} (Invalid credentials)")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ユーザー名またはパスワードが正しくありません",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 💡 認証成功のログ
    logger.info(f"User {user.name} (ID: {user.id}) successfully authenticated.")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.name},
        expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, user_id=user.id)