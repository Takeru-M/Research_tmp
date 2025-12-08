from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class Document(SQLModel, table=True):
    __tablename__ = "documents"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    document_name: str
    stage: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    # Relationship
    user: Optional["User"] = Relationship(back_populates="documents")
    document_file: Optional["DocumentFile"] = Relationship(back_populates="document")
