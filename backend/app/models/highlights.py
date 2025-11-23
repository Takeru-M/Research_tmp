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
    project_file_id: int = Field(foreign_key="project_files.id")
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
    project_file: Optional["ProjectFile"] = Relationship(back_populates="highlights")
    rects: List["HighlightRect"] = Relationship(back_populates="highlight")
    comments: List["Comment"] = Relationship(back_populates="highlight")
