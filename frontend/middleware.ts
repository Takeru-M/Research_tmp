import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default withAuth(
  function middleware(req: NextRequest) {
    const response = NextResponse.next();

    // セキュリティヘッダーを設定
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );

    return response;
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        return !!token;
      },
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
     * - /login, /signup (認証ページ)
     * - /api (APIルート)
     * - /_next (Next.jsの内部ファイル)
     * - 静的ファイル (画像、フォントなど)
     */
    "/((?!login|signup|api|_next|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)).*)",
  ],
};