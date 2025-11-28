import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const BACKEND_URL = process.env.NEXT_PUBLIC_FASTAPI_URL;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
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

        try {
          const response = await fetch(`${BACKEND_URL}/auth/token`, {
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
          console.log("FastAPI token response:", data);

          if (!data.access_token || !data.user_id) {
            console.error("Missing required fields in response");
            return null;
          }

          // FastAPIから返されたトークンをそのまま保存
          return {
            id: String(data.user_id),
            name: data.name || data.email,
            email: data.email,
            fastApiToken: data.access_token,
          };
        } catch (error) {
          console.error("Authorization error:", error);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account, trigger }) {
      console.log("JWT callback - user:", user);
      console.log("JWT callback - token before:", token);

      if (user) {
        // 新規ログイン時：FastAPIのトークンを保存
        token.fastApiToken = (user as any).fastApiToken;
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      } else if (token.accessToken && !token.fastApiToken) {
        // 既存トークンの移行（古い構造から新しい構造へ）
        token.fastApiToken = token.accessToken as string;
        token.id = token.user?.id;
        token.name = token.user?.name;
        token.email = token.user?.email;
        // 古いプロパティを削除
        delete token.accessToken;
        delete token.user;
      }

      console.log("JWT callback - token after:", token);
      return token;
    },

    async session({ session, token }) {
      console.log("Session callback - token:", token);
      console.log("Session callback - session before:", session);

      if (token) {
        // FastAPIのトークンをaccessTokenとして保存
        session.accessToken = (token.fastApiToken || token.accessToken) as string;
        session.user = {
          ...session.user,
          id: (token.id || token.user?.id) as string,
          name: (token.name || token.user?.name) as string,
          email: (token.email || token.user?.email) as string,
        };
      }

      console.log("Session callback - session after:", session);
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  debug: true, // デバッグモードを有効化
};

export default NextAuth(authOptions);
