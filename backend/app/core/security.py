from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
import os
import logging

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))  # デフォルト60分
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))  # デフォルト7日

# パスワードハッシュ化の設定 (Bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ===== パスワードユーティリティ =====

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# ===== JWTユーティリティ =====

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    logger.info(f"Created token with payload: {to_encode}")
    logger.info(f"Token expires at: {expire}")
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    """リフレッシュトークンを生成"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    logger.info(f"Created refresh token with payload: {to_encode}")
    logger.info(f"Refresh token expires at: {expire}")
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        logger.info(f"Decoding token with SECRET_KEY: {SECRET_KEY[:10]}...")
        # options で exp チェックを無効化して、トークンの内容を確認
        payload_no_verify = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
        logger.info(f"Token payload (no verify): {payload_no_verify}")
        
        if "exp" in payload_no_verify:
            exp_timestamp = payload_no_verify["exp"]
            exp_datetime = datetime.fromtimestamp(exp_timestamp)
            now = datetime.utcnow()
            logger.info(f"Token expiration: {exp_datetime}, Current time: {now}")
            
            if exp_datetime < now:
                logger.error(f"Token has expired. Expired at: {exp_datetime}, Current: {now}")
                return None
        
        # 正常にデコード
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        logger.info(f"Successfully decoded payload: {payload}")
        return payload
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        return None

def decode_refresh_token(token: str) -> Optional[dict]:
    """リフレッシュトークンをデコード"""
    try:
        logger.info("Decoding refresh token...")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # トークンタイプをチェック
        if payload.get("type") != "refresh":
            logger.error("Token type is not 'refresh'")
            return None
        
        logger.info(f"Successfully decoded refresh token payload: {payload}")
        return payload
    except JWTError as e:
        logger.error(f"JWT decode error for refresh token: {e}")
        return None

# OAuth2 のトークンスキーム
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")
