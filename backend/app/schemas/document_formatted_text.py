from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class FormattedTextItem(BaseModel):
    """フォーマット済みテキストの各要素"""
    id: int = Field(description="テキスト要素のID")
    text: str = Field(description="テキスト内容")

class DocumentFormattedTextBase(BaseModel):
    """DocumentFormattedTextの基本スキーマ"""
    formatted_data: Dict[str, Any] = Field(description="フォーマット済みテキストデータ")

class DocumentFormattedTextCreate(BaseModel):
    """DocumentFormattedText作成用スキーマ"""
    document_id: int = Field(description="ドキュメントID")
    formatted_data: Dict[str, Any] = Field(description="フォーマット済みテキストデータ")

class DocumentFormattedTextUpdate(BaseModel):
    """DocumentFormattedText更新用スキーマ"""
    formatted_data: Optional[Dict[str, Any]] = Field(default=None, description="フォーマット済みテキストデータ")

class DocumentFormattedTextRead(BaseModel):
    """DocumentFormattedText読み取り用スキーマ"""
    id: int
    document_id: int
    formatted_data: Dict[str, Any]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
