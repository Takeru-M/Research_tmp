from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship


class ProjectFile(SQLModel, table=True):
    __tablename__ = "project_files"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="projects.id")

    filename: str
    file_type: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship
    project: Optional["Project"] = Relationship(back_populates="project_files")
    highlights: List["Highlight"] = Relationship(back_populates="project_file")
    comments: List["Comment"] = Relationship(back_populates="project_file")
