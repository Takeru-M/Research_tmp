from datetime import datetime, timedelta
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from app.core.config import SECRET_KEY, ALGORITHM

# パスワードハッシュ化の設定 (Bcryptを推奨)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ----------------- パスワードユーティリティ -----------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# ----------------- JWTユーティリティ -----------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        # 認証処理を行うルーターで有効期限を設定するため、ここでは外部から渡されたexpires_deltaを使用
        expire = datetime.utcnow() + timedelta(minutes=30)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """JWTアクセストークンをデコードし、ペイロードを検証する"""
    try:
        # トークンの検証とデコード
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        # 署名が無効、期限切れなどのエラー
        return None