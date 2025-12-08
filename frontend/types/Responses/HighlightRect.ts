export interface HighlightRect {
  page_num: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  element_type?: string;
}

export interface HighlightRectEntity extends HighlightRect {
  id?: number;
  highlight_id?: number;
}
