from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel

# APIでユーザー作成時に受け取るスキーマ (パスワードは平文で受け取る)
class UserCreate(SQLModel):
    id: int
    name: str
    email: str
    # hashed_passwordの代わりにpasswordを使用
    password: str
    created_at: datetime
    updated_at: datetime

# APIからユーザー情報を返すスキーマ (パスワードハッシュは含めない)
class UserRead(SQLModel):
    id: int
    name: str
    email: str
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

# APIでユーザー更新時に受け取るスキーマ
class UserUpdate(SQLModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None