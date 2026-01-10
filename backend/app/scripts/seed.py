# seed.py

import os
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.join(script_dir, "..", "..")
sys.path.insert(0, project_root)

from sqlmodel import create_engine, Session
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv
from sqlmodel import SQLModel
from app.core.security import get_password_hash

load_dotenv()

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

def create_users_data():
    """
    テスト用のユーザーデータリストを作成します。
    """
    
    plainpasswords = ["Password1", "Password2", "Password3", "Samplepass1"]
    # hashed_passwordは実際のハッシュ関数で生成されるべきですが、ここではプレースホルダーを使用
    return [
        User(
            name="Sample1",
            email="test.test@test.com",
            hashed_password=get_password_hash(plainpasswords[0]),
            # created_at, updated_at は default_factory で自動設定されます
        ),
        User(
            name="Sample2",
            email="test2.test@test.com",
            hashed_password=get_password_hash(plainpasswords[1]),
        ),
        User(
            name="Sample3",
            email="test3.test@test.com",
            hashed_password=get_password_hash(plainpasswords[2]),
            deleted_at=datetime.utcnow() # 論理削除されたユーザーの例
        ),
        User(
            name="Sample",
            email="sample@sample.com",
            hashed_password=get_password_hash(plainpasswords[3]),
        )
    ]

def seed_database():
    """
    データベースに接続し、テストデータを挿入します。
    """
    print(f"Connecting to database at {DATABASE_URL.split('@')[-1]}...")
    engine = create_engine(DATABASE_URL)
    
    print("Checking for tables and creating them if they don't exist...")
    SQLModel.metadata.create_all(engine)
    print("Tables are ready.")
    
    users_to_add = create_users_data()

    with Session(engine) as session:
        print("Starting data seeding...")

        for user in users_to_add:
            # 重複挿入を防ぐために、Emailで存在チェックを行います
            existing_user = session.query(User).filter(User.email == user.email).first()
            
            if not existing_user:
                session.add(user)
                print(f"  ✅ Added user: {user.email}")
            else:
                print(f"  ⚠️ Skipped user: {user.email} (Already exists)")
        
        session.commit()
        print("Data seeding completed successfully! ✨")

if __name__ == "__main__":
    try:
        seed_database()
        create_users_data()
    except Exception as e:
        print(f"\n❌ An error occurred during seeding:")
        print(e)