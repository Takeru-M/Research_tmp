export interface FastApiAuthResponse {
  access_token: string;
  token_type?: string;
  user_id: number;
  email: string;
  name?: string;
}

export interface SignupResponse {
  id?: number;
  username?: string;
  email?: string;
  message?: string;
  detail?: string;
}