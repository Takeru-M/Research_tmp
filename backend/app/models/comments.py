from typing import List, Optional
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from .project_files import ProjectFile
from .highlights import Highlight

class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_file_id: int = Field(foreign_key="projectfile.id")
    highlight_id: Optional[int] = Field(foreign_key="highlight.id", default=None)
    parent_id: Optional[int] = Field(foreign_key="comment.id", default=None)
    author: str  # 'user' | 'ai'
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    edited_at: Optional[datetime] = None
    deleted: bool = Field(default=False)

    project_file: Optional[ProjectFile] = Relationship(back_populates="comments")
    highlight: Optional[Highlight] = Relationship(back_populates="comments")
    parent: Optional["Comment"] = Relationship(back_populates="replies", sa_relationship_kwargs={"remote_side": "Comment.id"})
    replies: List["Comment"] = Relationship(back_populates="parent")
