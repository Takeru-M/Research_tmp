from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel

class ProjectBase(SQLModel):
    name: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ProjectRead(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
