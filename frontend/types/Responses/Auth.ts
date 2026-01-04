export interface FastApiAuthResponse {
  access_token: string;
  token_type?: string;
  user_id: string;
  email: string;
  name: string;
  preferred_document_id?: number | null;
}

export interface SignupResponse {
  access_token: string;
  user_id: string;
  name: string;
  email: string;
}

export interface LoginResponse {
  access_token: string;
  user_id: string;
  name: string;
  email: string;
}