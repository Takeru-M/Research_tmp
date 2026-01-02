export interface CreateHighlightRequest {
  document_file_id: number;
  created_by: string;
  memo: string;
  purpose?: number | null;
  text: string;
  rects: {
    page_num: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }[];
  element_type: string;
}