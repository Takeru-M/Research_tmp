from typing import List, Optional
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from .project_files import ProjectFile

class Highlight(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_file_id: int = Field(foreign_key="projectfile.id")
    created_by: str  # 'user' | 'ai'
    memo: Optional[str] = None
    text: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    project_file: Optional[ProjectFile] = Relationship(back_populates="highlights")
    rects: List["HighlightRect"] = Relationship(back_populates="highlight")
    comments: List["Comment"] = Relationship(back_populates="highlight")
