export interface LogEntry {
  timestamp: string;
  type: "user_action";
  action?: string;
  details?: Record<string, any>;
  userAgent: string;
  url: string;
}

export interface LogsResponse {
  message: string;
  received_count: number;
}