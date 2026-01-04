export interface FormatDataResponse {
  analysis: string;
}

export interface OptionAnalyzeResponse {
  analysis: string;
}

export interface DeliberationAnalyzeResponse {
  analysis: string;
}

export interface DialogueResponse {
  analysis: string;
}

export interface HighlightCreateResponse {
  id: number;
  created_at: string;
  comment_id: number;
}

export interface UpdateCompletionStageResponse {
  completion_stage?: number;
  stage?: number;
}