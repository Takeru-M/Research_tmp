import { apiClient } from '@/utils/apiClient';

interface LogEntry {
  timestamp: string;
  type: 'user_action';
  action?: string;
  details?: Record<string, any>;
  userAgent: string;
  url: string;
  userId?: string;
}

interface LLMAnalysisLog {
  timestamp: string;
  type: 'llm_analysis';
  analysisType: 'option_analyze' | 'deliberation_analyze' | 'option_dialogue' | 'deliberation_dialogue';
  userId?: string;
  documentId?: number;
  fileId?: number;
  highlightCount: number;
  commentCount: number;
  feedback: {
    highlight_feedback?: Array<{
      id: string;
      highlight_id: string;
      intervention_needed: boolean;
      intervention_reason: string;
      suggestion: string;
      suggestion_reason: string;
    }>;
    unhighlighted_feedback?: Array<{
      unhighlighted_text: string;
      suggestion: string;
      suggestion_reason: string;
    }>;
    dialogue_responses?: Array<{
      root_comment_id: string;
      response_text: string;
    }>;
  };
  userAgent: string;
  url: string;
}

interface BatchLog {
  logs: (LogEntry | LLMAnalysisLog)[];
  batchTimestamp: string;
}

// バッチ処理の設定
const BATCH_SIZE = 30;
const BATCH_INTERVAL_MS = 60000;

// ログバッファとタイマー
let logBuffer: (LogEntry | LLMAnalysisLog)[] = [];
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

    const { data, error } = await apiClient<{ success: boolean; message: string }>(
      '/logs/',
      {
        method: 'POST',
        body: batchData,
      }
    );

    if (error) {
      console.error(`[sendBatch] Server error:`, error);
      // 失敗時はバッファに戻す
      logBuffer = [...logsToSend, ...logBuffer];
      return;
    }

    console.log(`[Logger] Batch sent successfully:`, data);
  } catch (err) {
    console.error('[sendBatch] Network error:', err);
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

function addLogToBuffer(log: LogEntry | LLMAnalysisLog): void {
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
  details?: Record<string, any>,
  userId?: string
): void {
  if (!isClient) return;

  const log: LogEntry = {
    timestamp: new Date().toISOString(),
    type: 'user_action',
    action,
    details,
    userAgent: navigator.userAgent,
    url: window.location.href,
    userId,
  };
  console.log('[User Action]', log);
  addLogToBuffer(log);
}

export function logLLMAnalysis(
  analysisType: 'option_analyze' | 'deliberation_analyze' | 'option_dialogue' | 'deliberation_dialogue',
  feedback: LLMAnalysisLog['feedback'],
  userId?: string,
  documentId?: number,
  fileId?: number,
  highlightCount: number = 0,
  commentCount: number = 0
): void {
  if (!isClient) return;

  const log: LLMAnalysisLog = {
    timestamp: new Date().toISOString(),
    type: 'llm_analysis',
    analysisType,
    userId,
    documentId,
    fileId,
    highlightCount,
    commentCount,
    feedback,
    userAgent: navigator.userAgent,
    url: window.location.href,
  };
  console.log('[LLM Analysis]', log);
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