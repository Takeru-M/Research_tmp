from sqlmodel import SQLModel
from typing import Optional
from datetime import datetime

class HighlightRectBase(SQLModel):
    highlight_id: int
    page_num: int
    x1: float
    y1: float
    x2: float
    y2: float
    element_type: Optional[str] = "unknown"

class HighlightRectCreate(HighlightRectBase):
    pass

class HighlightRectUpdate(SQLModel):
    page_num: Optional[int] = None
    x1: Optional[float] = None
    y1: Optional[float] = None
    x2: Optional[float] = None
    y2: Optional[float] = None
    element_type: Optional[str] = None

class HighlightRectRead(HighlightRectBase):
    id: int
    created_at: datetime
    updated_at: datetime
