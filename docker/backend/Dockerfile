# Pythonの公式スリムイメージをベースとする
FROM python:3.11-slim

# 環境変数で UTF-8 を明示
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV PYTHONIOENCODING=utf-8
ENV PYTHONUNBUFFERED=1

# ホストの backend/ をコンテナの /app にコピー
WORKDIR /app

# 必要なら tzdata 等も
RUN apt-get update && apt-get install -y --no-install-recommends \
  fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/*

# docker-compose.yml のコンテキストから backend/requirements.txt をコピー
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# backend/ の全内容を /app にコピー
COPY backend/ .

RUN adduser --disabled-password --gecos '' fastapiuser

# ログディレクトリを作成して権限付与
RUN mkdir -p /app/logs && chown -R fastapiuser:fastapiuser /app/logs

USER fastapiuser

# FastAPIのデフォルトポートを公開
EXPOSE 8000

# コンテナ起動時にUvicornを起動
# 0.0.0.0でリッスンすることで、外部からのアクセスを許可
# main:app は、main.pyファイルのappインスタンスを指します
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]