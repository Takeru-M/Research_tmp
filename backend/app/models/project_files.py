from typing import List, Optional
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from .projects import Project

class ProjectFile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    file_path: str
    file_type: str  # 'pdf' | 'text'
    text_content: Optional[str] = None
    divided_text: Optional[str] = None  # JSON文字列
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

    project: Optional[Project] = Relationship(back_populates="files")
    highlights: List["Highlight"] = Relationship(back_populates="project_file")
    comments: List["Comment"] = Relationship(back_populates="project_file")
