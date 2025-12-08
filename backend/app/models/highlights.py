from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import String, Text

class Highlight(SQLModel, table=True):
    __tablename__ = "highlights"
    __table_args__ = {
        'mysql_charset': 'utf8mb4',
        'mysql_collate': 'utf8mb4_unicode_ci'
    }

    id: Optional[int] = Field(default=None, primary_key=True)
    document_file_id: int = Field(foreign_key="document_files.id")
    created_by: str = Field(
        sa_column=Column(
            String(255, collation='utf8mb4_unicode_ci'),
            nullable=False
        )
    )
    memo: Optional[str] = Field(
        default=None,
        sa_column=Column(
            Text(collation='utf8mb4_unicode_ci'),
            nullable=True
        )
    )
    text: Optional[str] = Field(
        default=None,
        sa_column=Column(
            Text(collation='utf8mb4_unicode_ci'),
            nullable=True
        )
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship
    document_file: Optional["DocumentFile"] = Relationship(back_populates="highlights")
    rects: List["HighlightRect"] = Relationship(back_populates="highlight")
    comments: List["Comment"] = Relationship(back_populates="highlight")
