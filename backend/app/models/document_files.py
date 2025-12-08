# document_files.py
from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class DocumentFile(SQLModel, table=True):
    __tablename__ = "document_files"

    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="documents.id", nullable=False)
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
    document: Optional["Document"] = Relationship(back_populates="document_file")
    highlights: List["Highlight"] = Relationship(back_populates="document_file")
