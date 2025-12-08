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
    fastApiToken?: string;
    id?: string;
  }
}

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

        const url = `${process.env.NEXT_PUBLIC_API_URL}`;
        try {
          const response = await fetch(
            `${url}/auth/token`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            }
          );

          if (!response.ok) {
            console.error("FastAPI Authentication failed:", response.statusText);
            return null;
          }

          const data: FastApiAuthResponse = await response.json();

          if (!data.access_token || !data.user_id) {
            console.error("Missing required fields in response");
            return null;
          }

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
    async jwt({ token, user }) {
      if (user) {
        token.fastApiToken = (user as any).fastApiToken;
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.accessToken = (token.fastApiToken as string) || undefined;
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
