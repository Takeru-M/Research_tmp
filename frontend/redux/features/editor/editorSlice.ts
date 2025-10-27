// src/redux/features/editor/editorSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { EditorState, Highlight } from './editorTypes';

const initialState: EditorState = {
  file: null,
  fileType: null,
  fileContent: null,
  highlights: [],
  activeHighlightId: null,
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setFile: (
      state,
      action: PayloadAction<{ file: File | null; fileType: string | null; fileContent: string | null }>
    ) => {
      const { file, fileType, fileContent } = action.payload;
      state.file = file;
      state.fileType = fileType;
      state.fileContent = fileContent;
      state.highlights = []; // ファイルが変わったらハイライトをリセット
      state.activeHighlightId = null;
    },
    addHighlight: (state, action: PayloadAction<Highlight>) => {
      state.highlights.push(action.payload);
    },
    updateHighlightMemo: (state, action: PayloadAction<{ id: string; memo: string }>) => {
      const { id, memo } = action.payload;
      const existingHighlight = state.highlights.find(h => h.id === id);
      if (existingHighlight) {
        existingHighlight.memo = memo;
      }
    },
    setActiveHighlightId: (state, action: PayloadAction<string | null>) => {
      state.activeHighlightId = action.payload;
    },
    setAllHighlights: (state, action: PayloadAction<Highlight[]>) => {
      state.highlights = action.payload;
    },
    resetEditorState: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setFile,
  addHighlight,
  updateHighlightMemo,
  setActiveHighlightId,
  setAllHighlights,
  resetEditorState,
} = editorSlice.actions;

export default editorSlice.reducer;