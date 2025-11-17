from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel
from app.schemas.highlight_rect import HighlightRectRead

class HighlightBase(SQLModel):
    project_file_id: int
    created_by: str
    text: str
    memo: Optional[str] = None
    type: str = "pdf"  # デフォルトはPDF

class HighlightCreate(HighlightBase):
    rects: Optional[List[int]] = None  # highlight_rect のIDリスト

class HighlightUpdate(SQLModel):
    text: Optional[str] = None
    memo: Optional[str] = None
    type: Optional[str] = None

class HighlightRead(HighlightBase):
    id: int
    created_at: datetime
    updated_at: datetime
    rects: Optional[List[HighlightRectRead]] = None
