/**
 * OpenAI分析APIのリクエスト/レスポンス型定義
 */

/**
 * ハイライトに紐づくコメント（スレッド内の単一コメント）
 */
export interface HighlightComment {
  id: string;
  parentId: string | null;
  author: string;
  text: string;
}

/**
 * ハイライトとそれに紐づくコメントスレッド
 */
export interface HighlightCommentThread {
  id: string;
  highlightId: string;
  highlight: string;
  comments: HighlightComment[];
}

/**
 * Option Analyze APIへのリクエスト形式
 */
export interface OptionAnalyzeRequest {
  mt_text: string;
  highlights: HighlightCommentThread[];
}

/**
 * Deliberation Analyze APIへのリクエスト形式
 */
export interface DeliberationAnalyzeRequest {
  mt_text: string;
  highlights: HighlightCommentThread[];
}
