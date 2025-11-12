// src/pages/index.tsx (最終修正版)
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
import { CSSProperties } from 'react'; // CSSPropertiesをインポート

// PdfViewerには、PDFのレンダリングが完了したことを通知する onRenderSuccess プロパティが追加されることを想定します。
// また、リサイズに対応するため、PdfViewerに width を渡せるように修正済みと仮定します。
const PdfViewer = dynamic(() => import('../ components/PdfViewer'), { ssr: false });
const TextViewer = dynamic(() => import('../ components/TextViewer'), { ssr: false });

const MIN_PDF_WIDTH = 500; // PDFビューアの最小幅 (px)
const MIN_COMMENT_PANEL_WIDTH = 300; // コメントパネルの最小幅 (px)
const HANDLE_WIDTH = 8; // リサイズハンドルの幅 (px)

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

  // --- リサイズ機能用のStateとRefを追加 ---
  const mainContainerRef = useRef<HTMLDivElement>(null);
  // 初期幅をビューポートの幅に基づいて設定（例: 70%）。初回マウント時に一度だけ計算
  const [pdfViewerWidth, setPdfViewerWidth] = useState(() => {
    if (typeof window === 'undefined') return 800;
    return Math.max(MIN_PDF_WIDTH, window.innerWidth * 0.7 - MIN_COMMENT_PANEL_WIDTH / 2);
  });
  const isResizing = useRef(false);
  // ------------------------------------

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
    const handleResize = () => {
        // ウィンドウリサイズ時にも高さを再測定
        measureHeight();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fileContent, fileType, measureHeight]); // measureHeightを依存配列に追加


  // --- リサイズハンドルのためのロジック ---

  // マウスダウン時の処理 (ドラッグ開始)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = 'none'; // テキスト選択防止
    document.body.style.cursor = 'col-resize'; // カーソル変更
  }, []);

  // マウス移動時の処理 (ドラッグ中)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !mainContainerRef.current) return;

    // メインコンテナの左端からの相対位置を計算
    const containerRect = mainContainerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;

    // 最大幅 (コンテナ幅 - コメントパネル最小幅 - ハンドル幅)
    const maxPdfWidth = containerRect.width - MIN_COMMENT_PANEL_WIDTH - HANDLE_WIDTH;

    // 最小/最大幅の制約
    const constrainedWidth = Math.max(MIN_PDF_WIDTH, Math.min(maxPdfWidth, newWidth));

    setPdfViewerWidth(constrainedWidth);
  }, []); // 依存配列は空でOK

  // マウスアップ時の処理 (ドラッグ終了)
  const handleMouseUp = useCallback(() => {
    if (isResizing.current) {
        isResizing.current = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        // ドラッグ終了後、高さを再測定
        measureHeight();
    }
  }, [measureHeight]);

  // グローバルなMouseMoveとMouseUpイベントを登録/解除
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ------------------------------------

  // === Outside click to reset selection ===
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // リサイズ中はクリックイベントを無視
      if (isResizing.current) return;
      
      if (!(e.target as HTMLElement).closest(".highlight, .comment-panel, .resize-handle")) {
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
        alert(t("Alert.file-support"));
      }
    },
    [dispatch, t]
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

  // === Viewer ===
  const renderViewer = () => {
    if (!file) return <p>{t("file-upload-txt")}</p>;

    if (fileType === 'application/pdf') {
      // PdfViewerに幅を制御する containerStyle を渡す
      const pdfViewerStyle: CSSProperties = { width: '100%', height: '100%' };

      return (
        <PdfViewer
          file={fileContent}
          highlights={pdfHighlights}
          comments={allComments}
          onRequestAddHighlight={handleRequestAddHighlight}
          onHighlightClick={handleHighlightClick}
          onRenderSuccess={handlePdfRenderComplete}
          containerStyle={pdfViewerStyle} // 修正点: containerStyleを追加
        />
      );
    }

    // 仮TODO: textファイルを扱う場合には実装
    // if (fileType?.startsWith("text/")) {
    //   return (
    //     <TextViewer
    //       content={fileContent || ''}
    //       highlights={textHighlights}
    //       onRequestAddHighlight={handleRequestAddHighlight}
    //       onHighlightClick={handleHighlightClick}
    //     />
    //   );
    // }

    return <p>{t("Error.file-format")}</p>;
  };

  // メインコンテナのレイアウト
  const mainLayoutStyle: CSSProperties = {
    display: "flex", 
    alignItems: "flex-start",
    width: '100%',
    overflowX: 'hidden',
    height: '100vh', // 画面いっぱいの高さを使用する想定
    padding: '0 2%', // 左右の余白はコンテナに移動
  };

  return (
    <div className={styles.container} style={mainLayoutStyle} ref={mainContainerRef}>
      
      {/* 1. PDFビューアエリア - 動的に幅を適用 */}
      <div 
        style={{
          width: pdfViewerWidth,
          minWidth: MIN_PDF_WIDTH,
          flexShrink: 0,
          paddingTop: "2%", // ファイルアップロードセクションのパディング
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className={styles.fileInputSection}>
          <input type="file" onChange={handleFileUpload} accept=".pdf, .txt, text/*" />
        </div>

        {/* Viewerコンテンツ部分 - 縦スクロールはPdfViewer内で処理される想定 */}
        <div className={styles.viewerContainer} ref={viewerContentRef} style={{ flexGrow: 1, overflow: 'hidden' }}>
          {renderViewer()}
        </div>
      </div>

      {/* 2. リサイズハンドル - クリック＆ドラッグで幅を変更 */}
      <div
        className="resize-handle"
        style={{
          width: HANDLE_WIDTH,
          minWidth: HANDLE_WIDTH,
          cursor: 'col-resize',
          backgroundColor: '#ddd',
          height: '100%',
          flexShrink: 0,
        }}
        onMouseDown={handleMouseDown}
      />

      {/* 3. コメントパネルエリア - 残りの幅を全て占める */}
      <div style={{ flexGrow: 1, minWidth: MIN_COMMENT_PANEL_WIDTH, height: '100%', overflowY: 'auto', paddingTop: "2%" }}>
        <CommentPanel currentUser="You" viewerHeight={viewerHeight} />
      </div>

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