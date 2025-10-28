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
import { Highlight, PdfHighlight } from '../redux/features/editor/editorTypes';
import dynamic from 'next/dynamic';
import HighlightMemoModal from '../ components/HighlightMemoModal';
import styles from '../styles/Home.module.css';
import HighlightMemoViewModal from '../ components/HighlightMemoViewModal';

const PdfViewer = dynamic(() => import('../ components/PdfViewer'), { ssr: false });
const TextViewer = dynamic(() => import('../ components/TextViewer'), { ssr: false });

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

  // モーダル制御
  const [showMemoModal, setShowMemoModal] = useState<boolean>(false); // 編集／新規メモ入力用
  const [showMemoView, setShowMemoView] = useState<boolean>(false); // 確認用

  // 新規ハイライト入力のための pending state
  const [pendingHighlight, setPendingHighlight] = useState<PdfHighlight | null>(null);

  // 起動時に localStorage からハイライトを読み込む
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

  // allHighlights を保存（注意: state 管理側ですでにやっているなら重複可）
  useEffect(() => {
    localStorage.setItem('highlights', JSON.stringify(allHighlights));
  }, [allHighlights]);

  const handleFileUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      if (uploadedFile.type === 'application/pdf') {
        const content = URL.createObjectURL(uploadedFile);
        dispatch(setFile({ file: uploadedFile, fileType: uploadedFile.type, fileContent: content }));
      } else if (uploadedFile.type.startsWith('text/')) {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          const content = e.target?.result as string;
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

  // PdfViewer から「新規ハイライト作成リクエスト」を受け取る（memo まだ空）
  const handleRequestAddHighlight = useCallback((h: PdfHighlight) => {
    // pending に置いてモーダルを開く（ユーザーにメモを入力させる）
    setPendingHighlight(h);
    // set active id so modal can reference it if needed
    dispatch(setActiveHighlightId(h.id));
    setShowMemoModal(true);
  }, [dispatch]);

  // ハイライトのメモを保存（モーダルの Save）
  const handleSaveMemo = useCallback((id: string, memo: string) => {
    // pendingHighlight がある場合はそれを最終的に追加する
    if (pendingHighlight && pendingHighlight.id === id) {
      const finalHighlight: Highlight = {
        ...pendingHighlight,
        memo,
      };
      dispatch(addHighlight(finalHighlight));
      setPendingHighlight(null);
      setShowMemoModal(false);
      dispatch(setActiveHighlightId(null));
      return;
    }

    // 既存ハイライトのメモ更新（編集モード）
    dispatch(updateHighlightMemo({ id, memo }));
    setShowMemoModal(false);
    dispatch(setActiveHighlightId(null));
  }, [dispatch, pendingHighlight]);

  // 既存ハイライトを右クリックで「メモを確認」したとき
  const handleHighlightClick = useCallback(
    (highlightId: string) => {
      const all = [...pdfHighlights, ...textHighlights];
      const target = all.find((h) => h.id === highlightId);
  
      if (target) {
        dispatch(setActiveHighlightId(highlightId));
        // Redux selectorの更新を待たず、直接メモ内容をセット
        dispatch(setActiveHighlightId(highlightId));
        // モーダルを表示
        setShowMemoView(true);
      }
    },
    [dispatch, pdfHighlights, textHighlights]
  );

  const renderViewer = () => {
    if (!file) return <p className={styles.emptyMessage}>ファイルをアップロードしてください</p>;

    if (fileType === 'application/pdf') {
      return (
        <PdfViewer
          file={fileContent}
          highlights={pdfHighlights}
          onAddHighlight={handleAddHighlight} // 既存ダミー追加など用
          onRequestAddHighlight={handleRequestAddHighlight} // 新規作成リクエスト用
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

      {/* 新規／編集用メモ入力モーダル */}
      {showMemoModal && (
        <HighlightMemoModal
          highlightId={pendingHighlight ? pendingHighlight.id : activeHighlightId}
          currentMemo={pendingHighlight ? pendingHighlight.memo : (activeHighlightMemo || '')}
          onClose={() => {
            setShowMemoModal(false);
            setPendingHighlight(null);
            dispatch(setActiveHighlightId(null));
          }}
          onSave={(id, memo) => handleSaveMemo(id, memo)}
        />
      )}

      {/* 確認用モーダル（右クリック → メモを確認） */}
      {showMemoView && activeHighlightId && (
  <HighlightMemoViewModal
    memo={
      [...pdfHighlights, ...textHighlights].find(h => h.id === activeHighlightId)?.memo || ''
    }
    onClose={() => {
      setShowMemoView(false);
      dispatch(setActiveHighlightId(null));
    }}
  />
)}
    </div>
  );
};

export default EditorPage;
