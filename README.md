<div id="top"></div>

## 使用技術一覧

<!-- シールド一覧 -->
<!-- 該当するプロジェクトの中から任意のものを選ぶ-->
<p style="display: inline">
  <!-- フロントエンド関連 -->
  <img src="https://img.shields.io/badge/-Node.js-000000.svg?logo=node.js&style=for-the-badge">
  <img src="https://img.shields.io/badge/-Next.js-000000.svg?logo=next.js&style=for-the-badge">
  <img src="https://img.shields.io/badge/-React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB">
  <!-- バックエンド関連 -->
 <img src="https://img.shields.io/badge/-Laravel-FF2D20.svg?logo=laravel&style=for-the-badge">
  <!-- フロントエンド言語 -->
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
  <!-- バックエンド言語 -->
  <img src="https://img.shields.io/badge/PHP-777BB4?style=for-the-badge&logo=php&logoColor=white">
  <!-- ミドルウェア -->
  <img src="https://img.shields.io/badge/-Nginx-269539.svg?logo=nginx&style=for-the-badge">
  <img src="https://img.shields.io/badge/-MySQL-4479A1.svg?logo=mysql&style=for-the-badge&logoColor=white">
  <!-- インフラ -->
  <img src="https://img.shields.io/badge/-Docker-1488C6.svg?logo=docker&style=for-the-badge">
</p>

## 目次

1. [プロジェクトについて](#プロジェクトについて)
2. [環境](#環境)
3. [ディレクトリ構成](#ディレクトリ構成)
4. [開発環境構築](#開発環境構築)

<!-- READMEの作成方法のドキュメントのリンク -->
<br />
<div align="right">
    <a href="READMEの作成方法のリンク"><strong>READMEの作成方法 »</strong></a>
</div>
<br />
<!-- Dockerfileのドキュメントのリンク -->
<div align="right">
    <a href="Dockerfileの詳細リンク"><strong>Dockerfileの詳細 »</strong></a>
</div>
<br />
<!-- プロジェクト名を記載 -->

## プロジェクト名

Research_tmp

<!-- プロジェクトについて -->

## プロジェクトについて

社会的な意思決定の場において利用される資料を題材として，意思決定をしていることと吟味の重要性について認識させ，事前の吟味を促すシステム．

機能一覧：
・読み込んだ pdf ファイルをブラウザ上に表示し，pdf に対してハイライトをつけてコメントを書くことができる機能
・吟味の余地がある箇所について他の選択肢を考えることが困難な学習者に対して，LLM が他の選択肢に目を向けさせるような示唆を出す機能（実装中）
・吟味をすることが困難な学習者に対して，LLM が考える方向性に関する示唆を出す機能（実装中）
・介入前と介入後で比較ができる機能（実装中）

<!-- プロジェクトの概要を記載 -->

  <p align="left">
    <br />
    <!-- プロジェクト詳細にBacklogのWikiのリンク -->
    <a href="Backlogのwikiリンク"><strong>プロジェクト詳細 »</strong></a>
    <br />
    <br />

<p align="right">(<a href="#top">トップへ</a>)</p>

## 環境

<!-- 言語、フレームワーク、ミドルウェア、インフラの一覧とバージョンを記載 -->

| 言語・フレームワーク | バージョン |
| -------------------- | ---------- |
| PHP                  | 8.2        |
| FastAPI              | 0.122.0    |
| MySQL                | 8.0.44     |
| Node.js              | 20.19.5    |
| React                | 19.2.0     |
| Next.js              | 16.0.0     |

※2025 年時点

その他のパッケージのバージョンは composer.json と package.json を参照してください

<p align="right">(<a href="#top">トップへ</a>)</p>

## ディレクトリ構成

<!-- Treeコマンドを使ってディレクトリ構成を記載 -->

❯ tree -a -I "node_modules|.next|.git|.pytest_cache|static" -L 2

.
├── .devcontainer
│   └── devcontainer.json
├── .dockerignore
├── .DS_Store
├── .env
├── .gitignore
├── backend
│   ├── **pycache**
│   ├── .env
│   ├── .gitignore
│   ├── .venv
│   ├── alembic
│   ├── alembic.ini
│   ├── app
│   ├── fileStructure
│   ├── main.py
│   └── requirements.txt
├── docker
│   ├── .DS_Store
│   ├── backend
│   ├── frontend
│   ├── mysql
│   └── nginx
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── docker-compose.yml
├── Document
├── frontend
│   ├── components
│   ├── .DS_Store
│   ├── .env
│   ├── .env.local
│   ├── .gitignore
│   ├── app
│   ├── eslint.config.mjs
│   ├── lang
│   ├── next-env.d.ts
│   ├── next.config.ts
│   ├── package-lock.json
│   ├── package.json
│   ├── pages
│   ├── postcss.config.mjs
│   ├── public
│   ├── README.md
│   ├── redux
│   ├── styles
│   ├── tmp
│   ├── tmp_uploads
│   ├── tsconfig.json
│   ├── types
│   └── utils
├── mermaid
├── README.md
└── TableStructure.png

※backend の各フォルダの役割については backend/fileStructure を参照

<p align="right">(<a href="#top">トップへ</a>)</p>

## 開発環境構築

<!-- コンテナの作成方法、パッケージのインストール方法など、開発環境構築に必要な情報を記載 -->

### コンテナの作成と起動

.env ファイル（ルートディレクトリ，frontend フォルダ，backend フォルダの三箇所）を[環境変数の一覧](#環境変数の一覧)を元に作成

各.env ファイルを作成後、以下のコマンドで開発環境を構築

// 開発用
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

// 本番用
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

// テスト（Docker Compose ネットワーク内でコマンドを実行）
docker compose exec backend bash -c "php artisan migrate --env=testing && vendor/bin/phpunit"

### 動作確認

http://127.0.0.1:3000 にアクセスできるか確認
アクセスできたら成功

### 環境変数の一覧

.env（ルートディレクトリ）
MYSQL_HOST={ホスト名}
MYSQL_ROOT_PASSWORD={ルートパスワード}
MYSQL_USER={ユーザ名}
MYSQL_ROOT={ルートユーザ名}
MYSQL_PASSWORD={パスワード}
MYSQL_DATABASE={データベース名}
MYSQL_TEST_DATABASE={テスト用データベース名}
DATABASE_URL=mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:3306/{MYSQL_DATABASE}?charset=utf8mb4&collation=utf8mb4_unicode_ci

.env（frontend 内）
OPENAI_SECRET_KEY={OpenAI の API キー}
NEXTAUTH_SECRET={JWT 用シークレットキー}
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
AWS_ACCESS_KEY_ID={AWS へアクセスするためのキー}
AWS_SECRET_ACCESS_KEY={AWS へアクセスするためのシークレットキー}
AWS_REGION={リージョン名}
S3_BUCKET_NAME={バケット名}

.env（backend 内）
MYSQL_HOST={ホスト名}
MYSQL_ROOT_PASSWORD={ルートパスワード}
MYSQL_USER={ユーザ名}
MYSQL_ROOT={ルートユーザ名}
MYSQL_PASSWORD={パスワード}
MYSQL_DATABASE={データベース名}
MYSQL_TEST_DATABASE={テスト用データベース名}
DATABASE_URL=mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:3306/{MYSQL_DATABASE}?charset=utf8mb4&collation=utf8mb4_unicode_ci
SECRET_KEY = {JWT 用シークレットキー}
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
NEXT_PUBLIC_API_URL=http://backend:8000/api
AWS_ACCESS_KEY_ID={AWS へアクセスするためのキー}
AWS_SECRET_ACCESS_KEY={AWS へアクセスするためのシークレットキー}
AWS_REGION={リージョン名}
S3_BUCKET_NAME={バケット名}

※JWT 用シークレットキーについては"openssl rand -base64 32"等で発行

### コマンド一覧

ルートディレクトリ直下の Commands を参照

<p align="right">(<a href="#top">トップへ</a>)</p>
