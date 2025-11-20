from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class Highlight(SQLModel, table=True):
    __tablename__ = "highlights"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_file_id: int = Field(foreign_key="project_files.id")
    created_by: str  # 'user' | 'ai'
    memo: Optional[str] = None
    text: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship
    project_file: Optional["ProjectFile"] = Relationship(back_populates="highlights")
    rects: List["HighlightRect"] = Relationship(back_populates="highlight")
    comments: List["Comment"] = Relationship(back_populates="highlight")
