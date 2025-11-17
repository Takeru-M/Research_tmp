from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
from .highlights import Highlight

class HighlightRect(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    highlight_id: int = Field(foreign_key="highlight.id")
    page_num: int
    x1: float
    y1: float
    x2: float
    y2: float
    element_type: Optional[str] = None  # 'image' | 'shape' | 'unknown'

    highlight: Optional[Highlight] = Relationship(back_populates="rects")
