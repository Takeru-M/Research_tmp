// src/redux/features/editor/editorSelectors.ts
import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../store'; // RootStateをインポート
import { Highlight, PdfHighlight, TextHighlight } from './editorTypes';

const selectEditorState = (state: RootState) => state.editor;

export const selectFile = createSelector(
  selectEditorState,
  (editor) => editor.file
);

export const selectFileType = createSelector(
  selectEditorState,
  (editor) => editor.fileType
);

export const selectFileContent = createSelector(
  selectEditorState,
  (editor) => editor.fileContent
);

export const selectHighlights = createSelector(
  selectEditorState,
  (editor) => editor.highlights
);

export const selectActiveHighlightId = createSelector(
  selectEditorState,
  (editor) => editor.activeHighlightId
);

export const selectPdfHighlights = createSelector(
  selectHighlights,
  (highlights): PdfHighlight[] => highlights.filter((h): h is PdfHighlight => h.type === 'pdf')
);

export const selectTextHighlights = createSelector(
  selectHighlights,
  (highlights): TextHighlight[] => highlights.filter((h): h is TextHighlight => h.type === 'text')
);

export const selectActiveHighlightMemo = createSelector(
  selectHighlights,
  selectActiveHighlightId,
  (highlights, activeId) => {
    const activeHighlight = highlights.find((h) => h.id === activeId);
    return activeHighlight ? activeHighlight.memo : '';
  }
);