export interface DocumentResponse {
  id: number;
  user_id: number;
  document_name: string;
  stage: number;
  completion_stage?: number;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface DocumentEntity {
  id: number;
  document_name: string;
  owner_email?: string;
  stage?: number;
  completion_stage?: number;
  created_at?: string;
}

export interface UpdateCompletionStageResponse {
  id: number;
  completion_stage: number;
  updated_at: string;
}