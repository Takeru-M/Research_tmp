// pages/api/signup.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { SignupRequest } from "@/types/Request";

const BACKEND_URL = process.env.NEXT_PUBLIC_FASTAPI_URL;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // 型チェックして必要なフィールドだけ送る
    const { username, email, password, confirm_password } = req.body as SignupRequest;

    if (!username || !email || !password || !confirm_password) {
      return res.status(400).json({ detail: "Missing required fields" });
    }

    const response = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, email, password, confirm_password }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(201).json(data);
  } catch (error: any) {
    console.error("Error in API route:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
