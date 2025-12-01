import { HighlightRectInput, HighlightRectEntity } from './HighlightRect';

export interface HighlightCreatePayload {
  project_file_id: number;
  created_by: string;
  memo: string;
  text: string | null;
  rects: HighlightRectInput[];
  element_type: string;
}

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

export interface HighlightDeleteResponse {
  message: string;
}