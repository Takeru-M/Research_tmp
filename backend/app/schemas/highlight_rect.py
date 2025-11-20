from sqlmodel import SQLModel
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class HighlightRectBase(BaseModel):
    highlight_id: int
    page_num: int
    x1: float
    y1: float
    x2: float
    y2: float
    element_type: Optional[str] = None  # 'image' | 'shape' | 'unknown'

class HighlightRectCreate(HighlightRectBase):
    pass

class HighlightRectUpdate(BaseModel):
    page_num: Optional[int] = None
    x1: Optional[float] = None
    y1: Optional[float] = None
    x2: Optional[float] = None
    y2: Optional[float] = None
    element_type: Optional[str] = None

class HighlightRectRead(HighlightRectBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
