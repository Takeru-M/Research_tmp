export interface CommentCreateRequest {
  text: string;
  highlight_id: number;
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