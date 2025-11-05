// src/redux/features/editor/editorSlice.ts (修正後)

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { EditorState, Highlight, Comment } from './editorTypes';

const initialState: EditorState = {
  file: null,
  fileType: null,
  fileContent: null,
  highlights: [],
  comments: [],
  activeHighlightId: null,
  activeCommentId: null,
  activeHighlightMemo: null,
  // ★ 修正1: PDFの全テキストを格納する状態を追加
  pdfTextContent: null as string | null,
  responses: {} as Record<string, string>,
};

// EditorStateの定義も外部ファイルで更新が必要です
/* // src/redux/features/editor/editorTypes.ts (想定される追加)
export interface EditorState {
  // ... 既存のフィールド
  pdfTextContent: string | null;
}
*/

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setFile(state, action: PayloadAction<{ file: File | null; fileType: string | null; fileContent: string | null }>) {
      state.file = action.payload.file;
      state.fileType = action.payload.fileType;
      state.fileContent = action.payload.fileContent;
      state.pdfTextContent = null;
    },

    setPdfTextContent(state, action: PayloadAction<string>) {
      state.pdfTextContent = action.payload;
    },

    // === Highlights ===
    // ... (既存の reducer は変更なし)
    addHighlight(state, action: PayloadAction<Highlight>) {
      state.highlights.push(action.payload);
    },

    addHighlightWithComment(
      state,
      action: PayloadAction<{
        highlight: Highlight;
        initialComment?: { id?: string; author: string; text: string; createdAt?: string };
      }>
    ) {
      const { highlight, initialComment } = action.payload;
      state.highlights.push(highlight);

      if (initialComment && initialComment.text && initialComment.text.trim().length > 0) {
        const cid = initialComment.id ?? `comment-${Date.now()}`;
        const c: Comment = {
          id: cid,
          highlightId: (highlight as any).id,
          parentId: null,
          author: initialComment.author,
          text: initialComment.text,
          createdAt: initialComment.createdAt ?? new Date().toISOString(),
          editedAt: null,
          deleted: false,
        };
        state.comments.push(c);
        state.activeCommentId = cid;
        state.activeHighlightId = (highlight as any).id;
      }
    },

    setAllHighlights(state, action: PayloadAction<Highlight[]>) {
      state.highlights = action.payload;
    },
    updateHighlightMemo(state, action: PayloadAction<{ id: string; memo: string }>) {
      const h = state.highlights.find((x) => x.id === action.payload.id);
      if (h) h.memo = action.payload.memo;
    },
    deleteHighlight(state, action: PayloadAction<{ id: string }>) {
      const id = action.payload.id;
      state.highlights = state.highlights.filter((h) => h.id !== id);
      const removedCommentIds = state.comments.filter((c) => c.highlightId === id).map((c) => c.id);
      state.comments = state.comments.filter((c) => c.highlightId !== id);
      if (state.activeHighlightId === id) state.activeHighlightId = null;
      if (state.activeCommentId && removedCommentIds.includes(state.activeCommentId)) {
        state.activeCommentId = null;
      }
    },

    // === Comments ===
    // ... (既存の reducer は変更なし)
    addComment(state, action: PayloadAction<Comment>) {
      state.comments.push(action.payload);
    },
    setAllComments(state, action: PayloadAction<Comment[]>) {
      state.comments = action.payload;
    },
    updateComment(state, action: PayloadAction<{ id: string; text: string }>) {
      const c = state.comments.find((x) => x.id === action.payload.id);
      if (c) {
        c.text = action.payload.text;
        c.editedAt = new Date().toISOString();
      }
    },
    deleteComment(state, action: PayloadAction<{ id: string }>) {
      const id = action.payload.id;
      state.comments = state.comments.filter((c) => c.id !== id);
      if (state.activeCommentId === id) {
        state.activeCommentId = null;
      }
    },

    // === Active selections (UI sync) ===
    // ... (既存の reducer は変更なし)
    setActiveHighlightId(state, action: PayloadAction<string | null>) {
      state.activeHighlightId = action.payload;
      if (action.payload === null) state.activeCommentId = null;
    },
    setActiveCommentId(state, action: PayloadAction<string | null>) {
      state.activeCommentId = action.payload;
      if (action.payload) {
        const c = state.comments.find((x) => x.id === action.payload);
        if (c) state.activeHighlightId = c.highlightId;
      }
    },

    setActiveHighlightMemo(state, action: PayloadAction<string | null>) {
      state.activeHighlightMemo = action.payload;
    },

    clearAllState(state) {
      state.file = null;
      state.fileType = null;
      state.fileContent = null;
      state.highlights = [];
      state.comments = [];
      state.activeHighlightId = null;
      state.activeCommentId = null;
      state.activeHighlightMemo = null;
      state.pdfTextContent = null;
    },

    addLLMResponse: (state, action) => {
      const { id, response } = action.payload;
      state.responses[id] = response;
    },
  },
});

export const {
  setFile,
  setPdfTextContent,
  addHighlight,
  addHighlightWithComment,
  setAllHighlights,
  updateHighlightMemo,
  deleteHighlight,
  addComment,
  setAllComments,
  updateComment,
  deleteComment,
  setActiveHighlightId,
  setActiveCommentId,
  setActiveHighlightMemo,
  clearAllState,
  addLLMResponse
} = editorSlice.actions;

export default editorSlice.reducer;
