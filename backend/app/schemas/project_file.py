from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class ProjectFileBase(BaseModel):
    project_id: int
    file_name: str
    file_key: str
    file_url: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None

class ProjectFileCreate(ProjectFileBase):
    pass

class ProjectFileUpdate(BaseModel):
    file_name: Optional[str] = None
    file_key: Optional[str] = None
    file_url: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None

class ProjectFileRead(ProjectFileBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
