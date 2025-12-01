export interface ProjectCreateRequest {
  project_name: string;
  stage: number;
}

export interface ProjectUpdateRequest {
  project_name?: string;
  stage?: number;
  completion_stage?: number;
}

export interface UpdateCompletionStageRequest {
  completion_stage?: number;
}