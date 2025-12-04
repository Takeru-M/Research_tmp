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
  setFileId,
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
  selectFileId,
} from '../redux/features/editor/editorSelectors';

import { RootState, AppDispatch } from '../redux/store';
import { Highlight, Comment as CommentType, PdfHighlight } from '../redux/features/editor/editorTypes';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import HighlightMemoModal from '../components/HighlightMemoModal';
import CommentPanel from '../components/CommentPanel';
import styles from '../styles/Index.module.css';
import { v4 as uuidv4 } from 'uuid';
import "../lang/config";
import { useTranslation } from "react-i18next";
import { CSSProperties } from 'react';
import { MIN_PDF_WIDTH, MIN_COMMENT_PANEL_WIDTH, HANDLE_WIDTH } from '@/utils/constants';
import LoginPage from './login';
import { startLoading, stopLoading } from '../redux/features/loading/loadingSlice';
import { useSelector as useReduxSelector } from 'react-redux';
import LoadingOverlay from '../components/LoadingOverlay';
import { apiClient } from '@/utils/apiClient';
import { apiV1Client } from '@/utils/apiV1Client';
import { ErrorDisplay } from '../components/ErrorDisplay';

const PdfViewer = dynamic(() => import('../components/PdfViewer'), { ssr: false });

const EditorPageContent: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const isGlobalLoading = useReduxSelector((state: RootState) => state.loading.isLoading);
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession();

  const file = useSelector(selectFile);
  const fileType = useSelector(selectFileType);
  const fileContent = useSelector(selectFileContent);
  const pdfHighlights = useSelector(selectPdfHighlights);
  const activeHighlightId = useSelector(selectActiveHighlightId);
  const activeHighlightMemo = useSelector(selectActiveHighlightMemo);
  const allComments = useSelector(selectAllComments);
  const fileId = useSelector(selectFileId);

  const [showMemoModal, setShowMemoModal] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState<PdfHighlight | null>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const [isFileUploaded, setIsFileUploaded] = useState(false);
  const [currentFileId, setCurrentFileId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getUserName = useCallback(() => {
    return session?.user?.name || t("CommentPanel.comment-author-user");
  }, [session, t]);

  const getProjectIdFromCookie = (): number | null => {
    const match = document.cookie.match(/(?:^|; )projectId=(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  // ハイライトとコメントを取得
  const fetchHighlightsAndComments = useCallback(async (fileId: number) => {
    dispatch(startLoading('Loading highlights and comments...'));
    try {
      const { data: response, error, status } = await apiClient<any>(`/highlights/get-by-fileId/${fileId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (status === 404) {
        console.info('[fetchHighlightsAndComments] No highlights yet for fileId:', fileId);
        dispatch(setHighlights([]));
        dispatch(setComments([]));
        return;
      }

      if (error) {
        setErrorMessage(error);
        dispatch(setHighlights([]));
        dispatch(setComments([]));
        return;
      }

      if (!response) {
        console.warn('[fetchHighlightsAndComments] No response data for fileId:', fileId);
        dispatch(setHighlights([]));
        dispatch(setComments([]));
        return;
      }

      console.log('Fetched highlights and ALL comments:', response);

      const highlights: PdfHighlight[] = response.map((item: any) => {
        const h = item.highlight;
        const highlightId = h.id || h.highlight_id;
        if (!highlightId) {
          console.error('Missing highlight ID:', h);
          return null;
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
      }).filter(Boolean) as PdfHighlight[];

      console.log('Converted highlights:', highlights);
      dispatch(setHighlights(highlights));

      const comments: CommentType[] = response.flatMap((item: any) => {
        const h = item.highlight;
        const hId = (h.id || h.highlight_id)?.toString();
        if (!hId) return [];
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
    } finally {
      dispatch(stopLoading());
    }
  }, [dispatch, getUserName, session?.accessToken]);

  const fetchProjectFile = useCallback(async (projectId: number) => {
    dispatch(startLoading('Loading project file...'));
    try {
      const { data: response, error } = await apiClient<any>(`/project-files/${projectId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });

      if (error) {
        setErrorMessage(error);
        setIsFileUploaded(false);
        return;
      }

      if (!response || response.length === 0) {
        console.info('[fetchProjectFile] No files found for this project yet.');
        setIsFileUploaded(false);
        return;
      }

      const latestFile = response[0];
      dispatch(setFileId(latestFile.id));

      // S3からPDF本体取得もapiClientで（Blob）
      const { data: blobData, error: blobError } = await apiClient<Blob>(`/s3/get-file?key=${encodeURIComponent(latestFile.file_key)}`, {
        method: 'GET',
        responseType: 'blob',
      });

      if (blobError || !blobData) {
        setErrorMessage(blobError || 'Failed to fetch file from S3');
        setIsFileUploaded(false);
        return;
      }

      const fileUrl = URL.createObjectURL(blobData);

      dispatch(setFile({
        file: null,
        fileType: latestFile.mime_type || 'application/pdf',
        fileContent: fileUrl,
        fileId: latestFile.id,
      }));
      setIsFileUploaded(true);

      fetchHighlightsAndComments(latestFile.id);
    } finally {
      dispatch(stopLoading());
    }
  }, [dispatch, fetchHighlightsAndComments, session?.accessToken]);

  const fetchProjectInfo = useCallback(async (projectId: number) => {
    try {
      dispatch(startLoading('Loading project info...'));

      const { data: res, error } = await apiClient<any>(`/projects/${projectId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      // TODO: エラーハンドリングを適用
      if (error) {
        setErrorMessage(error);
        return;
      }

      // const { data: res, error } = await apiV1Client<any>(`/projects/${projectId}/`, {
      //   method: 'GET',
      //   headers: { Authorization: `Bearer ${session?.accessToken}` },
      // });
      // if (error) {
      //   setErrorMessage(error);
      //   return;
      // }

      const stage = res?.completion_stage ?? res?.stage ?? null;

      if (stage !== null && !Number.isNaN(stage)) {
        dispatch(setCompletionStage(stage));
      } else {
        console.warn('Project info does not include a valid stage:', res);
      }
    } finally {
      dispatch(stopLoading());
    }
  }, [dispatch, session?.accessToken]);

  useEffect(() => {
    const projectId = getProjectIdFromCookie();
    const isNewProject = router.query.new === 'true';
    
    if (projectId && !isNewProject) {
      fetchProjectInfo(projectId);
      fetchProjectFile(projectId);
    } else if (projectId && isNewProject) {
      fetchProjectInfo(projectId);
      console.log('New project created. Skipping file fetch.');
    } else {
      console.warn('No project ID found in cookies');
      router.push('/projects');
    }
  }, [fetchProjectInfo, fetchProjectFile, router]);

  // ---------------------------
  // S3アップロード + バックエンド保存
  // ---------------------------
  const uploadPdfToS3AndSave = useCallback(async (file: File, filetype: string, filesize: number) => {
    if (!file) return;

    if (isFileUploaded) {
      setErrorMessage(t('Alert.file-already-uploaded') || 'ファイルは既にアップロード済みです');
      return;
    }

    dispatch(startLoading('Uploading PDF...'));

    try {
      const formData = new FormData();
      formData.append('file', file);

      // S3アップロードをapiClientで
      const { data: s3Data, error: s3Error, status: s3Status } = await apiClient<any>('/s3/upload', {
        method: 'POST',
        body: formData,
      });

      if (s3Error || !s3Data) {
        setErrorMessage(s3Error || 'Failed to upload PDF');
        return;
      }
      if (s3Status >= 400) {
        setErrorMessage(s3Data?.detail || 'Failed to upload PDF');
        return;
      }

      const project_id = getProjectIdFromCookie();
      if (!project_id) {
        setErrorMessage('Project ID not found in cookies');
        return;
      }

      // DB保存
      const { data: dbResponse, error: dbError } = await apiClient<any>('/project-files/save', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: {
          project_id: parseInt(project_id.toString(), 10),
          file_name: file.name,
          file_key: s3Data.s3_key,
          file_url: s3Data.s3_url,
          mime_type: filetype,
          file_size: filesize,
        },
      });

      if (dbError || !dbResponse) {
        setErrorMessage(dbError || 'Failed to save file metadata');
        return;
      }

      dispatch(setFileId(dbResponse.id));
      dispatch(setFile({
        file: null,
        fileType: filetype,
        fileContent: URL.createObjectURL(file),
        fileId: dbResponse.savedFile?.id ?? dbResponse.id,
      }));
      setIsFileUploaded(true);
    } finally {
      dispatch(stopLoading());
    }
  }, [dispatch, t, isFileUploaded, session?.accessToken]);

  // 初期幅をビューポートの幅に基づいて設定（例: 70%）。初回マウント時に一度だけ計算
  const [pdfViewerWidth, setPdfViewerWidth] = useState(() => {
    if (typeof window === 'undefined') return 800;
    return Math.max(MIN_PDF_WIDTH, window.innerWidth * 0.7 - MIN_COMMENT_PANEL_WIDTH / 2);
  });
  const isResizing = useRef(false);

  const viewerContentRef = useRef<HTMLDivElement>(null);
  const [viewerHeight, setViewerHeight] = useState<number | 'auto'>(300);

  // PDFレンダリング完了後やリサイズ時に高さを測定するロジック
  const measureHeight = useCallback(() => {
    if (viewerContentRef.current) {
      const height = viewerContentRef.current.offsetHeight;
      setViewerHeight(height);
    }
  }, []);

  const handlePdfRenderComplete = useCallback(() => {
    setTimeout(measureHeight, 0);
  }, [measureHeight]);

  useEffect(() => {
    // 初回ロード時とファイル切り替え時、およびリサイズ時の処理
    measureHeight();
    const handleResize = () => {
      measureHeight();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fileContent, fileType, measureHeight]);

  // マウスダウン時の処理 (ドラッグ開始)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, []);

  // マウス移動時の処理 (ドラッグ中)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !mainContainerRef.current) return;

    const containerRect = mainContainerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    const maxPdfWidth = containerRect.width - MIN_COMMENT_PANEL_WIDTH - HANDLE_WIDTH;
    const constrainedWidth = Math.max(MIN_PDF_WIDTH, Math.min(maxPdfWidth, newWidth));

    setPdfViewerWidth(constrainedWidth);
  }, []);

  // マウスアップ時の処理 (ドラッグ終了)
  const handleMouseUp = useCallback(() => {
    if (isResizing.current) {
      isResizing.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
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
      if (isFileUploaded) {
        setErrorMessage(t('Alert.file-already-uploaded') || 'ファイルは既にアップロード済みです');
        event.target.value = '';
        return;
      }

      const uploadedFile = event.target.files?.[0];
      if (!uploadedFile) return;

      if (uploadedFile.type === 'application/pdf') {
        uploadPdfToS3AndSave(uploadedFile, uploadedFile.type, uploadedFile.size);
      } else if (uploadedFile.type.startsWith('text/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          dispatch(setFile({
            file: null,
            fileType: uploadedFile.type,
            fileContent: (e.target?.result as string) ?? '',
            fileId: null,
          }));
          setIsFileUploaded(true);
        };
        reader.readAsText(uploadedFile);
      } else {
        setErrorMessage(t("Alert.file-support"));
      }
    },
    [dispatch, t, isFileUploaded, uploadPdfToS3AndSave]
  );

  // === Request highlight (open memo modal) ===
  const handleRequestAddHighlight = useCallback((h: PdfHighlight) => {
    if (!fileId) {
      setErrorMessage(t('Error.file-id-missing') || 'ファイルIDが未設定です。PDFの読み込み完了後に再度お試しください。');
      return;
    }
    setPendingHighlight(h);
    dispatch(setActiveHighlightId(h.id));
    setShowMemoModal(true);
  }, [dispatch, t, fileId]);

  // === Save memo + add highlight + add root comment ===
  const handleSaveMemo = useCallback(
    async (id: string, memo: string) => {
      if (pendingHighlight && pendingHighlight.id === id) {
        try {
          dispatch(startLoading('Saving highlight and memo...'));

          const projectId = getProjectIdFromCookie();
          if (!projectId) {
            setErrorMessage('Project ID not found');
            return;
          }

          if (!fileId) {
            setErrorMessage(t('Error.file-id-missing') || 'ファイルIDが未設定です。PDFの読み込み完了後に再度お試しください。');
            return;
          }

          const userName = getUserName();

          const { data: response, error } = await apiClient<any>('/highlights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
              project_file_id: fileId,
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
            },
          });

          if (error) {
            setErrorMessage(error);
            return;
          }

          console.log('Highlight saved:', response);
          
          if (!response.id) {
            setErrorMessage('Highlight ID is missing in response');
            return;
          }

          const finalHighlight: Highlight = {
            ...pendingHighlight,
            id: response.id.toString(),
            memo,
            createdAt: response.created_at,
            createdBy: userName,
          };

          const rootComment: CommentType = {
            id: response.comment_id.toString(),
            highlightId: response.id.toString(),
            parentId: null,
            author: userName,
            text: memo.trim(),
            createdAt: response.created_at,
            editedAt: null,
            deleted: false,
          };

          dispatch(addHighlightWithComment({ highlight: finalHighlight, initialComment: rootComment }));

          setPendingHighlight(null);
          setShowMemoModal(false);
          dispatch(setActiveHighlightId(null));
        } finally {
          dispatch(stopLoading());
        }
        return;
      }

      dispatch(updateHighlightMemo({ id, memo }));
      setShowMemoModal(false);
      dispatch(setActiveHighlightId(null));
    },
    [dispatch, pendingHighlight, getUserName, t, fileId]
  );

  // === Highlight Click ===
  const handleHighlightClick = useCallback((highlightId: string) => {
    dispatch(setActiveHighlightId(highlightId));
  }, [dispatch]);

  // === Viewer ===
  const renderViewer = () => {
    if (!fileContent) return <p className={styles.noFileMessage}>{t("file-upload-txt")}</p>;

    if (fileType && fileType.includes('pdf')) {
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

    return <p className={styles.errorMessage}>{t("Error.file-format")}</p>;
  };

  return (
    <>
      <div className={styles.container} ref={mainContainerRef}>
        <LoadingOverlay isVisible={isGlobalLoading} />

        <div
          className={styles.pdfViewerWrapper}
          style={{
            width: pdfViewerWidth,
            minWidth: MIN_PDF_WIDTH,
          }}
        >
          {!isFileUploaded && (
            <div className={styles.fileInputSection}>
              <input type="file" onChange={handleFileUpload} accept=".pdf, .txt, text/*" />
            </div>
          )}

          <div className={styles.viewerContainer} ref={viewerContentRef}>
            {renderViewer()}
          </div>
        </div>

        <div
          className={`${styles.resizeHandle} resize-handle`}
          onMouseDown={handleMouseDown}
        />

        <div className={styles.commentPanelWrapper}>
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

      {errorMessage && (
        <ErrorDisplay
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
    </>
  );
};

const IndexPage: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading';

  if (isLoading) {
    return <div className={styles.loadingContainer}>Loading...</div>;
  }

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  return <EditorPageContent />;
};

export default IndexPage;