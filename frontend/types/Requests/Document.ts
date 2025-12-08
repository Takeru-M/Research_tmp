export interface DocumentCreateRequest {
  document_name: string;
  stage: number;
}

export interface DocumentUpdateRequest {
  document_name?: string;
  stage?: number;
  completion_stage?: number;
}

export interface UpdateCompletionStageRequest {
  completion_stage?: number;
}