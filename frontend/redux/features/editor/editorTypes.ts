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

// エディタースライスの状態型
export interface EditorState {
  file: File | null;
  fileType: string | null;
  fileContent: string | null; // PDFの場合はBlob URL、テキストの場合は文字列
  highlights: Highlight[];
  comments: Comment[]; // ここを追加
  activeHighlightId: string | null;
  activeCommentId: string | null,
  activeHighlightMemo: string | null;
  pdfTextContent: string | null;
  responses: Record<string, string>;
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