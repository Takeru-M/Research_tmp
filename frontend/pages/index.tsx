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
  setHighlights,
  setComments,
  setCompletionStage,
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
import { startLoading, stopLoading } from '../redux/features/loading/loadingSlice';

const PdfViewer = dynamic(() => import('../ components/PdfViewer'), { ssr: false });
// const TextViewer = dynamic(() => import('../ components/TextViewer'), { ssr: false });

// -----------------------------------------------------
// 既存の EditorPage のロジック部分をコンポーネントとして内包
const EditorPageContent: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession(); // セッション情報を取得

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
  const [isFileUploaded, setIsFileUploaded] = useState(false);
  const [currentFileId, setCurrentFileId] = useState<number | null>(null);

  // セッションからユーザー名を取得するヘルパー
  const getUserName = useCallback(() => {
    return session?.user?.name || t("CommentPanel.comment-author-user");
  }, [session, t]);

  // cookieからprojectIdを取得するヘルパー
  const getProjectIdFromCookie = (): number | null => {
    const match = document.cookie.match(/(?:^|; )projectId=(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  // ハイライトとコメントを取得
  const fetchHighlightsAndComments = useCallback(async (fileId: number) => {
    try {
      dispatch(startLoading('Loading highlights and comments...'));

      const response = await fetch(`/api/highlights/file/${fileId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch highlights and comments');
      }

      const data = await response.json();
      console.log('Fetched highlights and ALL comments:', data);

      // ハイライトの変換
      const highlights: PdfHighlight[] = data.map((item: any) => {
        const h = item.highlight;
        // highlight_id の代わりに id を使用
        const highlightId = h.id || h.highlight_id;
        
        if (!highlightId) {
          console.error('Missing highlight ID:', h);
          throw new Error('Highlight ID is missing');
        }

        return {
          id: highlightId.toString(),
          type: 'pdf',
          text: h.text || '',
          memo: h.memo || '',
          createdAt: h.created_at,
          createdBy: h.created_by || getUserName(),
          rects: h.rects.map((rect: any) => ({
            pageNumber: rect.page_num,
            x: rect.x1,
            y: rect.y1,
            width: rect.x2 - rect.x1,
            height: rect.y2 - rect.y1,
            pageNum: rect.page_num,
            x1: rect.x1,
            y1: rect.y1,
            x2: rect.x2,
            y2: rect.y2,
          })),
          elementType: h.rects[0]?.element_type || 'unknown',
        } as PdfHighlight;
      });

      console.log('Converted highlights:', highlights);
      dispatch(setHighlights(highlights));

      // コメントの変換（ハイライトに紐づく全コメント）
      const comments: CommentType[] = data.flatMap((item: any) => {
        const h = item.highlight;
        const hId = (h.id || h.highlight_id)?.toString();
        
        if (!hId) {
          console.error('Missing highlight ID for comments:', h);
          return [];
        }

        const list = Array.isArray(item.comments) ? item.comments : [];
        return list.map((c: any) => ({
          id: c.id.toString(),
          highlightId: hId,
          parentId: c.parent_id !== null && c.parent_id !== undefined ? c.parent_id.toString() : null,
          author: c.author || getUserName(),
          text: c.text,
          createdAt: c.created_at,
          editedAt: c.updated_at || null,
          deleted: false,
        }));
      });

      console.log('Converted ALL comments:', comments);
      dispatch(setComments(comments));
    } catch (error: any) {
      console.error('Failed to load highlights and comments:', error.message);
      alert(t('Error.load-highlights-failed') || 'ハイライトとコメントの読み込みに失敗しました');
    } finally {
      dispatch(stopLoading());
    }
  }, [dispatch, getUserName, t]);

  // プロジェクトのファイルを取得
  const fetchProjectFile = useCallback(async (projectId: number) => {
    try {
      dispatch(startLoading('Loading project file...'));

      const response = await fetch(`/api/project-files/${projectId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch project files');
      }

      const files = await response.json();
      console.log('Fetched files:', files);
      
      if (!files || files.length === 0) {
        console.log('No files found for this project');
        setIsFileUploaded(false);
        return;
      }

      const latestFile = files[0];
      console.log('Latest file:', latestFile);
      setCurrentFileId(latestFile.id);

      const fileResponse = await fetch(`/api/s3/get-file?key=${encodeURIComponent(latestFile.file_key)}`);
      
      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        console.error('S3 fetch error:', fileResponse.status, errorText);
        throw new Error(`Failed to fetch file from S3: ${fileResponse.status}`);
      }

      const blob = await fileResponse.blob();
      console.log('Blob received:', blob.size, 'bytes, type:', blob.type);
      
      // BlobからFileオブジェクトを作成
      const file = new File([blob], latestFile.file_name, { 
        type: latestFile.mime_type || 'application/pdf' 
      });

      // FileオブジェクトまたはURL文字列として保存
      // react-pdfはFile, Blob, ArrayBuffer, URL文字列をサポート
      const fileUrl = URL.createObjectURL(blob);

      dispatch(setFile({
        file: null, // ← File は保存しない
        fileType: latestFile.mime_type || 'application/pdf',
        fileContent: fileUrl // ← Object URL (string) を渡す
      }));

      console.log('File saved to Redux');
      setIsFileUploaded(true);

      await fetchHighlightsAndComments(latestFile.id);

    } catch (error: any) {
      console.error('Failed to load project file:', error);
      console.error('Error stack:', error.stack);
      alert(`Failed to load file: ${error.message}`);
      setIsFileUploaded(false);
    } finally {
      dispatch(stopLoading());
    }
  }, [dispatch, fetchHighlightsAndComments]);

  // プロジェクト情報の取得（stageをReduxへ反映）
  const fetchProjectInfo = useCallback(async (projectId: number) => {
    try {
      dispatch(startLoading('Loading project info...'));

      const res = await fetch(`/api/projects/${projectId}/projects`);
      if (!res.ok) {
        throw new Error('Failed to fetch project info');
      }
      const data = await res.json();
      const stage = data?.stage;

      if (stage !== null && !Number.isNaN(stage)) {
        dispatch(setCompletionStage(stage));
      } else {
        console.warn('Project info does not include a valid stage:', data);
      }
    } catch (err: any) {
      console.error('Failed to load project info:', err.message);
    } finally {
      dispatch(stopLoading());
    }
  }, [dispatch]);

  // コンポーネントマウント時にプロジェクト情報とファイルを取得（stageはバックエンドからのみ）
  useEffect(() => {
    const projectId = getProjectIdFromCookie();
    if (projectId) {
      // プロジェクト情報（stage）取得
      fetchProjectInfo(projectId);
      // プロジェクトの最新ファイル取得
      fetchProjectFile(projectId);
    } else {
      console.warn('No project ID found in cookies');
      router.push('/projects');
    }
  }, [fetchProjectInfo, fetchProjectFile, router, dispatch]);

  // ---------------------------
  // S3アップロード + バックエンド保存
  // ---------------------------
  const uploadPdfToS3AndSave = async (file: File, filetype: string, filesize: number) => {
    if (!file) return;

    // 既にファイルがアップロード済みの場合は処理を中断
    if (isFileUploaded) {
      alert(t('Alert.file-already-uploaded') || 'ファイルは既にアップロード済みです');
      return;
    }

    dispatch(startLoading('Uploading PDF...'));

    try {
      // 1. Next.js API 経由で FastAPI に送信
      const formData = new FormData();
      formData.append('file', file);

      const s3Response = await fetch('/api/s3/upload', {
        method: 'POST',
        body: formData,
      });

      if (!s3Response.ok) {
        const errorData = await s3Response.json();
        throw new Error(errorData.message || 'Failed to upload PDF');
      }

      const s3Data = await s3Response.json();
      console.log('PDF uploaded to S3 via Next.js API:', s3Data);

      const project_id = getProjectIdFromCookie();
      if (!project_id) throw new Error('Project ID not found in cookies');

      console.log('Preparing to save:', {
        project_id,
        file_name: file.name,
        file_key: s3Data.s3_key,
        file_url: s3Data.s3_url,
        mime_type: filetype,
        file_size: filesize
      });

      // 2. DB保存（Next.js API経由）
      const dbResponse = await fetch('/api/project-files/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: parseInt(project_id.toString(), 10),
          file_name: file.name,
          file_key: s3Data.s3_key,
          file_url: s3Data.s3_url,
          mime_type: filetype,
          file_size: filesize,
        }),
      });

      if (!dbResponse.ok) {
        const errorData = await dbResponse.json();
        console.error('DB save error:', errorData);
        throw new Error(errorData.message || 'Failed to save PDF to DB');
      }

      const dbData = await dbResponse.json();
      console.log('PDF saved to DB:', dbData);

      // アップロード成功後、フラグを立てる
      setIsFileUploaded(true);

    } catch (error: any) {
      console.error('PDF upload/save failed:', error.message);
      alert(`Upload failed: ${error.message}`);
    } finally {
      dispatch(stopLoading());
    }
  };

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
      // 既にファイルがアップロード済みの場合は処理を中断
      if (isFileUploaded) {
        alert(t('Alert.file-already-uploaded') || 'ファイルは既にアップロード済みです');
        event.target.value = ''; // input をリセット
        return;
      }

      const uploadedFile = event.target.files?.[0];
      if (!uploadedFile) return;

      if (uploadedFile.type === 'application/pdf') {
        uploadPdfToS3AndSave(uploadedFile, uploadedFile.type, uploadedFile.size);
        const content = URL.createObjectURL(uploadedFile);
        dispatch(setFile({
          file: null,
          fileType: uploadedFile.type,
          fileContent: content
        }));
      } else if (uploadedFile.type.startsWith('text/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          dispatch(setFile({
            file: null, // ← File を保存しない
            fileType: uploadedFile.type,
            fileContent: (e.target?.result as string) ?? ''
          }));
          setIsFileUploaded(true);
        };
        reader.readAsText(uploadedFile);
      } else {
        alert(t("Alert.file-support"));
      }
    },
    [dispatch, t, isFileUploaded]
  );

  // === Request highlight (open memo modal) ===
  const handleRequestAddHighlight = useCallback((h: PdfHighlight) => {
    setPendingHighlight(h);
    dispatch(setActiveHighlightId(h.id));
    setShowMemoModal(true);
  }, [dispatch]);

  // === Save memo + add highlight + add root comment ===
  const handleSaveMemo = useCallback(
    async (id: string, memo: string) => {
      if (pendingHighlight && pendingHighlight.id === id) {
        try {
          dispatch(startLoading('Saving highlight and memo...'));

          const projectId = getProjectIdFromCookie();
          if (!projectId) {
            throw new Error('Project ID not found');
          }

          const userName = getUserName(); // セッションからユーザー名を取得

          // バックエンドにハイライトとメモを保存
          const response = await fetch('/api/highlights/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              project_file_id: currentFileId, // projectIdではなくcurrentFileIdを使用
              created_by: userName,
              memo: memo.trim(),
              text: pendingHighlight.text || '',
              rects: pendingHighlight.rects.map(rect => ({
                page_num: rect.pageNum,
                x1: rect.x1,
                y1: rect.y1,
                x2: rect.x2,
                y2: rect.y2,
              })),
              element_type: pendingHighlight.elementType || 'pdf',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save highlight');
          }

          const savedHighlight = await response.json();
          console.log('Highlight saved:', savedHighlight);
          
          if (!savedHighlight.id) {
            throw new Error('Highlight ID is missing in response');
          }

          // Reduxストアに追加
          const finalHighlight: Highlight = {
            ...pendingHighlight,
            id: savedHighlight.id.toString(),
            memo,
            createdAt: savedHighlight.created_at,
            createdBy: userName,
          };

          const rootComment: CommentType = {
            id: savedHighlight.comment_id.toString(),
            highlightId: savedHighlight.id.toString(),
            parentId: null,
            author: userName,
            text: memo.trim(),
            createdAt: savedHighlight.created_at,
            editedAt: null,
            deleted: false,
          };

          dispatch(addHighlightWithComment({ highlight: finalHighlight, initialComment: rootComment }));

          setPendingHighlight(null);
          setShowMemoModal(false);
          dispatch(setActiveHighlightId(null));
          
          dispatch(stopLoading());
          return;

        } catch (error: any) {
          console.error('Failed to save highlight:', error);
          alert(t('Error.save-highlight-failed') || 'ハイライトの保存に失敗しました');
          dispatch(stopLoading());
          return;
        }
      }

      // 既存のハイライトのメモ更新
      dispatch(updateHighlightMemo({ id, memo }));
      setShowMemoModal(false);
      dispatch(setActiveHighlightId(null));
    },
    [dispatch, pendingHighlight, getUserName, t, currentFileId]
  );

  // === Highlight Click ===
  const handleHighlightClick = useCallback((highlightId: string) => {
    dispatch(setActiveHighlightId(highlightId));
  }, [dispatch]);

  // === Viewer ===
  const renderViewer = () => {
    // 判定を file ではなく fileContent に変更
    if (!fileContent) return <p>{t("file-upload-txt")}</p>;

    if (fileType && fileType.includes('pdf')) {
      // デバッグ用ログ
      console.log('Rendering PdfViewer with highlights:', pdfHighlights);
      console.log('Number of highlights:', pdfHighlights.length);

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
        {/* ファイルアップロード済みの場合は表示しない */}
        {!isFileUploaded && (
          <div className={styles.fileInputSection}>
            <input type="file" onChange={handleFileUpload} accept=".pdf, .txt, text/*" />
          </div>
        )}

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