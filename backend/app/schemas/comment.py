from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel

class CommentBase(SQLModel):
    project_file_id: int
    highlight_id: Optional[int] = None
    parent_id: Optional[int] = None
    author: str
    text: str

class CommentCreate(CommentBase):
    pass

class CommentUpdate(SQLModel):
    text: Optional[str] = None

class CommentRead(CommentBase):
    id: int
    created_at: datetime
    edited_at: Optional[datetime] = None
    deleted: Optional[bool] = False
