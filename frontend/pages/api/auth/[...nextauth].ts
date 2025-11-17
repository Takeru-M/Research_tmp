import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// 環境変数から秘密鍵とFastAPIのエンドポイントを取得
const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL;

// NextAuthの設定
export const authOptions: NextAuthOptions = {
  // セッション戦略としてJWTを使用
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  providers: [
    CredentialsProvider({
      // ログインフォームの表示名
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      
      async authorize(credentials, req) {
        if (!credentials) return null;

        // 💡 1. FastAPIのログインエンドポイントに認証情報を送信
        // TODO: 環境変数を参照
        // const response = await fetch(`${FASTAPI_URL}/auth/token`, {
        const response = await fetch("http://backend:8000/api/v1/auth/token", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          // FastAPIのOAuth2PasswordRequestFormに合わせて、フォームデータを送信
          body: new URLSearchParams({
            username: credentials.username,
            password: credentials.password,
          }),
        });
        console.log(response);

        // 💡 2. FastAPIからのレスポンスを処理
        if (!response.ok) {
          // 認証失敗
          console.error("FastAPI Authentication failed:", response.status);
          return null;
        }

        const data = await response.json();
        
        // FastAPIが返すデータ構造（例：{"access_token": "...", "token_type": "bearer", "user_id": "..."}）に合わせて処理

        // 💡 3. JWTトークンとユーザー情報を返す
        if (data.access_token) {
          // NextAuthのセッションに保存したい情報をここで返す
          return {
            id: data.user_id || credentials.username, // ユーザーID
            name: credentials.username,
            // トークンをJWT Callbackで使用するために、ユーザーオブジェクトに含めておく
            accessToken: data.access_token, 
          };
        }
        
        return null;
      },
    }),
  ],

  // JWTをカスタマイズするためのコールバック
  callbacks: {
    // JWTが生成される際 (ログイン時やセッション更新時) に呼ばれる
    async jwt({ token, user }) {
      if (user) {
        // user は authorize() が返したオブジェクト
        token.id = user.id;
        token.accessToken = (user as any).accessToken; // アクセストークンをトークンペイロードに追加
      }
      return token;
    },
    // セッションが呼ばれる際 (useSession()使用時) に呼ばれる
    async session({ session, token }) {
      // セッションオブジェクトにトークン情報を追加し、クライアントからアクセスできるようにする
      session.user.id = token.id as string;
      session.accessToken = token.accessToken; // クライアントがFastAPIにアクセスする際に使用
      return session;
    },
  },
  pages: {
    signIn: '/login', // ログインページをカスタムページに設定
  }
};

export default NextAuth(authOptions);