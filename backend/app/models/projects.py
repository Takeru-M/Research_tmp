from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship
    # user: Optional["User"] = Relationship(back_populates="projects")
    project_files: List["ProjectFile"] = Relationship(back_populates="project")
