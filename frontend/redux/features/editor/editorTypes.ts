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

// ハイライトオブジェクトの共通プロパティ
interface BaseHighlight {
  id: string;
  text: string;
  memo: string;
}

// テキストファイル用のハイライト型
export interface TextHighlight extends BaseHighlight {
  type: 'text';
  rangeInfo: SerializedRange;
}

// PDFファイル用のハイライト型
export interface PdfHighlight extends BaseHighlight {
  type: 'pdf';
  pageNum: number;
  rects: PdfRect[]; // 複数行にまたがる可能性を考慮し配列
}

// 全てのハイライトのユニオン型
export type Highlight = TextHighlight | PdfHighlight;

// エディタースライスの状態型
export interface EditorState {
  file: File | null;
  fileType: string | null;
  fileContent: string | null; // PDFの場合はBlob URL、テキストの場合は文字列
  highlights: Highlight[];
  activeHighlightId: string | null;
}