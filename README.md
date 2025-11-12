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
  <img src="https://img.shields.io/badge/-Django-092E20.svg?logo=django&style=for-the-badge">
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
・読み込んだpdfファイルをブラウザ上に表示し，pdfに対してハイライトをつけてコメントを書くことができる機能
・吟味の余地がある箇所について他の選択肢を考えることが困難な学習者に対して，LLMが他の選択肢に目を向けさせるような示唆を出す機能（実装中）
・吟味をすることが困難な学習者に対して，LLMが考える方向性に関する示唆を出す機能（実装中）
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

| 言語・フレームワーク  | バージョン |
| --------------------- | ---------- |
| PHP                   | 8.2        |
| Laravel               | 12.0       |
| MySQL                 |         |
| Node.js               |     |
| React                 | 19.2.0     |
| Next.js               | 16.0.0     |
| Terraform             | 1.3.6      |

その他のパッケージのバージョンは pyproject.toml と package.json を参照してください

<p align="right">(<a href="#top">トップへ</a>)</p>

## ディレクトリ構成

<!-- Treeコマンドを使ってディレクトリ構成を記載 -->

❯ tree -a -I "node_modules|.next|.git|.pytest_cache|static" -L 2
.
├── .DS_Store
├── .env
├── .gitignore
├── backend
│   ├── .DS_Store
│   ├── .editorconfig
│   ├── .env
│   ├── .env.example
│   ├── .gitattributes
│   ├── .gitignore
│   ├── app
│   ├── artisan
│   ├── bootstrap
│   ├── composer.json
│   ├── composer.lock
│   ├── config
│   ├── database
│   ├── package.json
│   ├── phpunit.xml
│   ├── public
│   ├── README.md
│   ├── resources
│   ├── routes
│   ├── storage
│   ├── tests
│   ├── vendor
│   └── vite.config.js
├── docker
│   ├── backend
│   ├── frontend
│   ├── mysql
│   └── nginx
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── docker-compose.yml
├── Document
├── frontend
│   ├──  components
│   ├── .DS_Store
│   ├── .env
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
│   ├── tsconfig.json
│   ├── types
│   └── utils
├── practice.py
└── README.md

<p align="right">(<a href="#top">トップへ</a>)</p>

## 開発環境構築

<!-- コンテナの作成方法、パッケージのインストール方法など、開発環境構築に必要な情報を記載 -->

### コンテナの作成と起動

.env ファイル（ルートディレクトリ，frontendフォルダ，backendフォルダの三箇所）を以下の環境変数例と[環境変数の一覧](#環境変数の一覧)を元に作成

（ルートディレクトリ）
MYSQL_ROOT_PASSWORD=Suntory
MYSQL_USER=OLD
MYSQL_PASSWORD=suntory_old
MYSQL_DATABASE=laravel_db
MYSQL_TEST_DATABASE=laravel_test_db

（frontend内）
OPENAI_SECRET_KEY="OpenAIのAPIキー"

（backend内）
APP_NAME=Laravel
APP_ENV=local
APP_KEY=base64:1z1xCHCtZOGa5sZneqetwDOZ2j43H4Sq0M2FbLrV6co=
APP_DEBUG=true
APP_URL=http://localhost

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file
# APP_MAINTENANCE_STORE=database

PHP_CLI_SERVER_WORKERS=4

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=db
DB_PORT=3306
DB_DATABASE=laravel_db
DB_USERNAME=OLD
DB_PASSWORD=suntory_old

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database

CACHE_STORE=database
# CACHE_PREFIX=

MEMCACHED_HOST=127.0.0.1

REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=log
MAIL_SCHEME=null
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="${APP_NAME}"

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

VITE_APP_NAME="${APP_NAME}"


.env ファイルを作成後、以下のコマンドで開発環境を構築

// 開発用
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

// 本番用
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

// テスト（Docker Composeネットワーク内でコマンドを実行）
docker compose exec backend bash -c "php artisan migrate --env=testing && vendor/bin/phpunit"

### 動作確認

http://127.0.0.1:80 にアクセスできるか確認
アクセスできたら成功

### コンテナの停止

以下のコマンドでコンテナを停止することができます

docker compose down

### 環境変数の一覧

| 変数名                 | 役割                                      | デフォルト値                       | DEV 環境での値                           |
| ---------------------- | ----------------------------------------- | ---------------------------------- | ---------------------------------------- |
| MYSQL_ROOT_PASSWORD    | MySQL のルートパスワード（Docker で使用） | root                               |                                          |
| MYSQL_DATABASE         | MySQL のデータベース名（Docker で使用）   | django-db                          |                                          |
| MYSQL_USER             | MySQL のユーザ名（Docker で使用）         | django                             |                                          |
| MYSQL_PASSWORD         | MySQL のパスワード（Docker で使用）       | django                             |                                          |
| MYSQL_HOST             | MySQL のホスト名（Docker で使用）         | db                                 |                                          |
| MYSQL_PORT             | MySQL のポート番号（Docker で使用）       | 3306                               |                                          |
| SECRET_KEY             | Django のシークレットキー                 | secretkey                          | 他者に推測されないランダムな値にすること |
| ALLOWED_HOSTS          | リクエストを許可するホスト名              | localhost 127.0.0.1 [::1] back web | フロントのホスト名                       |
| DEBUG                  | デバッグモードの切り替え                  | True                               | False                                    |
| TRUSTED_ORIGINS        | CORS で許可するオリジン                   | http://localhost                   |                                          |
| DJANGO_SETTINGS_MODULE | Django アプリケーションの設定モジュール   | project.settings.local             | project.settings.dev                     |

### コマンド一覧
特になし．

<p align="right">(<a href="#top">トップへ</a>)</p>
