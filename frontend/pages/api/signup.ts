// pages/api/signup.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { apiV1Client } from "@/utils/apiV1Client";
import { SignupRequest } from "@/types/Requests/Auth";
import { SignupResponse } from "@/types/Responses/Auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { username, email, password, confirm_password } = req.body as SignupRequest;

    if (!username || !email || !password || !confirm_password) {
      return res.status(400).json({ detail: "Missing required fields" });
    }

    const { data, error } = await apiV1Client<SignupResponse>("/auth/signup", {
      method: "POST",
      body: { username, email, password, confirm_password },
    });

    if (error || !data) {
      return res.status(400).json({ detail: error || "Signup failed" });
    }

    return res.status(201).json(data);
  } catch (e: any) {
    console.error("Error in signup API:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
}
