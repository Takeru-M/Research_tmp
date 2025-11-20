from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class ProjectBase(BaseModel):
    project_name: str
    stage: int

class ProjectCreate(BaseModel):
    project_name: str
    user_id: Optional[int] = None
    stage: int

class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    stage: Optional[int] = None

class ProjectRead(ProjectBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
