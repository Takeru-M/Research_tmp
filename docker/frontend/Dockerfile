# 開発/本番 共通のベースイメージ
FROM node:20-alpine AS base
# 作業ディレクトリを /app に設定
WORKDIR /app

# Step 1: 依存関係のインストール
# 依存ファイルはプロジェクトルートの "frontend" ディレクトリにあることを前提
COPY frontend/package*.json ./
RUN npm install

# 開発用ビルドステージ (docker-compose.dev.ymlでボリュームマウントを前提)
FROM base AS dev
# 開発中はソースコードをボリュームマウントで対応するため、ここではコピーしない
# 開発サーバーを起動（docker-composeで上書き可能）
CMD ["npm", "run", "dev"]

# 本番用ビルドステージ
FROM base AS build
# ソースコードをコンテナ内の /app にコピー
COPY frontend/ ./
# Next.jsの本番ビルドを実行
RUN npm run build

# 本番用ランタイムステージ
FROM node:20-alpine AS production
WORKDIR /app

# ビルドステージから必要なファイルのみコピー
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts

# 実行ユーザーの追加（セキュリティ向上）
RUN addgroup -g 1000 nodejs && adduser -u 1000 -G nodejs -S nodejs
USER nodejs

EXPOSE 3000
CMD ["npm", "start"]