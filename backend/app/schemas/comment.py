from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class CommentBase(BaseModel):
    project_file_id: int
    highlight_id: Optional[int] = None
    parent_id: Optional[int] = None
    author: str  # 'user' | 'ai'
    text: str

class CommentCreate(CommentBase):
    pass

class CommentUpdate(BaseModel):
    text: Optional[str] = None

class CommentRead(CommentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted: Optional[bool] = False

    class Config:
        from_attributes = True
