export interface Comment {
  id: string;
  parentId: string | null;
  highlightId: string;
  author: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
}