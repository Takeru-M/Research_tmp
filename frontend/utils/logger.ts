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

interface BatchLog {
  logs: LogEntry[];
  batchTimestamp: string;
}

const LOG_ENDPOINT = `${process.env.NEXT_PUBLIC_API_URL_LOCAL}/logs`;

// バッチ処理の設定
const BATCH_SIZE = 30;
const BATCH_INTERVAL_MS = 60000;

// ログバッファとタイマー
let logBuffer: LogEntry[] = [];
let batchTimer: NodeJS.Timeout | null = null;

// SSR環境での実行判定
const isClient = typeof window !== 'undefined' && typeof navigator !== 'undefined';

async function sendBatch(): Promise<void> {
  if (!isClient || logBuffer.length === 0) return;

  const logsToSend = [...logBuffer];
  logBuffer = [];

  try {
    const batchData: BatchLog = {
      logs: logsToSend,
      batchTimestamp: new Date().toISOString(),
    };

    await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchData),
    }).catch((error) => {
      console.warn('[sendBatch] Network error:', error);
      // 失敗時はバッファに戻す
      logBuffer = [...logsToSend, ...logBuffer];
    });

    console.log(`[Logger] Batch sent: ${logsToSend.length} logs`);
  } catch (error) {
    console.error('[sendBatch] Error:', error);
    // 失敗時はバッファに戻す
    logBuffer = [...logsToSend, ...logBuffer];
  }
}

function scheduleBatchSend(): void {
  if (!isClient) return;

  // 既存のタイマーをクリア
  if (batchTimer) {
    clearTimeout(batchTimer);
  }

  // 新しいタイマーをセット（時間ベースの送信用）
  batchTimer = setTimeout(() => {
    sendBatch();
    batchTimer = null;
  }, BATCH_INTERVAL_MS);
}

function addLogToBuffer(log: LogEntry): void {
  if (!isClient) return;

  logBuffer.push(log);

  // バッファが満杯の場合は即座に送信
  if (logBuffer.length >= BATCH_SIZE) {
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }
    sendBatch();
  } else if (!batchTimer) {
    // タイマーがセットされていない場合はセット
    scheduleBatchSend();
  }
}

export function logUserAction(
  action: string,
  details?: Record<string, any>
): void {
  if (!isClient) return;

  const log: LogEntry = {
    timestamp: new Date().toISOString(),
    type: 'user_action',
    action,
    details,
    userAgent: navigator.userAgent,
    url: window.location.href,
  };
  console.log('[User Action]', log);
  addLogToBuffer(log);
}

export function logApiCall(
  method: string,
  path: string,
  status: number,
  duration: number
): void {
  if (!isClient) return;

  // 認証関連はログを送信しない（無限ループ防止）
  if (path.includes('/auth') || path.includes('/callback') || path.includes('/logs')) {
    return;
  }

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
  addLogToBuffer(log);
}

// ページ離脱時に残りのログを送信
if (isClient) {
  window.addEventListener('beforeunload', () => {
    if (logBuffer.length > 0) {
      sendBatch();
    }
  });
}