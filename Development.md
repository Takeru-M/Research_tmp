// 本番環境構成例（AWS）

| functions                  | AWS Service        
| -------------------------- | -------------------
| Frontend(Next.js Static)   | S3 + CloudFront    
| Backend(FastAPI)           | ECS Fargate        
| DB(PostgreSQL)             | Lightsail DB       
| Docker Image Management    | ECR                
| HTTPS / CDN                | CloudFront + ACM   
| Secrets                    | SSM Parameter Store

// 本番環境構成例2（ほぼ無料）
front:vercel
back:render
db:render
ファイル保存：S3
ログ保存：cloudflare R2

// ログについて
現状，ログはcloudflareのR2に保存
apiアクセスとユーザアクションを記録している
バック側の設定はapp/core/logging.pyで，フロント側の設定はutils/logger.ts


// 開発について
フロント
・ページや機能の追加(共通機能はutilsに切り分け)
・スキーマの定義（ページごと，リクエストとレスポンスで分けている）
・バックと通信する場合はapiClientを利用
・基本的なエラーハンドリングはapiClientが担当しているが，必要な場合は別途ページ内で記述
・CSSは基本的にmoduleに切り出し，ページ内でインポート
・メッセージなどはlangファイル内のja.jsonやen.jsonに書き，ページ内で利用
・userActionログは一定時間キャッシュし，バックに送信して保存

バック
・エンドポイントの作成はapi/endpoints内で操作に対応したエンドポイントを作成し，api.pyに追加
・dbに対する操作はcrud内で各モデルに対応するように記述
・テーブルを変更するときは，models内でmodelを定義→__init__.pyに追加→バックのコンテナ内でモデルの変更用のalembicコマンド→マイグレーション実行用のalembicコマンド
・スキーマの追加はschemas内でschemaを定義→__init__.pyに追加
・エラー発生時にはエラーに応じたステータスコードとメッセージを返す
・エラーメッセージはi18n/locales/ja/messages.poやen/messages.poに記述→バックのコンテナ内でbabelのコンパイルコマンド
・apiAccessログは通信があったときにバックで処理

デバッグ法
・何かエラーが起きたらdocker compose logsコマンドでエラーを確認，または検証ツールでエラー内容を確認


// 注意点
・現状，本番環境構成例2でデプロイしているが，インフラとログ管理をAWSに，dbをmysqlに変更予定