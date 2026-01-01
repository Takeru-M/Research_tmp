from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, Column, JSON

class DocumentFormattedText(SQLModel, table=True):
    __tablename__ = "document_formatted_texts"

    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="documents.id", index=True)
    formatted_data: dict = Field(sa_column=Column(JSON), description="フォーマット済みテキストデータ（JSON形式）")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    # Relationship
    document: Optional["Document"] = Relationship(back_populates="formatted_text")
