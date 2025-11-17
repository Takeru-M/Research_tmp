from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel

class ProjectFileBase(SQLModel):
    project_id: int
    filename: str
    file_type: str
    content: Optional[str] = None  # Blob URLやテキスト

class ProjectFileCreate(ProjectFileBase):
    pass

class ProjectFileUpdate(SQLModel):
    filename: Optional[str] = None
    file_type: Optional[str] = None
    content: Optional[str] = None

class ProjectFileRead(ProjectFileBase):
    id: int
    created_at: datetime
    updated_at: datetime
