export interface SaveFileRequest {
  document_id: number;
  file_name: string;
  file_key: string;
  file_url?: string | null;
  mime_type?: string;
  file_size?: number | null;
}

export interface CreateDocumentFileRequest {
  document_id: number;
  file_name: string;
  file_key: string;
  file_url: string;
  mime_type: string;
  file_size: number;
}