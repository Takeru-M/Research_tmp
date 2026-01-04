from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class CommentBase(BaseModel):
    text: str
    author: str
    purpose: Optional[int] = None
    completion_stage: Optional[int] = None

class CommentCreate(CommentBase):
    highlight_id: Optional[int] = None
    parent_id: Optional[int] = None
    # LLMコメント用メタデータ（オプション）
    suggestion_reason: Optional[str] = None

class CommentUpdate(BaseModel):
    text: str
    purpose: Optional[int] = None

class CommentRead(CommentBase):
    id: int
    highlight_id: Optional[int] = None
    parent_id: Optional[int] = None
    author: str
    text: str
    purpose: Optional[int] = None
    completion_stage: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CommentListResponse(BaseModel):
    comments: List[CommentRead]
    has_soft_deleted_llm: bool
