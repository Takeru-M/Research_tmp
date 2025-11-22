# project_files.py
from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class ProjectFile(SQLModel, table=True):
    __tablename__ = "project_files"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="projects.id", nullable=False)
    file_name: str = Field(max_length=255, nullable=False)
    file_key: str = Field(max_length=500, nullable=False)  # S3 object key
    file_url: Optional[str] = Field(default=None, max_length=500)  # optional (public files only)
    mime_type: Optional[str] = Field(default=None, max_length=100)
    file_size: Optional[int] = Field(default=None)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False
    )

    # Relationship
    project: Optional["Project"] = Relationship(back_populates="project_file")
    highlights: List["Highlight"] = Relationship(back_populates="project_file")
