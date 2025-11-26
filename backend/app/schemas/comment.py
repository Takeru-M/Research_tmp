from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class CommentBase(BaseModel):
    text: str
    author: str

class CommentCreate(CommentBase):
    highlight_id: Optional[int] = None
    parent_id: Optional[int] = None

class CommentUpdate(BaseModel):
    text: str

class CommentRead(CommentBase):
    id: int
    highlight_id: Optional[int] = None
    parent_id: Optional[int] = None
    author: str
    text: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
