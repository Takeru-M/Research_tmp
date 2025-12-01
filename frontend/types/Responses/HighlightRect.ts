export interface HighlightRectInput {
  page_num: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface HighlightRectEntity extends HighlightRectInput {
  id?: number;
  highlight_id?: number;
}