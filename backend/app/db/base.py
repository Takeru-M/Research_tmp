# app/db/base.py
from typing import Generator
from sqlmodel import create_engine, Session, SQLModel
from dotenv import load_dotenv
import os
from sqlalchemy import create_engine, event
from sqlalchemy.pool import StaticPool
# from app.core.config import settings

# .envファイルを読み込む
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# Engineの作成
# echo=Trueにすると、実行されるSQL文がコンソールに出力されます
engine = create_engine(
    DATABASE_URL,
    echo=True,
    poolclass=StaticPool,
    connect_args={
        "charset": "utf8mb4",
        "use_unicode": True,
    },
    pool_pre_ping=True,
)

# 接続ごとに文字コードを強制設定
@event.listens_for(engine, "connect")
def set_charset(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci")
    cursor.execute("SET CHARACTER SET utf8mb4")
    cursor.close()

def create_db_and_tables():
    """テーブルがまだ存在しない場合に作成します。Alembicを使用する場合は不要です。"""
    # SQLModelの基底クラスに紐づくすべてのテーブルを作成
    SQLModel.metadata.create_all(engine)

def get_session() -> Generator[Session, None, None]:
    """
    依存性注入(DI)のためのセッションジェネレータ関数。
    FastAPIの `Depends` で使用します。
    """
    with Session(engine) as session:
        yield session

# Alembic設定用のmetadata
# Alembicの `env.py` から参照されます
from sqlmodel import SQLModel as BaseModel
metadata = BaseModel.metadata