export interface DocumentFile {
  id: number;
  document_id: number;
  file_name: string;
  s3_key: string;
  uploaded_at: string;
}

export interface DocumentFileResponse {
  id: number;
  document_id: number;
  file_name: string;
  file_key: string;
  file_url: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentFileResponse {
  id: number;
  document_id: number;
  file_name: string;
  file_key: string;
  file_url: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
  savedFile?: {
    id: number;
  };
}

export interface SavedFileResponse {
  id: number;
  document_id: number;
  file_name: string;
  s3_key: string;
  uploaded_at: string;
}