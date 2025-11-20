import NextAuth, { NextAuthOptions, DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";

// 💡 NextAuth の JWT に追加するカスタムフィールド
interface CustomJWT extends JWT {
  accessToken?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

// 💡 セッションに追加するカスタムフィールド
interface CustomSession extends DefaultSession {
  user: {
    id: string;
    name: string;
    email: string;
  };
  accessToken?: string;
}

// 環境変数から FastAPI の URL を取得
const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",           // JWTベースのセッション
    maxAge: 30 * 24 * 60 * 60, // 30日
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // 💡 FastAPI のログインエンドポイントに POST
        const response = await fetch(`http://backend:8000/api/v1/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        if (!response.ok) {
          console.error("FastAPI Authentication failed:", response.status);
          return null;
        }

        const data = await response.json();

        // 💡 access_token や user_id が存在しなければ認証失敗
        if (!data.access_token || !data.user_id) return null;

        // 💡 NextAuth の user オブジェクトとしてユーザー情報と access_token をそのまま返す
        return {
          accessToken: data.access_token,
          user: {
            id: data.user_id,
            name: data.name,
            email: data.email,
          },
        };
      },
    }),
  ],

  callbacks: {
    // 💡 JWT生成時に呼ばれる
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.user = user.user;
      }
      return token;
    },

    // 💡 セッション取得時に呼ばれる
    async session({ session, token }) {
      const s = session as CustomSession;
      const t = token as CustomJWT;

      // 💡 バック側から受け取ったユーザー情報とアクセストークンをそのままセット
      s.accessToken = t.accessToken;
      s.user = t.user!; // 💡 user は必ず存在するので non-null assertion

      return s;
    },
  },

  pages: {
    signIn: "/login", // カスタムログインページ
  },
};

export default NextAuth(authOptions);
