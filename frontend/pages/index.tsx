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
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import HighlightMemoModal from '../ components/HighlightMemoModal';
import CommentPanel from '../ components/CommentPanel';
import styles from '../styles/Home.module.css';
import { v4 as uuidv4 } from 'uuid';
import "../lang/config";
import { useTranslation } from "react-i18next";
import { CSSProperties } from 'react'; // CSSPropertiesをインポート
import { MIN_PDF_WIDTH, MIN_COMMENT_PANEL_WIDTH, HANDLE_WIDTH } from '@/utils/constants';
import LoginPage from './login';

const PdfViewer = dynamic(() => import('../ components/PdfViewer'), { ssr: false });
// const TextViewer = dynamic(() => import('../ components/TextViewer'), { ssr: false });

// -----------------------------------------------------
// 既存の EditorPage のロジック部分をコンポーネントとして内包
const EditorPageContent: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const { t } = useTranslation();

  const file = useSelector(selectFile);
  const fileType = useSelector(selectFileType);
  const fileContent = useSelector(selectFileContent);
  const pdfHighlights = useSelector(selectPdfHighlights);
  const activeHighlightId = useSelector(selectActiveHighlightId);
  const activeHighlightMemo = useSelector(selectActiveHighlightMemo);
  const allComments = useSelector(selectAllComments);

  const [showMemoModal, setShowMemoModal] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState<PdfHighlight | null>(null);
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
  }, []);

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
        console.log(pendingHighlight);
        const finalHighlight: Highlight = {
          ...pendingHighlight,
          memo,
          createdAt: new Date().toISOString(),
          createdBy: t("CommentPanel.comment-author-user"),
        };

        const rootComment: CommentType = {
          id: uuidv4(),
          highlightId: id,
          parentId: null,
          author: t("CommentPanel.comment-author-user"),
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
    [dispatch, pendingHighlight, t]
  );

  // === Highlight Click ===
  const handleHighlightClick = useCallback((highlightId: string) => {
    dispatch(setActiveHighlightId(highlightId));
  }, [dispatch]);

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
    padding: '0 2%',
  };

  return (
    <div className={styles.container} style={mainLayoutStyle} ref={mainContainerRef}>

      {/* 1. PDFビューアエリア - 動的に幅を適用 */}
      <div
        style={{
          width: pdfViewerWidth,
          minWidth: MIN_PDF_WIDTH,
          flexShrink: 0,
          paddingTop: "2%",
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className={styles.fileInputSection}>
          <input type="file" onChange={handleFileUpload} accept=".pdf, .txt, text/*" />
        </div>

        {/* Viewerコンテンツ部分 */}
        <div className={styles.viewerContainer} ref={viewerContentRef} style={{minWidth: MIN_PDF_WIDTH, overflowX: "auto",}}>
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
        <CommentPanel viewerHeight={viewerHeight} />
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

// -----------------------------------------------------

// ★ メインのエントリポイント (認証チェック)
const IndexPage: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading';

  // ロード中は何もしない
  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>;
  }

  // 未認証の場合はログインページへリダイレクト
  if (!isAuthenticated) {
    // router.push を使うことで、NextAuthの設定で指定したsignInページに飛ばす
    router.push('/login');
    return null;
  }

  // 認証済みであれば EditorPageContent を表示
  return <EditorPageContent />;
};

export default IndexPage;