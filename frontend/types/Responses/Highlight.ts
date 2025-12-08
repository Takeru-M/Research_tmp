import { HighlightRect, HighlightRectEntity } from './HighlightRect';
import { CommentResponse } from './Comment';

export interface HighlightEntity {
  id: number;
  project_file_id: number;
  created_by: string;
  memo: string;
  text: string | null;
  element_type: string;
  created_at: string;
  rects: HighlightRectEntity[];
}

export interface CreateHighlightResponse {
  id: number;
  comment_id: number;
  document_file_id: number;
  text: string;
  memo: string;
  created_by: string;
  created_at: string;
}

export interface HighlightDeleteResponse {
  message: string;
}

export interface HighlightResponse {
  id: number;
  document_file_id: number;
  text: string;
  memo: string;
  created_by: string;
  created_at: string;
  rects: HighlightRect[];
}

export interface HighlightWithCommentsResponse {
  highlight: HighlightResponse;
  comments: CommentResponse[];
}