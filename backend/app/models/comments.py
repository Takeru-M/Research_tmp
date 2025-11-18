from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class Comment(SQLModel, table=True):
    __tablename__ = "comments"

    id: Optional[int] = Field(default=None, primary_key=True)

    project_file_id: int = Field(foreign_key="project_files.id")
    highlight_id: Optional[int] = Field(foreign_key="highlights.id", default=None)
    parent_id: Optional[int] = Field(foreign_key="comments.id", default=None)

    author: str  # 'user' | 'ai'
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    edited_at: Optional[datetime] = None
    deleted: bool = Field(default=False)

    # Relationships
    project_file: Optional["ProjectFile"] = Relationship(back_populates="comments")
    highlight: Optional["Highlight"] = Relationship(back_populates="comments")

    # Self-referential relationship (parent <-> replies)
    parent: Optional["Comment"] = Relationship(
        back_populates="replies",
        sa_relationship_kwargs={
            "remote_side": lambda: [Comment.id]  # ← これが正しい
        },
    )

    replies: List["Comment"] = Relationship(back_populates="parent")
