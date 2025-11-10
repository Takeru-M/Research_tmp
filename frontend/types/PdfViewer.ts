import { PdfHighlight, Comment as CommentType } from "@/redux/features/editor/editorTypes";
import type { PageViewport } from 'pdfjs-dist';

export interface PageLoadData {
  width: number;
  height: number;
  viewport: PageViewport;
  textContent: string | null;
}

export interface PdfViewerProps {
  file: string | null;
  highlights: PdfHighlight[];
  comments: CommentType[];
  onRequestAddHighlight?: (highlight: PdfHighlight) => void;
  onHighlightClick?: (highlightId: string) => void;
  onRenderSuccess?: () => void;
}
