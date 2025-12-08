#!/usr/bin/env bash
set -euo pipefail

# DBが起動して接続可能になるまで待機（必要に応じて調整）
# 例: Postgres を想定。環境変数 DATABASE_URL=postgresql+psycopg2://user:pass@db:5432/dbname
echo "Waiting for database..."
python - <<'PY'
import os, time
import sqlalchemy
url = os.getenv("DATABASE_URL")
assert url, "DATABASE_URL is not set"
engine = sqlalchemy.create_engine(url)
for i in range(60):
    try:
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        print("Database is ready.")
        break
    except Exception as e:
        print(f"DB not ready ({e}), retry {i+1}/60")
        time.sleep(1)
else:
    raise RuntimeError("Database not ready in time")
PY

# Alembic によるマイグレーション & データシード（データはリビジョンに記述）
echo "Running alembic upgrade head..."
alembic upgrade head

# アプリ起動
echo "Starting Uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port 8000