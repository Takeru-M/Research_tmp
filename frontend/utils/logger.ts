interface LogEntry {
  timestamp: string;
  type: 'user_action';
  action?: string;
  details?: Record<string, any>;
  userAgent: string;
  url: string;
}

interface BatchLog {
  logs: LogEntry[];
  batchTimestamp: string;
}

// Next.jsのAPIルートを経由（ブラウザからは /api/logs にアクセス）
const LOG_ENDPOINT = '/api/logs';

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

    const response = await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchData),
    });

    if (!response.ok) {
      console.error(`[sendBatch] Server error: ${response.status}`, await response.text());
      // 失敗時はバッファに戻す
      logBuffer = [...logsToSend, ...logBuffer];
      return;
    }

    const result = await response.json();
    console.log(`[Logger] Batch sent successfully:`, result);
  } catch (error) {
    console.error('[sendBatch] Network error:', error);
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

// ページ離脱時に残りのログを送信
if (isClient) {
  window.addEventListener('beforeunload', () => {
    if (logBuffer.length > 0) {
      sendBatch();
    }
  });
}