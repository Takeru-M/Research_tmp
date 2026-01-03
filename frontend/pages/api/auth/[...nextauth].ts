import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { FastApiAuthResponse } from "@/types/Responses/Auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id?: string;
      name?: string;
      email?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    id?: string;
    accessTokenExpires?: number;
  }
}

/**
 * バックエンドのトークンをリフレッシュする関数
 */
async function refreshAccessToken(token: any) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!baseUrl) {
      console.error("API_URL is not configured");
      throw new Error("API_URL is not configured");
    }

    const url = `${baseUrl}/auth/refresh/`;
    console.log("Refreshing token at:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token.accessToken}`,
        "Host": new URL(baseUrl).hostname,
      },
      credentials: "include", // クッキーを送信
    });

    console.log("Refresh response status:", response.status);

    if (!response.ok) {
      console.error("Failed to refresh token");
      throw new Error("Failed to refresh token");
    }

    const data: FastApiAuthResponse = await response.json();
    console.log("Token refreshed successfully");

    const tokenExpireMinutes = parseInt(process.env.NEXT_PUBLIC_TOKEN_EXPIRE_MINUTES || "60");
    const now = Math.floor(Date.now() / 1000);
    const accessTokenExpires = now + tokenExpireMinutes * 60;

    return {
      ...token,
      accessToken: data.access_token,
      id: String(data.user_id),
      name: data.name || data.email,
      email: data.email,
      accessTokenExpires,
    };
  } catch (error) {
    console.error("Error refreshing token:", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
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
        if (!credentials?.email || !credentials?.password) {
          console.error("Missing credentials");
          return null;
        }

        try {
          const baseUrl = process.env.NEXT_PUBLIC_API_URL;
          if (!baseUrl) {
            console.error("API_URL is not configured");
            return null;
          }

          const url = `${baseUrl}/auth/token/`;
          console.log("Auth endpoint:", url);

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Host": new URL(baseUrl).hostname,
            },
            credentials: "include", // クッキーを送受信
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          console.log("Auth response status:", response.status);

          if (!response.ok) {
            const ct = response.headers.get("content-type") || "";
            let errBody: any;
            try {
              errBody = ct.includes("application/json")
                ? await response.json()
                : await response.text();
            } catch (parseError) {
              console.error("Failed to parse error response:", parseError);
              errBody = await response.text();
            }
            console.error("FastAPI error:", errBody);
            return null;
          }

          const data: FastApiAuthResponse = await response.json();
          console.log("Auth response data:", JSON.stringify(data));

          if (!data.access_token || !data.user_id) {
            console.error("Missing fields. Received keys:", Object.keys(data || {}));
            return null;
          }

          const tokenExpireMinutes = parseInt(process.env.NEXT_PUBLIC_TOKEN_EXPIRE_MINUTES || "60");
          const now = Math.floor(Date.now() / 1000);
          const accessTokenExpires = now + tokenExpireMinutes * 60;

          return {
            id: String(data.user_id),
            name: data.name || data.email,
            email: data.email,
            accessToken: data.access_token,
            accessTokenExpires,
          };
        } catch (error) {
          console.error("Authorization error:", error);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // 初回ログイン時（userが存在する場合）
      if (user) {
        token.accessToken = (user as any).accessToken;
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.accessTokenExpires = (user as any).accessTokenExpires;
        return token;
      }

      // トークンリフレッシュエラーがある場合はそのまま返す
      if (token.error) {
        return token;
      }

      // トークンの有効期限をチェック
      const now = Math.floor(Date.now() / 1000);
      const accessTokenExpires = token.accessTokenExpires as number;

      // 有効期限が設定されていない場合（古いセッション）
      if (!accessTokenExpires) {
        console.log("No expiration time set, refreshing token");
        return refreshAccessToken(token);
      }

      // トークンの有効期限が5分以内に切れる場合は更新
      const shouldRefresh = accessTokenExpires - now < 5 * 60;
      
      if (shouldRefresh) {
        console.log("Token expiring soon, refreshing...");
        return refreshAccessToken(token);
      }

      // トークンがまだ有効な場合はそのまま返す
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.accessToken = (token.accessToken as string) || undefined;
        session.user.id = (token.id as string) || undefined;
        session.user.name = (token.name as string) || undefined;
        session.user.email = (token.email as string) || undefined;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  debug: process.env.NODE_ENV === "development",
};

export default NextAuth(authOptions);
