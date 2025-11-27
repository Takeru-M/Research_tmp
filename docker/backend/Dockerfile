# backend/Dockerfile

# Pythonの公式スリムイメージをベースとする
FROM python:3.11-slim

# 環境変数で UTF-8 を明示
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV PYTHONIOENCODING=utf-8

# 作業ディレクトリの設定
WORKDIR /app

# 必要なら tzdata 等も
RUN apt-get update && apt-get install -y --no-install-recommends \
  fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/*

# 依存関係ファイルのコピーとインストール
# ホスト側のbackendディレクトリにrequirements.txtを作成します
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# （任意）フォントキャッシュ（fontconfig不要なら省略可）
# RUN fc-cache -fv || true

# アプリケーションコードをコピー
COPY . .

# 実行ユーザーの追加（セキュリティ向上 - オプション）
RUN adduser --disabled-password --gecos '' fastapiuser
USER fastapiuser

# FastAPIのデフォルトポートを公開
EXPOSE 8000

# コンテナ起動時にUvicornを起動
# 0.0.0.0でリッスンすることで、外部からのアクセスを許可
# main:app は、main.pyファイルのappインスタンスを指します
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]