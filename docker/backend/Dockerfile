# backend/Dockerfile

# Pythonの公式スリムイメージをベースとする
FROM python:3.11-slim

# 作業ディレクトリの設定
WORKDIR /app

# 依存関係ファイルのコピーとインストール
# ホスト側のbackendディレクトリにrequirements.txtを作成します
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

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