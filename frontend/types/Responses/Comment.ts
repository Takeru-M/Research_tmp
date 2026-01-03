export interface CommentCreateRequest {
  text: string;
  highlight_id: number;
  purpose?: number | null;
}

export interface CommentEntity {
  id: number;
  text: string;
  user_id: number;
  highlight_id?: number;
  created_at: string;
  updated_at: string;
}

export interface CommentDeleteResponse {
  message: string;
}

export interface CommentResponse {
  id: number;
  highlight_id: number;
  parent_id: number | null;
  author: string;
  text: string;
  purpose?: number | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  deleted_reason?: string | null;
}
