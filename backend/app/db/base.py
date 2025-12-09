# app/db/base.py
from typing import Generator
from sqlmodel import create_engine, Session, SQLModel
from sqlalchemy import event
from dotenv import load_dotenv
import os
import logging

logger = logging.getLogger(__name__)

# .envファイルを読み込む
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in environment variables")

def get_db_url() -> str:
    """DATABASE_URL から charset を削除"""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL is not set")
    
    # charset パラメータを削除
    if "charset" in db_url:
        db_url = db_url.split("?")[0]
        # ? の後ろの他のパラメータは保持
        if "?" in os.getenv("DATABASE_URL"):
            params = os.getenv("DATABASE_URL").split("?")[1]
            params = "&".join([p for p in params.split("&") if not p.startswith("charset")])
            if params:
                db_url += "?" + params
    
    return db_url

# Engineの作成
engine = create_engine(
    get_db_url(),
    echo=False,
    pool_pre_ping=True,
)

# 接続ごとに文字コードを強制設定
@event.listens_for(engine, "connect")
def set_charset(dbapi_conn, connection_record):
    """MySQL接続時の文字コード設定"""
    try:
        cursor = dbapi_conn.cursor()
        cursor.execute("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci")
        cursor.execute("SET CHARACTER SET utf8mb4")
        cursor.close()
    except Exception as e:
        logger.error(f"[set_charset] Error setting charset: {e}")

def create_db_and_tables():
    """テーブルがまだ存在しない場合に作成します。Alembicを使用する場合は不要です。"""
    SQLModel.metadata.create_all(engine)

def get_session() -> Generator[Session, None, None]:
    """
    依存性注入(DI)のためのセッションジェネレータ関数。
    FastAPIの `Depends` で使用します。
    """
    with Session(engine) as session:
        try:
            yield session
        except Exception as e:
            session.rollback()
            logger.error(f"[get_session] Database session error: {e}", exc_info=True)
            raise
        finally:
            session.close()

# Alembic設定用のmetadata
metadata = SQLModel.metadata