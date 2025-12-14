// src/redux/features/editor/editorSlice.ts (修正後)

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { EditorState, Highlight, Comment, ScrollTarget, PdfHighlight } from './editorTypes';
import { STAGE } from '@/utils/constants';

const initialState: EditorState = {
  file: null,
  fileId: null,
  fileType: null,
  fileContent: null,
  highlights: [],
  pdfHighlights: [],
  textHighlights: [], // 必要に応じて追加
  comments: [],
  activeHighlightId: null,
  activeCommentId: null,
  activeHighlightMemo: null,
  pdfTextContent: null as string | null,
  activeScrollTarget: null as ScrollTarget | null,
  pdfScale: 1.0,
  responses: {} as Record<string, string>,
  documentName: null,
  completionStage: STAGE.GIVE_OPTION_TIPS,
  selectedRootCommentIds: [] as string[],
  hasSoftDeletedLLMComment: false,
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setFile(
      state,
      action: PayloadAction<{
        file: File | null;
        fileType: string | null;
        fileContent: string | null;
        fileId?: number | null;
      }>
    ) {
      state.file = action.payload.file;
      state.fileType = action.payload.fileType;
      state.fileContent = action.payload.fileContent;
      state.fileId = action.payload.fileId !== undefined ? action.payload.fileId : state.fileId;
      state.pdfTextContent = null;
    },

    // fileIdのみを更新したい場合に使用
    setFileId(state, action: PayloadAction<number | null>) {
      state.fileId = action.payload;
    },

    setPdfTextContent(state, action: PayloadAction<string>) {
      state.pdfTextContent = action.payload;
    },

    // === Highlights ===
    addHighlight(state, action: PayloadAction<Highlight>) {
      state.highlights.push(action.payload);
      // type別に振り分け
      if (action.payload.type === 'pdf') {
        state.pdfHighlights.push(action.payload as PdfHighlight);
      }
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
      
      // type別に振り分け
      if (highlight.type === 'pdf') {
        state.pdfHighlights.push(highlight as PdfHighlight);
      }

      if (initialComment && initialComment.text && initialComment.text.trim().length > 0) {
        // uuidv4 を使用しない既存のロジックを維持 (ここでは Date.now() ベース)
        const cid = initialComment.id ?? `comment-${Date.now()}`; 
        const c: Comment = {
          id: cid,
          highlightId: highlight.id,
          parentId: null,
          author: initialComment.author,
          text: initialComment.text,
          created_at: initialComment.createdAt ?? new Date().toISOString(),
          edited_at: null,
          deleted: false,
        };
        state.comments.push(c);
        state.activeCommentId = cid;
        state.activeHighlightId = highlight.id;
      }
    },

    setAllHighlights(state, action: PayloadAction<Highlight[]>) {
      state.highlights = action.payload;
      // type別に振り分け
      state.pdfHighlights = action.payload.filter(h => h.type === 'pdf') as PdfHighlight[];
      state.textHighlights = action.payload.filter(h => h.type === 'text');
    },

    setHighlights: (state, action: PayloadAction<PdfHighlight[]>) => {
      state.pdfHighlights = action.payload;
      // highlightsにも追加
      state.highlights = [
        ...state.highlights.filter(h => h.type !== 'pdf'),
        ...action.payload
      ];
    },

    setComments: (state, action: PayloadAction<Comment[]>) => {
      state.comments = action.payload;
    },

    updateHighlightMemo(state, action: PayloadAction<{ id: string; memo: string }>) {
      const h = state.highlights.find((x) => x.id === action.payload.id);
      if (h) h.memo = action.payload.memo;
      
      // pdfHighlightsも更新
      const ph = state.pdfHighlights.find((x) => x.id === action.payload.id);
      if (ph) ph.memo = action.payload.memo;
    },

    deleteHighlight(state, action: PayloadAction<{ id: string }>) {
      const id = action.payload.id;
      state.highlights = state.highlights.filter((h) => h.id !== id);
      state.pdfHighlights = state.pdfHighlights.filter((h) => h.id !== id);
      
      const removedCommentIds = state.comments.filter((c) => c.highlightId === id).map((c) => c.id);
      state.comments = state.comments.filter((c) => c.highlightId !== id);
      if (state.activeHighlightId === id) state.activeHighlightId = null;
      if (state.activeHighlightId === null) state.activeScrollTarget = null;
      if (state.activeCommentId && removedCommentIds.includes(state.activeCommentId)) {
        state.activeCommentId = null;
      }
    },

    // === Comments ===
    addComment(state, action: PayloadAction<Comment>) {
      const newComment = action.payload;
      state.comments.push(newComment);

      // ✅ AIハイライトへのユーザー返信を検出
      if (newComment.highlightId && newComment.parentId) {
        const highlight = state.highlights.find(h => h.id === newComment.highlightId);
        const parentComment = state.comments.find(c => c.id === newComment.parentId);

        // 条件: ハイライトがAIで、親コメントがAIで、新規コメントがユーザー
        if (
          highlight &&
          highlight.createdBy === 'AI' &&
          parentComment &&
          parentComment.author === 'AI' &&
          newComment.author !== 'AI'  // ユーザーのコメント
        ) {
          highlight.hasUserReply = true;
          
          // pdfHighlightsも更新
          const pdfHighlight = state.pdfHighlights.find(h => h.id === newComment.highlightId);
          if (pdfHighlight) pdfHighlight.hasUserReply = true;
        }
      }
    },

    updateComment(state, action: PayloadAction<{ id: string; text: string }>) {
      const c = state.comments.find((x) => x.id === action.payload.id);
      if (c) {
        c.text = action.payload.text;
        c.edited_at = new Date().toISOString();
      }
    },

    deleteComment(state, action: PayloadAction<{ id: string }>) {
      const id = action.payload.id;
      const deletedComment = state.comments.find(c => c.id === id);

      state.comments = state.comments.filter((c) => c.id !== id);

      // 💡 新規追加: 削除されたコメントがAI返信への唯一のユーザー返信だった場合、フラグをリセット
      if (deletedComment && deletedComment.highlightId && deletedComment.author !== 'AI') {
        const highlight = state.highlights.find(h => h.id === deletedComment.highlightId);
        if (highlight && highlight.createdBy === 'AI') {
          // この親コメント配下に、ユーザーの返信がもう残っているか確認
          const parentComment = state.comments.find(c => c.id === deletedComment.parentId);
          if (parentComment && parentComment.author === 'AI') {
            const hasOtherUserReplies = state.comments.some(c =>
              c.highlightId === deletedComment.highlightId &&
              c.parentId === deletedComment.parentId &&
              c.author !== 'AI' &&
              c.id !== deletedComment.id
            );
            if (!hasOtherUserReplies) {
              highlight.hasUserReply = false;
              
              // pdfHighlightsも更新
              const pdfHighlight = state.pdfHighlights.find(h => h.id === deletedComment.highlightId);
              if (pdfHighlight) pdfHighlight.hasUserReply = false;
            }
          }
        }
      }

      if (state.activeCommentId === id) {
        state.activeCommentId = null;
        state.activeScrollTarget = null;
      }
    },

    // === Active selections (UI sync) ===
    setActiveHighlightId(state, action: PayloadAction<string | null>) {
      state.activeHighlightId = action.payload;
      if (action.payload === null) {
        state.activeCommentId = null;
        state.activeScrollTarget = null;
      }
    },

    setActiveCommentId(state, action: PayloadAction<string | null>) {
      state.activeCommentId = action.payload;
      if (action.payload) {
        const c = state.comments.find((x) => x.id === action.payload);
        if (c) state.activeHighlightId = c.highlightId;
      } else {
        state.activeScrollTarget = null;
      }
    },

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

    toggleSelectRootComment(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.selectedRootCommentIds.indexOf(id);
      if (idx >= 0) {
        state.selectedRootCommentIds.splice(idx, 1);
      } else {
        state.selectedRootCommentIds.push(id);
      }
    },
    clearSelectedRootComments(state) {
      state.selectedRootCommentIds = [];
    },

    clearAllState(state) {
      state.file = null;
      state.fileType = null;
      state.fileContent = null;
      state.fileId = null;
      state.highlights = [];
      state.pdfHighlights = [];
      state.textHighlights = [];
      state.comments = [];
      state.activeHighlightId = null;
      state.activeCommentId = null;
      state.activeHighlightMemo = null;
      state.pdfTextContent = null;
      state.activeScrollTarget = null;
      state.pdfScale = 1.0;
      state.responses = {};
      state.documentName = null;
      state.completionStage = STAGE.GIVE_OPTION_TIPS;
      state.selectedRootCommentIds = [];
    },

    addLLMResponse: (state, action) => {
      const { id, response } = action.payload;
      state.responses[id] = response;
    },

    setDocumentName(state, action: PayloadAction<string | null>) {
      state.documentName = action.payload;
    },

    setCompletionStage(state, action: PayloadAction<number>) {
      state.completionStage = action.payload;
    },

    setHasSoftDeletedLLMComment: (state, action: PayloadAction<boolean>) => {
      state.hasSoftDeletedLLMComment = action.payload;
    },
  },
});

export const {
  setFile,
  setFileId,
  setPdfTextContent,
  addHighlight,
  addHighlightWithComment,
  setAllHighlights,
  updateHighlightMemo,
  deleteHighlight,
  addComment,
  updateComment,
  deleteComment,
  setActiveHighlightId,
  setActiveCommentId,
  setActiveScrollTarget,
  setActiveHighlightMemo,
  setHighlights,
  setComments,
  setPdfScale,
  clearAllState,
  addLLMResponse,
  setDocumentName,
  setCompletionStage,
  setHasSoftDeletedLLMComment,
  toggleSelectRootComment,
  clearSelectedRootComments,
} = editorSlice.actions;

export default editorSlice.reducer;