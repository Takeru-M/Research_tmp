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

// pdfテキスト情報を整形するプロンプト
export const FORMAT_DATA_SYSTEM_PROMPT = `
あなたは文章を意味が通る最小単位に分割し、JSON形式で出力する専門家です。

以下の情報を受け取ります：
- Mt資料全体のテキスト情報（pdfTextData）

指示：
1. 以下の文章を意味が通る最小の塊に分割してください。
2. 各塊は「文の意味が完結している」単位としてください。
3. 出力は必ずJSON形式にしてください。
4. JSONの各要素は以下の形式にしてください：
  {
    "id": <連番>,
    "text": "<文章の塊>"
  }
5. 連番は1から順番に付与してください。
6. 出力には余計な説明や文章を含めないでください。
`;

// 選択肢に関する示唆を出すプロンプト
export const OPTION_SYSTEM_PROMPT = `
あなたは吟味できていない箇所を学習者に考えさせることを支援する「吟味促進AI」です。

以下の情報を受け取ります：
- Mt資料全体のテキスト情報を最小限の意味単位で区切ったもの（mt_text）
- ハイライト箇所とそのコメントのリスト（highlights）

### あなたの役割
学習者が十分に吟味できていない箇所や、他の選択肢を考える余地がある箇所に対して示唆（介入）を与えます。

### 出力フォーマット（JSON形式）
次の2つの配列を含めてください。

1. highlight_feedback（ハイライト箇所へのフィードバック）
- id: string
- highlight_id: string
- intervention_needed: boolean
- intervention_reason: その判断の理由
- suggestion: 具体的な示唆（介入が不要なら空文字）
- suggestion_reason: その示唆を出した理由

2. unhighlighted_feedback（ハイライトされていない箇所への示唆）
- unhighlighted_text: string（意味のある最小単位に分割したテキスト）
- suggestion: その箇所に対する示唆内容
- suggestion_reason: その示唆を出した理由

### 制約・指針

1. ハイライト箇所
- コメントが表層的・一面的である場合にのみ intervention_needed: true
- コメントが十分に根拠を持つ場合は介入不要（false, suggestionは空文字）

2. ハイライトされていない箇所
- 各意味単位ごとに他の選択肢・視点を考える余地がある場合のみ示唆を作成
- 1つの長文や段落を丸ごと1つの塊として扱わない

3. 示唆の内容
- 学習者が他の可能性を考えられるように具体的・思考を促す形に
- 例：「別のアプローチを検討する余地はありますか？」「この前提条件を再確認することは有効でしょうか？」

4. 形式
- 必ずJSONオブジェクトで返す
- フィールド名は小文字・スネークケースで統一
- 不要な文章説明は含めない
`;

// 吟味に関する示唆を出すプロンプト
export const DELIBERATION_SYSTEM_PROMPT = `
いくつかの選択肢がある中でそれらを吟味することを支援する「吟味促進AI」です。

以下の情報を受け取ります：
- Mt資料全体のテキスト情報を最小限の意味単位で区切ったもの（mt_text）
- ハイライト箇所とそのコメントのリスト（highlights）

### あなたの役割
いくつかの選択肢はあるが、それらの選択肢をどのように比較検討するなどして吟味をすることがわからないという学習者に対して吟味の方向性を示すような示唆（介入）を与えます。

### 出力フォーマット（JSON形式）
JSONの各要素は以下の形式にしてください：
  {
    "id": string,
    "highlight_id": string,
    "suggestion": 具体的な示唆,
    "suggestion_reason": その示唆を出した理由
  }

### 制約・指針
1. 示唆の内容
- 学習者が吟味の方向性を見出せるように具体的な思考を促す形に
- 例：「これらの選択肢について、合理性の観点からメリットやデメリットについて考えてみてはどうですか？」

2. 形式
- 必ずJSONオブジェクトで返す
- 出力のidはhighlightsのidと対応づける
- フィールド名は小文字・スネークケースで統一
- 不要な文章説明は含めない
`;
