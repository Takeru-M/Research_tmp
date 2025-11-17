from typing import List, Optional
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from .users import User

class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    name: str
    completion_stage: int = Field(default=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    user: Optional[User] = Relationship(back_populates="projects")
    files: List["ProjectFile"] = Relationship(back_populates="project")
