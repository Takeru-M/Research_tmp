// src/pages/index.tsx
import React, { useCallback, useEffect, useState, ChangeEvent } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setFile,
  addHighlight,
  updateHighlightMemo,
  setActiveHighlightId,
  setAllHighlights,
} from '../redux/features/editor/editorSlice';
import {
  selectFile,
  selectFileType,
  selectFileContent,
  selectPdfHighlights,
  selectTextHighlights,
  selectActiveHighlightId,
  selectActiveHighlightMemo,
} from '../redux/features/editor/editorSelectors';
import { RootState, AppDispatch } from '../redux/store';
import { Highlight } from '../redux/features/editor/editorTypes';
import dynamic from 'next/dynamic';

const PdfViewer = dynamic(
  () => import('../ components/PdfViewer'), // 元の PdfViewer へのパス
  {
    // ★ 最も重要な設定: SSRを完全に無効にする
    ssr: false,

    // ロード中に表示するプレースホルダーを設定することもできます
    // loading: () => <p>PDFビューアをロード中...</p>,
  }
);
import TextViewer from '../ components/TextViewer';
import HighlightMemoModal from '../ components/HighlightMemoModal';
import styles from '../styles/Home.module.css';

const EditorPage: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();

  const file = useSelector(selectFile);
  const fileType = useSelector(selectFileType);
  const fileContent = useSelector(selectFileContent);
  const pdfHighlights = useSelector(selectPdfHighlights);
  const textHighlights = useSelector(selectTextHighlights);
  const activeHighlightId = useSelector(selectActiveHighlightId);
  const activeHighlightMemo = useSelector(selectActiveHighlightMemo);
  const allHighlights = useSelector((state: RootState) => state.editor.highlights);

  const [showMemoModal, setShowMemoModal] = useState<boolean>(false);

  useEffect(() => {
    const savedHighlights = localStorage.getItem('highlights');
    if (savedHighlights) {
      try {
        const parsedHighlights: Highlight[] = JSON.parse(savedHighlights);
        dispatch(setAllHighlights(parsedHighlights));
      } catch (error) {
        console.error("Failed to parse highlights from localStorage:", error);
      }
    }
  }, [dispatch]);

  useEffect(() => {
    if (allHighlights.length > 0 || localStorage.getItem('highlights')) {
      localStorage.setItem('highlights', JSON.stringify(allHighlights));
    }
  }, [allHighlights]);


  const handleFileUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      let content: string | null = null;
      if (uploadedFile.type === 'application/pdf') {
        content = URL.createObjectURL(uploadedFile);
        dispatch(setFile({ file: uploadedFile, fileType: uploadedFile.type, fileContent: content }));
      } else if (uploadedFile.type.startsWith('text/')) {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          content = e.target?.result as string;
          dispatch(setFile({ file: uploadedFile, fileType: uploadedFile.type, fileContent: content }));
        };
        reader.readAsText(uploadedFile);
      } else {
        alert('現在、PDFとテキストファイルのみサポートしています。');
        dispatch(setFile({ file: null, fileType: null, fileContent: null }));
      }
    }
  }, [dispatch]);

  const handleAddHighlight = useCallback((newHighlight: Highlight) => {
    dispatch(addHighlight(newHighlight));
  }, [dispatch]);

  const handleHighlightClick = useCallback((highlightId: string) => {
    dispatch(setActiveHighlightId(highlightId));
    setShowMemoModal(true);
  }, [dispatch]);

  const handleSaveMemo = useCallback((id: string, memo: string) => {
    dispatch(updateHighlightMemo({ id, memo }));
    setShowMemoModal(false);
    dispatch(setActiveHighlightId(null));
  }, [dispatch]);


  const renderViewer = () => {
    if (!file) return <p className={styles.emptyMessage}>ファイルをアップロードしてください</p>;

    if (fileType === 'application/pdf') {
      return (
        <PdfViewer
          file={fileContent}
          highlights={pdfHighlights}
          onAddHighlight={handleAddHighlight}
          onHighlightClick={handleHighlightClick}
        />
      );
    } else if (fileType && fileType.startsWith('text/')) {
      return (
        <TextViewer
          content={fileContent || ''}
          highlights={textHighlights}
          onAddHighlight={handleAddHighlight}
          onHighlightClick={handleHighlightClick}
        />
      );
    }
    return <p className={styles.emptyMessage}>このファイル形式はプレビューできません。</p>;
  };

  return (
    <div className={styles.container}>
      <div className={styles.fileInputSection}>
        <input type="file" onChange={handleFileUpload} accept=".pdf, .txt, text/*" />
      </div>

      <div className={styles.viewerContainer}>
        {renderViewer()}
      </div>

      {showMemoModal && (
        <HighlightMemoModal
          highlightId={activeHighlightId}
          currentMemo={activeHighlightMemo}
          onClose={() => {
            setShowMemoModal(false);
            dispatch(setActiveHighlightId(null));
          }}
          onSave={handleSaveMemo}
        />
      )}
    </div>
  );
};

export default EditorPage;