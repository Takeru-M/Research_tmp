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
