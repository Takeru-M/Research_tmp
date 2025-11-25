from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import String, Text

class Comment(SQLModel, table=True):
    __tablename__ = "comments"
    __table_args__ = {
        'mysql_charset': 'utf8mb4',
        'mysql_collate': 'utf8mb4_unicode_ci'
    }

    id: Optional[int] = Field(default=None, primary_key=True)
    highlight_id: Optional[int] = Field(foreign_key="highlights.id", default=None)
    parent_id: Optional[int] = Field(foreign_key="comments.id", default=None)
    author: str = Field(
        sa_column=Column(
            String(255, collation='utf8mb4_unicode_ci'),
            nullable=False
        )
    )
    text: str = Field(
        sa_column=Column(
            Text(collation='utf8mb4_unicode_ci'),
            nullable=False
        )
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    # Relationships
    highlight: Optional["Highlight"] = Relationship(back_populates="comments")

    # Self-referential relationship (parent <-> replies)
    parent: Optional["Comment"] = Relationship(
        back_populates="replies",
        sa_relationship_kwargs={
            "remote_side": lambda: [Comment.id]
        },
    )

    replies: List["Comment"] = Relationship(back_populates="parent")
