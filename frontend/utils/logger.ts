interface LogEntry {
  timestamp: string;
  type: 'api' | 'user_action';
  method?: string;
  path?: string;
  status?: number;
  duration?: number;
  action?: string;
  details?: Record<string, any>;
  userAgent: string;
  url: string;
}

const LOG_ENDPOINT = `${process.env.NEXT_PUBLIC_API_URL}/logs`;

async function sendLog(log: LogEntry): Promise<void> {
  try {
    await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    }).catch(() => {
      // ログ送信失敗時もサイレント処理
    });
  } catch {}
}

export function logUserAction(
  action: string,
  details?: Record<string, any>
): void {
  const log: LogEntry = {
    timestamp: new Date().toISOString(),
    type: 'user_action',
    action,
    details,
    userAgent: navigator.userAgent,
    url: window.location.href,
  };
  console.log('[User Action]', log);
  sendLog(log);
}

export function logApiCall(
  method: string,
  path: string,
  status: number,
  duration: number
): void {
  const log: LogEntry = {
    timestamp: new Date().toISOString(),
    type: 'api',
    method,
    path,
    status,
    duration,
    userAgent: navigator.userAgent,
    url: window.location.href,
  };
  console.log('[API Call]', log);
  sendLog(log);
}