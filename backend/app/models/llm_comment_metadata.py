from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import Text, ForeignKey

class LLMCommentMetadata(SQLModel, table=True):
    """
    LLMコメントのメタデータ専用テーブル
    - author='LLM'のコメントとのみ1対1でリレーション
    - 示唆の理由、削除理由などLLM固有の情報を管理
    """
    __tablename__ = "llm_comment_metadata"

    id: Optional[int] = Field(default=None, primary_key=True)

    # 1対1リレーション（LLMコメントのみが対象）
    comment_id: int = Field(
        sa_column=Column(
            ForeignKey("comments.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,  # 1対1を保証
        )
    )

    # LLMが示唆を出した理由（ルートコメント作成時に設定）
    # 例: "ユーザーの質問から関連性が高い内容を抽出しました"
    suggestion_reason: Optional[str] = Field(
        default=None,
        sa_column=Column(Text(), nullable=True)
    )

    # LLMコメント削除時の理由（ソフトデリート時に設定）
    # 例: "ユーザーがこの提案を不要と判断しました"
    deletion_reason: Optional[str] = Field(
        default=None,
        sa_column=Column(Text(), nullable=True)
    )

    # 将来的な拡張フィールド（オプション）
    # confidence_score: Optional[float] = None  # 0.0-1.0の信頼度スコア
    # model_name: Optional[str] = None  # 使用したLLMモデル（gpt-4など）
    # prompt_version: Optional[str] = None  # プロンプトテンプレートのバージョン
    # reference_highlight_id: Optional[int] = None  # 参照したハイライトのID

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    # Relationship
    comment: "Comment" = Relationship(
        back_populates="llm_metadata",
        sa_relationship_kwargs={"uselist": False}  # 1対1を明示
    )
