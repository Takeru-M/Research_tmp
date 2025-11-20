from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class ProjectFileBase(BaseModel):
    project_id: int
    file_name: str
    s3_key: str
    s3_bucket: Optional[str] = None
    file_type: str
    file_size: Optional[int] = None

class ProjectFileCreate(ProjectFileBase):
    pass

class ProjectFileUpdate(BaseModel):
    file_name: Optional[str] = None
    s3_key: Optional[str] = None
    s3_bucket: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None

class ProjectFileRead(ProjectFileBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
