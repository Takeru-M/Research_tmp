import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const res = NextResponse.next();
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    return res;
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
      error: "/login",
    },
  }
);

export const config = {
  matcher: [
    /*
     * 以下のパスを除外:
     * - /login (ログインページ)
     * - /signup (サインアップページ)
     * - /api (APIルート)
     * - /_next (Next.jsの内部ファイル)
     * - /favicon.ico, /robots.txt などの静的ファイル
     */
    "/((?!login|signup|api|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};