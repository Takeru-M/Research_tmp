from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import String, Text, ForeignKey

class Comment(SQLModel, table=True):
    __tablename__ = "comments"
    __table_args__ = {
        'mysql_charset': 'utf8mb4',
        'mysql_collate': 'utf8mb4_unicode_ci'
    }

    id: Optional[int] = Field(default=None, primary_key=True)

    # ハイライト削除時にコメントも消したい場合は CASCADE を付ける
    highlight_id: Optional[int] = Field(
        default=None,
        sa_column=Column(
            ForeignKey("highlights.id", ondelete="CASCADE"),
            nullable=True,
        )
    )

    # 親コメント削除時に子コメントも連鎖削除
    parent_id: Optional[int] = Field(
        default=None,
        sa_column=Column(
            ForeignKey("comments.id", ondelete="CASCADE"),
            nullable=True,
        )
    )

    author: str = Field(
        sa_column=Column(
            String(255, collation='utf8mb4_unicode_ci'),
            nullable=False
        )
    )
    text: str = Field(
        sa_column=Column(
            Text(collation='utf8mb4_unicode_ci'),
            nullable=False
        )
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    # Relationships
    highlight: Optional["Highlight"] = Relationship(back_populates="comments")

    parent: Optional["Comment"] = Relationship(
        back_populates="replies",
        sa_relationship_kwargs={
            "remote_side": lambda: [Comment.id],
            "passive_deletes": True,  # DBに連鎖削除を委ねる
        },
    )

    replies: List["Comment"] = Relationship(
        back_populates="parent",
        sa_relationship_kwargs={
            "passive_deletes": True,  # 子ロードなしでDB連鎖削除に任せる
        },
    )
