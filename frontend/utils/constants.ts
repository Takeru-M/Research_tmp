// LLMに要求する出力形式
export const JSON_SAMPLE = {
  "responses": [
    {
      "id": "入力データのidと対応づける",
      "response": "レスポンス内容",
    },
  ]
}

// 個別のスレッド内の返信の折りたたみ閾値
export const COLLAPSE_THRESHOLD =  1;
// コメントパネルに表示されるルートコメントのスレッド数の制限
export const ROOTS_COLLAPSE_THRESHOLD = 4;

// pdf表示エリアの変更可能倍率一覧
export const SCALE_OPTIONS = [
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 1.0, label: '100%' },
  { value: 1.25, label: '125%' },
  { value: 1.5, label: '150%' },
  { value: 2.0, label: '200%' },
];

// PDFビューアの最小幅 (px)
export const MIN_PDF_WIDTH = 600;
// コメントパネルの最小幅 (px)
export const MIN_COMMENT_PANEL_WIDTH = 300;
// リサイズハンドルの幅 (px)
export const HANDLE_WIDTH = 8;

// ステージの種類
export const STAGE = {
  GIVE_OPTION_TIPS: 1,
  GIVE_DELIBERATION_TIPS: 2,
  GIVE_MORE_DELIBERATION_TIPS: 3,
  EXPORT: 4,
}

// ハイライトの色
export const HIGHLIGHT_COLOR = {
  USER_HIGHLIGHT_BASE: 'rgba(255, 235, 59, 0.40)',
  USER_HIGHLIGHT_ACTIVE: 'rgba(255, 235, 59, 0.65)',
  USER_HIGHLIGHT_BASE_BORDER: '#ffeb3b',
  USER_HIGHLIGHT_ACTIVE_BORDER: '#fbc02d',
  LLM_HIGHLIGHT_BASE: 'rgba(52, 168, 224, 0.30)',
  LLM_HIGHLIGHT_ACTIVE: 'rgba(52, 168, 224, 0.55)',
  LLM_HIGHLIGHT_BASE_BORDER: '#34a8e0',
  LLM_HIGHLIGHT_ACTIVE_BORDER: '#0288d1',
  ANSWER_HIGHLIGHT_BASE: 'rgba(76, 175, 80, 0.30)',
  ANSWER_HIGHLIGHT_ACTIVE: 'rgba(76, 175, 80, 0.55)',
  ANSWER_HIGHLIGHT_BASE_BORDER: '#4caf50',
  ANSWER_HIGHLIGHT_ACTIVE_BORDER: '#388e3c',
}