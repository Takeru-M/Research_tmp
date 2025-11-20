from typing import Optional
from datetime import datetime
from pydantic import BaseModel

# ユーザー新規作成時のスキーマ（id, created_at, updated_atは不要）
class UserCreate(BaseModel):
    name: str
    email: str
    password: str  # 平文で受け取る

# ユーザー情報返却用スキーマ（パスワードは含めない）
class UserRead(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # Pydantic v2対応

# ユーザー更新時のスキーマ
class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None