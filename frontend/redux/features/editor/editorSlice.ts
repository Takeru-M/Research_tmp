// src/redux/features/editor/editorSlice.ts (修正後)

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { EditorState, Highlight, Comment, ScrollTarget } from './editorTypes';
// import { v4 as uuidv4 } from 'uuid';

const initialState: EditorState = {
  file: null,
  fileType: null,
  fileContent: null,
  highlights: [],
  comments: [],
  activeHighlightId: null,
  activeCommentId: null,
  activeHighlightMemo: null,
  pdfTextContent: null as string | null,
  activeScrollTarget: null as ScrollTarget | null,
  pdfScale: 1.0,
  responses: {} as Record<string, string>,
};

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
        // uuidv4 を使用しない既存のロジックを維持 (ここでは Date.now() ベース)
        const cid = initialComment.id ?? `comment-${Date.now()}`; 
        const c: Comment = {
          id: cid,
          highlightId: highlight.id,
          parentId: null,
          author: initialComment.author,
          text: initialComment.text,
          createdAt: initialComment.createdAt ?? new Date().toISOString(),
          editedAt: null,
          deleted: false,
        };
        state.comments.push(c);
        state.activeCommentId = cid;
        state.activeHighlightId = highlight.id;
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
      // 💡 修正: activeScrollTarget のリセットを追加
      if (state.activeHighlightId === null) state.activeScrollTarget = null;
      if (state.activeCommentId && removedCommentIds.includes(state.activeCommentId)) {
        state.activeCommentId = null;
      }
    },

    // === Comments ===
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
        // 💡 修正: activeCommentId が null になったら activeScrollTarget もリセット
        state.activeScrollTarget = null;
      }
    },

    // === Active selections (UI sync) ===
    setActiveHighlightId(state, action: PayloadAction<string | null>) {
      state.activeHighlightId = action.payload;
      if (action.payload === null) {
        state.activeCommentId = null;
        // 💡 修正: activeHighlightId が null になったら activeScrollTarget もリセット
        state.activeScrollTarget = null;
      }
    },
    setActiveCommentId(state, action: PayloadAction<string | null>) {
      state.activeCommentId = action.payload;
      if (action.payload) {
        const c = state.comments.find((x) => x.id === action.payload);
        if (c) state.activeHighlightId = c.highlightId;
      } else {
        // 💡 修正: activeCommentId が null になったら activeScrollTarget もリセット
        state.activeScrollTarget = null;
      }
    },

    // 💡 修正2: 新しい reducer を追加 - スクロールターゲットの設定
    setActiveScrollTarget(state, action: PayloadAction<ScrollTarget | null>) {
      state.activeScrollTarget = action.payload;
    },

    setActiveHighlightMemo(state, action: PayloadAction<string | null>) {
      state.activeHighlightMemo = action.payload;
    },

    setPdfScale(state, action: PayloadAction<number>) {
      // 0.1 から 3.0 の範囲で制約を設けるなど、必要に応じて調整できます。
      state.pdfScale = action.payload;
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
      state.activeScrollTarget = null; // ★ 追加: リセット
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
  setActiveScrollTarget,
  setActiveHighlightMemo,
  setPdfScale,
  clearAllState,
  addLLMResponse,
} = editorSlice.actions;

export default editorSlice.reducer;