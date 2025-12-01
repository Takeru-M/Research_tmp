export interface ProjectResponse {
  id: number;
  project_name: string;
  owner_email: string;
  created_at: string;
  stage?: number | null;
  completion_stage?: number | null;
}

export interface ProjectEntity {
  id: number;
  project_name: string;
  owner_email?: string;
  stage?: number | null;
  completion_stage?: number | null;
  created_at?: string;
}

export interface UpdateCompletionStageResponse {
  id: number;
  completion_stage: number;
  updated_at: string;
}