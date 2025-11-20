from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Annotated
import re


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

# サインアップ用の入力スキーマ
class UserSignupSchema(BaseModel):
    username: Annotated[str, Field(min_length=3, max_length=50)]
    email: EmailStr
    password: Annotated[str, Field(min_length=8, max_length=128)]
    confirm_password: Annotated[str, Field(min_length=8, max_length=128)]

class LoginRequest(BaseModel):
    email: EmailStr
    password: str