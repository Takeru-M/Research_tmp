from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from .highlight_rect import HighlightRectRead
from .comment import CommentRead

class HighlightBase(BaseModel):
    document_file_id: int
    created_by: str  # 'user' | 'ai'
    memo: Optional[str] = None
    text: Optional[str] = None

class HighlightCreate(HighlightBase):
    # LLM生成ハイライト用メタデータ
    suggestion_reason: Optional[str] = None

class HighlightUpdate(BaseModel):
    memo: Optional[str] = None
    text: Optional[str] = None

class HighlightRead(HighlightBase):
    id: int
    comment_id: Optional[int] = None
    document_file_id: int
    created_by: str
    memo: str
    text: Optional[str] = None
    created_at: datetime
    rects: List[HighlightRectRead]

    class Config:
        from_attributes = True

class HighlightDelete(BaseModel):
    """ハイライト削除時のレスポンス"""
    message: str
    deleted_highlight_id: int
    deleted_comments_count: int
    deleted_rects_count: int

class HighlightWithComments(BaseModel):
    highlight: HighlightRead
    comments: List[CommentRead]
    
    class Config:
        from_attributes = True
