// src/redux/features/editor/editorTypes.ts

// シリアライズされたRange情報の型
export interface SerializedRange {
  startContainerPath: number[];
  startOffset: number;
  endContainerPath: number[];
  endOffset: number;
}

// PDFハイライトの矩形情報の型 (PDF座標系)
export interface PdfRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// PDF上の矩形情報 + ページ番号
export interface PdfRectWithPage {
  pageNum: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  elementType?: 'image'|'shape'|'unknown';
  elementId?: string;
}

// ハイライトオブジェクトの共通プロパティ
interface BaseHighlight {
  id: string;
  text: string;
  memo: string;
  createdAt: string;
  createdBy: string;
  hasUserReply?: boolean;
}

// PDF （ページを跨げる）
export interface PdfHighlight extends BaseHighlight {
  type: 'pdf';
  rects: PdfRectWithPage[]; // ✅ pageNumを各rectと紐付け
}

// テキストファイル用のハイライト型
export interface TextHighlight extends BaseHighlight {
  type: 'text';
  rangeInfo: SerializedRange;
}

// 全てのハイライトのユニオン型
export type Highlight = TextHighlight | PdfHighlight;

// 💡 追加: コメントパネルのスクロールに必要な情報
export interface ScrollTarget {
    pdfY1: number;         // 選択されたハイライトの y1 (PDF座標)
    pageNum: number;       // ページ番号
    pageScale: number;     // そのページの現在のレンダリングスケール
    pageTopOffset: number; // そのページのDOM上端の、PDF Viewer上端からのピクセル距離
}
// ----------------------------------------------------

// エディタースライスの状態型
export interface EditorState {
  file: File | null;
  fileType: string | null;
  fileContent: string | ArrayBuffer | Uint8Array | null; // ★ Uint8Arrayを追加
  highlights: Highlight[];
  pdfHighlights: PdfHighlight[];
  textHighlights: TextHighlight[];
  comments: Comment[];
  activeHighlightId: string | null;
  activeCommentId: string | null;
  activeHighlightMemo: string | null;
  pdfTextContent: string | null;
  activeScrollTarget: ScrollTarget | null;
  pdfScale: number;
  responses: Record<string, string>;
  dividedMeetingTexts?: DividedMeetingTexts;
  completionStage: number;
}

export type Comment = {
  id: string;
  highlightId: string;
  parentId: string | null; // null = root comment in thread
  author: string;
  text: string;
  createdAt: string;
  editedAt?: string | null;
  deleted?: boolean;
};

export type HighlightInfo = {
  createdAt: string;
  createdBy: string;
  id: string;
  memo: string;
  rects: PdfRectWithPage[];
  text: string;
  type: 'pdf' | string;
}

export type HighlightCommentList = {
  id: string;
  highlightId: string;
  highlight: string;
  comment: string;
}[]

export type HighlightCommentsList = {
  id: string;
  highlightId: string;
  highlight: string;
  comments: {
    comment: string;
  }[];
}[]

export type DividedMeetingText = {
  id: number;
  text: string;
}

export type DividedMeetingTexts = DividedMeetingText[];

export type Project = {
  id: number;
  project_name: string;
  stage: number;
  created_at: string;
  updated_at: string | null;
};
