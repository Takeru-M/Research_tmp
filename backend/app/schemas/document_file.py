from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class DocumentFileBase(BaseModel):
    document_id: int
    file_name: str
    file_key: str
    file_url: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None

class DocumentFileCreate(DocumentFileBase):
    pass

class DocumentFileUpdate(BaseModel):
    file_name: Optional[str] = None
    file_key: Optional[str] = None
    file_url: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None

class DocumentFileRead(DocumentFileBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
