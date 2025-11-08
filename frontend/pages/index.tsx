// src/pages/index.tsx
import React, { useCallback, useEffect, useState, ChangeEvent, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setFile,
  addHighlightWithComment,
  updateHighlightMemo,
  setActiveHighlightId,
  setActiveCommentId,
  deleteComment,
  deleteHighlight,
  updateComment,
} from '../redux/features/editor/editorSlice';

import {
  selectFile,
  selectFileType,
  selectFileContent,
  selectPdfHighlights,
  selectTextHighlights,
  selectActiveHighlightId,
  selectActiveHighlightMemo,
  selectAllComments,
} from '../redux/features/editor/editorSelectors';

import { RootState, AppDispatch } from '../redux/store';
import { Highlight, Comment as CommentType, PdfHighlight } from '../redux/features/editor/editorTypes';
import dynamic from 'next/dynamic';
import HighlightMemoModal from '../ components/HighlightMemoModal';
import CommentPanel from '../ components/CommentPanel';
import styles from '../styles/Home.module.css';
import { v4 as uuidv4 } from 'uuid';
import "../lang/config";
import { useTranslation } from "react-i18next";

// PdfViewerには、PDFのレンダリングが完了したことを通知する onRenderSuccess プロパティが追加されることを想定します。
const PdfViewer = dynamic(() => import('../ components/PdfViewer'), { ssr: false });
const TextViewer = dynamic(() => import('../ components/TextViewer'), { ssr: false });

const EditorPage: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const { t } = useTranslation();

  const file = useSelector(selectFile);
  const fileType = useSelector(selectFileType);
  const fileContent = useSelector(selectFileContent);
  const pdfHighlights = useSelector(selectPdfHighlights);
  const textHighlights = useSelector(selectTextHighlights);
  const activeHighlightId = useSelector(selectActiveHighlightId);
  const activeHighlightMemo = useSelector(selectActiveHighlightMemo);
  const allComments = useSelector(selectAllComments);

  const [showMemoModal, setShowMemoModal] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState<PdfHighlight | null>(null);

  const viewerContentRef = useRef<HTMLDivElement>(null);
  const [viewerHeight, setViewerHeight] = useState<number | 'auto'>(300);

  // PDFレンダリング完了後やリサイズ時に高さを測定するロジック
  const measureHeight = useCallback(() => {
    if (viewerContentRef.current) {
      // offsetHeight: パディングとボーダーを含む視覚的な高さを取得
      const height = viewerContentRef.current.offsetHeight;
      setViewerHeight(height);
    }
  }, []);

  // PDFビューアーがレンダリングを完了した際に呼ばれるコールバック
  const handlePdfRenderComplete = useCallback(() => {
      // レンダリング完了後、DOMが完全に更新されるのを待つため、setTimeoutで非同期に実行
      setTimeout(measureHeight, 0);
  }, [measureHeight]);

  useEffect(() => {
    // 初回ロード時とファイル切り替え時、およびリサイズ時の処理
    measureHeight();
    window.addEventListener('resize', measureHeight);
    return () => window.removeEventListener('resize', measureHeight);
  }, [fileContent, fileType, measureHeight]); // measureHeightを依存配列に追加

  // === Outside click to reset selection ===
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".highlight, .comment-panel")) {
        dispatch(setActiveHighlightId(null));
        dispatch(setActiveCommentId(null));
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dispatch]);

  // === Upload File ===
  const handleFileUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const uploadedFile = event.target.files?.[0];
      if (!uploadedFile) return;

      if (uploadedFile.type === 'application/pdf') {
        const content = URL.createObjectURL(uploadedFile);
        dispatch(setFile({ file: uploadedFile, fileType: uploadedFile.type, fileContent: content }));
      } else if (uploadedFile.type.startsWith('text/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          dispatch(setFile({ file: uploadedFile, fileType: uploadedFile.type, fileContent: e.target?.result as string }));
        };
        reader.readAsText(uploadedFile);
      } else {
        alert('現在、PDFとテキストファイルのみサポートしています。');
      }
    },
    [dispatch]
  );

  // === Request highlight (open memo modal) ===
  const handleRequestAddHighlight = useCallback((h: PdfHighlight) => {
    setPendingHighlight(h);
    dispatch(setActiveHighlightId(h.id));
    setShowMemoModal(true);
  }, [dispatch]);

  // === Save memo + add highlight + add root comment ===
  const handleSaveMemo = useCallback(
    (id: string, memo: string) => {
      if (pendingHighlight && pendingHighlight.id === id) {
        const finalHighlight: Highlight = {
          ...pendingHighlight,
          memo,
          createdAt: new Date().toISOString(),
          createdBy: 'You',
        };

        const rootComment: CommentType = {
          id: uuidv4(),
          highlightId: id,
          parentId: null,
          author: 'You',
          text: memo.trim(),
          createdAt: new Date().toISOString(),
          editedAt: null,
          deleted: false,
        };

        dispatch(addHighlightWithComment({ highlight: finalHighlight, initialComment: rootComment }));

        setPendingHighlight(null);
        setShowMemoModal(false);
        dispatch(setActiveHighlightId(null));
        return;
      }

      dispatch(updateHighlightMemo({ id, memo }));
      setShowMemoModal(false);
      dispatch(setActiveHighlightId(null));
    },
    [dispatch, pendingHighlight]
  );

  // === Highlight Click ===
  const handleHighlightClick = useCallback((highlightId: string) => {
    dispatch(setActiveHighlightId(highlightId));
  }, [dispatch]);

  // === Comment actions ===
  const handleDeleteComment = useCallback(
    (commentId: string) => {
      if (confirm('削除しますか？')) dispatch(deleteComment({ id: commentId }));
    },
    [dispatch]
  );

  const handleDeleteThread = useCallback(
    (highlightId: string) => {
      if (confirm('このスレッドを削除しますか？')) dispatch(deleteHighlight({ id: highlightId }));
    },
    [dispatch]
  );

  const handleAddReply = useCallback(
    (highlightId: string, parentId: string | null, author: string, text: string) => {
      const reply: CommentType = {
        id: uuidv4(),
        highlightId,
        parentId,
        author,
        text,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deleted: false,
      };
      dispatch(addHighlightWithComment as any); // no-op for replies (see CommentPanel own dispatch)
      dispatch({ type: "editor/addComment", payload: reply });
    },
    [dispatch]
  );

  const handleEditComment = useCallback(
    (id: string, newText: string) => {
      dispatch(updateComment({ id, text: newText }));
    },
    [dispatch]
  );

  // === Viewer ===
  const renderViewer = () => {
    if (!file) return <p>{t("file-upload-txt")}</p>;

    if (fileType === 'application/pdf') {
      return (
        <PdfViewer
          file={fileContent}
          highlights={pdfHighlights}
          comments={allComments}
          onRequestAddHighlight={handleRequestAddHighlight}
          onHighlightClick={handleHighlightClick}
          onRenderSuccess={handlePdfRenderComplete}
          onDeleteComment={handleDeleteComment}
          onDeleteThread={handleDeleteThread}
          onAddReply={handleAddReply}
          onEditComment={handleEditComment}
        />
      );
    }

    if (fileType?.startsWith("text/")) {
      return (
        <TextViewer
          content={fileContent || ''}
          highlights={textHighlights}
          onRequestAddHighlight={handleRequestAddHighlight}
          onHighlightClick={handleHighlightClick}
        />
      );
    }

    return <p>このファイル形式はプレビューできません。</p>;
  };

  return (
    <div className={styles.container} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <div className={styles.fileInputSection}>
          <input type="file" onChange={handleFileUpload} accept=".pdf, .txt, text/*" />
        </div>
        <div className={styles.viewerContainer} ref={viewerContentRef}>{renderViewer()}</div>
      </div>

      <CommentPanel currentUser="You" viewerHeight={viewerHeight} />

      {showMemoModal && (
        <HighlightMemoModal
          highlightId={pendingHighlight?.id || activeHighlightId}
          currentMemo={pendingHighlight?.memo || activeHighlightMemo || ''}
          onClose={() => {
            setShowMemoModal(false);
            setPendingHighlight(null);
            dispatch(setActiveHighlightId(null));
          }}
          onSave={handleSaveMemo}
        />
      )}
    </div>
  );
};

export default EditorPage;