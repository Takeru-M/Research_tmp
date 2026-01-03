# JWT 認証実装ドキュメント

## 実装内容

JWT 認証とリフレッシュトークン機能を実装しました。以下の要件を満たしています：

### 1. JWT 認証の利用

- FastAPI バックエンドで JWT（JSON Web Token）を使用した認証を実装
- アクセストークンは短寿命（デフォルト 60 分）
- リフレッシュトークンは長寿命（デフォルト 7 日）

### 2. フロントへのレスポンス

バックエンドの認証エンドポイント（`/auth/token/`, `/auth/signup/`, `/auth/refresh/`）から以下を返却：

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user_id": "...",
  "name": "...",
  "email": "..."
}
```

### 3. トークンの保存戦略

- **アクセストークン**: メモリに保存（apiClient.ts で管理）
  - `setAccessToken(token)` でメモリに保存
  - `getAccessToken()` でメモリから取得
  - ページリロード時は NextAuth セッションから再取得
- **リフレッシュトークン**: HTTPOnly クッキーに保存
  - バックエンドで `set_cookie()` で自動設定
  - クライアントからのアクセス不可（XSS 対策）
  - 自動的にリクエストに含まれる（`credentials: 'include'`）

### 4. アクセストークン失効時の処理

apiClient.ts 内で以下の流れを実装：

1. API リクエスト時に 401 エラーが返された場合
2. バックエンドの `/auth/refresh/` エンドポイントを呼び出し
3. リフレッシュトークン（クッキーに保存済み）を使用して新しいアクセストークンを取得
4. 新しいアクセストークンをメモリに保存
5. 元のリクエストを再試行

```typescript
// 自動リフレッシュ処理の例
if (res.status === 401 && cachedAccessToken && method !== 'DELETE') {
  const refreshed = await refreshAccessTokenFromBackend();
  if (refreshed && cachedAccessToken) {
    // トークン更新後、リクエスト再試行
    res = await fetch(...);
  }
}
```

### 5. リフレッシュトークン失効時

- バックエンドが 401 を返す
- `handleSessionExpired()` が呼び出される
- ユーザーはログインページにリダイレクト
- NextAuth セッション、アクセストークン、リフレッシュトークンがクリア

### 6. ログアウト処理

`useLogout()` カスタムフックで以下を実行：

1. アクセストークンをメモリからクリア

   ```typescript
   setAccessToken(null);
   ```

2. バックエンドの `/auth/logout/` を呼び出し

   - リフレッシュトークンクッキーが削除される

3. NextAuth のセッションをクリア

   ```typescript
   await signOut({ redirect: false });
   ```

4. ログインページへリダイレクト

## ファイル変更一覧

### バックエンド

- [backend/app/core/security.py](../backend/app/core/security.py)

  - `create_refresh_token()` 関数追加
  - `decode_refresh_token()` 関数追加
  - トークン有効期限設定の変更

- [backend/app/schemas/auth.py](../backend/app/schemas/auth.py)

  - `Token` スキーマに `refresh_token` フィールド追加

- [backend/app/api/endpoints/auth.py](../backend/app/api/endpoints/auth.py)
  - `/auth/signup/` エンドポイント修正：リフレッシュトークンクッキー設定
  - `/auth/token/` エンドポイント修正：リフレッシュトークンクッキー設定
  - `/auth/refresh/` エンドポイント修正：リフレッシュトークンクッキー設定
  - `/auth/logout/` エンドポイント新規追加：リフレッシュトークン削除

### フロントエンド

- [frontend/pages/api/auth/[...nextauth].ts](../frontend/pages/api/auth/[...nextauth].ts)

  - トークンフィールド名を `fastApiToken` から `accessToken` に変更
  - `credentials: 'include'` オプション追加
  - JWT コールバック修正

- [frontend/utils/apiClient.ts](../frontend/utils/apiClient.ts)

  - `setAccessToken()` / `getAccessToken()` 関数追加
  - `refreshAccessTokenFromBackend()` 関数追加（トークン自動更新）
  - 401 エラー時のリトライロジック実装
  - Authorization ヘッダー自動追加

- [frontend/pages/login.tsx](../frontend/pages/login.tsx)

  - ログイン成功後にアクセストークンをメモリに保存

- [frontend/pages/\_app.tsx](../frontend/pages/_app.tsx)

  - `AccessTokenSyncProvider` コンポーネント追加
  - `useAccessTokenSync` フック実装

- [frontend/components/Layout.tsx](../frontend/components/Layout.tsx)

  - `useLogout()` フック使用
  - ログアウト処理の改善

- [frontend/hooks/useLogout.ts](../frontend/hooks/useLogout.ts) ✨ **新規作成**

  - ログアウト処理を集約

- [frontend/hooks/useAccessTokenSync.ts](../frontend/hooks/useAccessTokenSync.ts) ✨ **新規作成**
  - セッション変更時のトークン同期

## 環境変数設定

以下の環境変数をバックエンド `.env` に設定：

```env
ACCESS_TOKEN_EXPIRE_MINUTES=60          # アクセストークン有効期限（分）
REFRESH_TOKEN_EXPIRE_DAYS=7             # リフレッシュトークン有効期限（日）
ENV=production                          # 本番環境か開発環境か
```

フロントエンド `.env.local`:

```env
NEXT_PUBLIC_TOKEN_EXPIRE_MINUTES=60     # フロント側での期限計算用
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## セキュリティ機能

1. **HTTPOnly クッキー**: リフレッシュトークンは JavaScript からアクセス不可
2. **Secure フラグ**: 本番環境では HTTPS 通信でのみ送信
3. **SameSite**: CSRF 攻撃対策
4. **トークン有効期限**: 期限切れトークンは使用不可
5. **トークン更新**: 有効期限 5 分前に自動更新

## 動作フロー図

### ログイン

```
ユーザー
  ↓
[ログインフォーム]
  ↓
[NextAuth Credentials Provider]
  ↓
[バックエンド /auth/token/]
  ↓
[レスポンス]
├─ access_token → メモリに保存
├─ refresh_token → HTTPOnly クッキーに保存
└─ user情報
```

### API 呼び出し（トークン有効）

```
[apiClient]
  ↓
[メモリからアクセストークンを取得]
  ↓
[Authorizationヘッダーに追加]
  ↓
[バックエンドAPI]
  ↓
[成功レスポンス]
```

### API 呼び出し（トークン期限切れ）

```
[apiClient]
  ↓
[401エラー検出]
  ↓
[refreshAccessTokenFromBackend()]
  ↓
[/auth/refresh/ エンドポイント]
  ├─ Authorization: Bearer <access_token>
  └─ Cookie: refresh_token
  ↓
[新しいaccess_token取得]
  ↓
[メモリに保存]
  ↓
[元のリクエストを再試行]
  ↓
[成功レスポンス]
```

### ログアウト

```
[ログアウトボタン]
  ↓
[useLogout()]
  ├─ setAccessToken(null) → メモリをクリア
  ├─ /auth/logout/ → クッキー削除
  ├─ signOut() → NextAuthセッション削除
  └─ /login へリダイレクト
```

## トラブルシューティング

### トークン関連のエラーが多い場合

1. バックエンド環境変数を確認
2. SECRET_KEY が正しく設定されているか確認
3. クッキーの設定（Secure, SameSite）を確認

### リフレッシュできない場合

1. HTTPOnly クッキーが送受信されているか（DevTools で確認）
2. バックエンド `/auth/refresh/` エンドポイントが正常か
3. クッキーの有効期限を確認

### ページリロード後にログアウトしてしまう

1. NextAuth セッションの設定を確認
2. session コールバックが正しく機能しているか
3. `useAccessTokenSync` フックが実行されているか
