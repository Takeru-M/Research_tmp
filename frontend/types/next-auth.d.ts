import "next-auth";
import { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      name: string;
      email: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    name: string;
    email: string;
    fastApiToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    fastApiToken?: string;
    id?: string;
    name?: string;
    email?: string;
  }
}