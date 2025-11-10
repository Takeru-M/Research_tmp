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
# CMDはdocker-compose.dev.ymlで上書きされるため、ここでは不要だが、明示的に記述する場合は以下のようになる
# CMD ["npm", "run", "dev"]


# 本番用ビルドステージ
FROM base AS build
# ソースコードをコンテナ内の /app にコピー
# コピー元はビルドコンテキストの 'frontend/' ディレクトリ（docker-compose.ymlのcontext:.を想定）
COPY frontend/. .
# .gitignoreで無視されているファイルも確実にコピーするため、.dockerignoreファイルの設定も確認してください

# Next.jsの本番ビルドを実行
RUN npm run build

# 本番用ランタイムステージ
FROM node:20-alpine AS production
WORKDIR /app

# ビルドステージから必要なファイルのみコピー
# .next (ビルド結果)
COPY --from=build /app/.next ./.next
# node_modules (依存パッケージ)
COPY --from=build /app/node_modules ./node_modules
# package.json (npm start実行に必要)
COPY --from=build /app/package.json ./package.json
# public (静的ファイル)
COPY --from=build /app/public ./public

# 実行ユーザーの追加（セキュリティ向上）
RUN addgroup -g 1000 nodejs && adduser -u 1000 -G nodejs -S nodejs
USER nodejs

EXPOSE 3000
# 本番環境でサーバーを起動
CMD ["npm", "start"]