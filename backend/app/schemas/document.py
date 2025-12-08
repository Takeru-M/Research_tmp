from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class DocumentBase(BaseModel):
    document_name: str
    stage: int

class DocumentCreate(BaseModel):
    document_name: str
    user_id: Optional[int] = None
    stage: int

class DocumentUpdate(BaseModel):
    document_name: Optional[str] = None
    stage: Optional[int] = None

class DocumentRead(DocumentBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CompletionStageUpdate(BaseModel):
    completion_stage: int
