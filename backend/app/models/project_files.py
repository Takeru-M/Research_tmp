# project_files.py
from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class ProjectFile(SQLModel, table=True):
    __tablename__ = "project_files"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: Optional[int] = Field(foreign_key="projects.id")
    # S3 対応
    file_name: str                         # ユーザーがアップロードした元ファイル名
    s3_key: str                           # S3 オブジェクトキー
    s3_bucket: Optional[str] = None       # バケット名（単一なら不要だが念のため）
    file_type: str                        # MIME or カテゴリ
    file_size: Optional[int] = None       # バイトサイズ（任意）
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship
    project: Optional["Project"] = Relationship(back_populates="project_file")
    highlights: List["Highlight"] = Relationship(back_populates="project_file")
