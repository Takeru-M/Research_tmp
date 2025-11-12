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
export const COLLAPSE_THRESHOLD = 3;
// コメントパネルに表示されるルートコメントのスレッド数の制限
export const ROOTS_COLLAPSE_THRESHOLD = 6;

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
export const MIN_PDF_WIDTH = 500;
// コメントパネルの最小幅 (px)
export const MIN_COMMENT_PANEL_WIDTH = 300;
// リサイズハンドルの幅 (px)
export const HANDLE_WIDTH = 8;
