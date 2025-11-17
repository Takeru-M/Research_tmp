# seed.py

import os
import sys
from sqlmodel import create_engine, Session
from dotenv import load_dotenv
from sqlmodel import SQLModel

load_dotenv()
sys.path.insert(0, os.path.abspath("."))

# Userモデルの定義をインポートします
# プロジェクトのルートディレクトリから実行する場合、このパスが正しいことを確認してください
from app.models import User

# --- 設定 ---
# Docker Composeで設定した完全なDB URLを環境変数から取得します
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # 環境変数が設定されていない場合のエラーメッセージ
    raise ValueError(
        "DATABASE_URL 環境変数が設定されていません。例: mysql+pymysql://user:pass@host:port/dbname"
    )
        
def unseed_database(drop_tables: bool = False):
    """
    データベースから全てのユーザーデータを削除し、オプションでテーブルも削除します。

    Args:
        drop_tables (bool): True の場合、SQLModelが管理する全てのテーブルをドロップします。
                            開発環境での完全なリセットに使用します。
    """
    print(f"Connecting to database at {DATABASE_URL.split('@')[-1]}...")
    engine = create_engine(DATABASE_URL)
    
    with Session(engine) as session:
        
        # 1. 全ユーザーデータの削除
        print("Starting data unseeding: Deleting all User records...")
        
        # SQLModel (SQLAlchemy) を使用してDELETEクエリを実行します
        # .delete() メソッドで全てのUserレコードを対象とします
        delete_statement = User.__table__.delete()
        result = session.exec(delete_statement)
        
        session.commit()
        print(f"  ✅ Successfully deleted {result.rowcount} User records.")
        
        # 2. テーブル構造の削除 (オプション)
        if drop_tables:
            print("Dropping all tables managed by SQLModel metadata...")
            # SQLModelが認識している全てのテーブルをデータベースから削除
            SQLModel.metadata.drop_all(engine)
            print("  ✅ All tables dropped.")
            
        print("Data unseeding completed successfully! ✨")

if __name__ == "__main__":
    try:
        unseed_database(drop_tables=False)
        print("\n✅ Database unseeding completed successfully.")
    except Exception as e:
        print(f"\n❌ An error occurred during seeding:")
        print(e)