from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from .highlight_rect import HighlightRectRead

class HighlightBase(BaseModel):
    project_file_id: int
    created_by: str  # 'user' | 'ai'
    memo: Optional[str] = None
    text: Optional[str] = None

class HighlightCreate(HighlightBase):
    pass

class HighlightUpdate(BaseModel):
    memo: Optional[str] = None
    text: Optional[str] = None

class HighlightRead(HighlightBase):
    id: int
    created_at: datetime
    rects: Optional[List[HighlightRectRead]] = None

    class Config:
        from_attributes = True

class HighlightDelete(BaseModel):
    """ハイライト削除時のレスポンス"""
    message: str
    deleted_highlight_id: int
    deleted_comments_count: int
    deleted_rects_count: int
