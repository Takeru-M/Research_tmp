import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// 環境変数からFastAPIのエンドポイントを取得
const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL;

// NextAuthの設定
export const authOptions: NextAuthOptions = {
  // セッション戦略としてJWTを使用
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30日
  },
  
  providers: [
    CredentialsProvider({
      // ログインフォームの表示名
      name: "Credentials",
      // フォームで送信される認証情報
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      
      async authorize(credentials) {
        // 💡 credentials が存在しない場合は null を返す
        if (!credentials?.email || !credentials?.password) return null;

        // 💡 FastAPI のログインエンドポイントに認証情報を送信
        const response = await fetch("http://backend:8000/api/v1/auth/token", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', // JSONで送信
          },
          // FastAPI側の LoginRequest モデルに合わせて body を作成
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        // 💡 レスポンスが OK でない場合は認証失敗として null を返す
        if (!response.ok) {
          console.error("FastAPI Authentication failed:", response.status);
          return null;
        }

        // 💡 FastAPI からのレスポンスを JSON として取得
        const data = await response.json();

        // 💡 access_token と user_id が存在しない場合も null
        if (!data.access_token || !data.user_id) return null;

        // 💡 NextAuthのセッションに保存するユーザー情報を返す
        return {
          id: data.user_id,        // ユーザーID
          name: data.name,         // ユーザー名
          email: data.email,       // メールアドレス
          accessToken: data.access_token, // JWTをセッションコールバックで利用
        };
      },
    }),
  ],

  callbacks: {
    // 💡 JWTが生成される際 (ログイン時やセッション更新時) に呼ばれる
    async jwt({ token, user }) {
      // 💡 authorize() が返した user 情報を JWT に追加
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.accessToken = (user as any).accessToken; // アクセストークン
      }
      return token;
    },
    // 💡 セッション取得時 (useSession() 使用時) に呼ばれる
    async session({ session, token }) {
      // 💡 クライアントからアクセスできるように JWT 情報を session に追加
      session.user.id = token.id as string;
      session.user.name = token.name as string;
      session.user.email = token.email as string;
      session.accessToken = token.accessToken;
      return session;
    },
  },

  // 💡 カスタムページ設定
  pages: {
    signIn: '/login', // ログインページをカスタムページに設定
  }
};

export default NextAuth(authOptions);
