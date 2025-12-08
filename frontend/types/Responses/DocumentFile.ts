export interface DocumentFile {
  id: number;
  document_id: number;
  file_name: string;
  s3_key: string;
  uploaded_at: string;
}

export interface SaveFileRequest {
  document_id: number;
  file_name: string;
  file_key: string;
  file_url?: string | null;
  mime_type?: string;
  file_size?: number | null;
}

export interface SavedFileResponse {
  id: number;
  document_id: number;
  file_name: string;
  s3_key: string;
  uploaded_at: string;
}