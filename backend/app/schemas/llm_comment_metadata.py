from typing import Optional
from pydantic import BaseModel


class LLMCommentMetadataCreate(BaseModel):
    """LLMコメントメタデータ作成時のスキーマ"""
    suggestion_reason: Optional[str] = None
    deletion_reason: Optional[str] = None


class LLMCommentMetadataRead(BaseModel):
    """LLMコメントメタデータ読み取り時のスキーマ"""
    id: int
    comment_id: int
    suggestion_reason: Optional[str] = None
    deletion_reason: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


class LLMCommentMetadataUpdate(BaseModel):
    """LLMコメントメタデータ更新時のスキーマ"""
    suggestion_reason: Optional[str] = None
    deletion_reason: Optional[str] = None
