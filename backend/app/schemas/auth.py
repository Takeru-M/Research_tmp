from pydantic import BaseModel
from typing import Optional

# ログイン後のユーザー情報のレスポンススキーマ
class User(BaseModel):
    id: str
    username: str
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

    class Config:
        orm_mode = True # SQLAlchemyなどのORMモデルを扱うための設定

# JWTトークンのレスポンススキーマ
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int # NextAuthのauthorize関数に渡すためにユーザーIDを追加

# JWTペイロード（トークン内に格納される情報）
class TokenData(BaseModel):
    username: Optional[str] = None
    # JWT ID (jti) など、必要に応じて追加