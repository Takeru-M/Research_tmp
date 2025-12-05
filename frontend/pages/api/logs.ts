import type { NextApiRequest, NextApiResponse } from "next";
import { apiV1Client } from "@/utils/apiV1Client";
import { LogEntry, LogsResponse } from "@/types/Responses/Logs";

interface BatchLog {
  logs: LogEntry[];
  batchTimestamp: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const batchData = req.body as BatchLog;

    if (!batchData.logs || !Array.isArray(batchData.logs)) {
      return res.status(400).json({ detail: "Invalid log data format" });
    }

    const { data, error } = await apiV1Client<LogsResponse>("/logs", {
      method: "POST",
      body: batchData,
    });

    if (error || !data) {
      console.error("[Logs API] Backend error:", error);
      return res.status(500).json({ detail: error || "Failed to send logs" });
    }

    return res.status(200).json(data);
  } catch (e: any) {
    console.error("Error in logs API:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
}