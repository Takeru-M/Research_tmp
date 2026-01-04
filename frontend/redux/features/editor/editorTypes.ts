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
  rects: PdfRectWithPage[];
}

// テキストファイル用のハイライト型
export interface TextHighlight extends BaseHighlight {
  type: 'text';
  rangeInfo: SerializedRange;
}

// 全てのハイライトのユニオン型
export type Highlight = TextHighlight | PdfHighlight;

// コメントパネルのスクロールに必要な情報
export interface ScrollTarget {
    viewerY: number;
    highlightId: string;
    pdfY1: number;         // 選択されたハイライトの y1 (PDF座標)
    pageNum: number;       // ページ番号
    pageScale: number;     // そのページの現在のレンダリングスケール
    pageTopOffset: number; // そのページのDOM上端の、PDF Viewer上端からのピクセル距離
}
// ----------------------------------------------------

// エディタースライスの状態型
export interface EditorState {
  file: File | null;
  fileId?: number | null;
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
  documentName?: string | null;
  completionStage: number;
  preferredDocumentId?: number | null;
  selectedRootCommentIds: string[];
  hasSoftDeletedLLMComment: boolean;
  lastLLMCommentRestoreTime: number | null;
  lastSoftDeleteFlagCheckTime: number | null;
}

export type Comment = {
  id: string;
  highlightId: string;
  parentId: string | null;
  author: string;
  text: string;
  created_at: string;
  purpose?: number | null;
  completion_stage?: number | null;
  edited_at?: string | null;
  deleted?: boolean;
  deleted_at?: string | null;
  deleted_reason?: string | null;
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

export type Document = {
  id: number;
  document_name: string;
  stage: number;
  created_at: string;
  updated_at: string | null;
};
