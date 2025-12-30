import React, { useCallback, useEffect, useState, ChangeEvent, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setFile,
  addHighlightWithComment,
  updateHighlightMemo,
  setActiveHighlightId,
  setActiveCommentId,
  setHighlights,
  setComments,
  setCompletionStage,
  setFileId,
  setHasSoftDeletedLLMComment,
} from '../redux/features/editor/editorSlice';

import {
  selectFileType,
  selectFileContent,
  selectPdfHighlights,
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
import "../lang/config";
import { useTranslation } from "react-i18next";
import { MIN_PDF_WIDTH, MIN_COMMENT_PANEL_WIDTH, HANDLE_WIDTH } from '@/utils/constants';
import { startLoading, stopLoading } from '../redux/features/loading/loadingSlice';
import { useSelector as useReduxSelector } from 'react-redux';
import LoadingOverlay from '../components/LoadingOverlay';
import { apiClient } from '@/utils/apiClient';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { logUserAction } from '@/utils/logger';
import { HighlightWithCommentsResponse, CreateHighlightResponse, HighlightsWithStatusResponse } from '@/types/Responses/Highlight';
import { DocumentFileResponse, CreateDocumentFileResponse } from '@/types/Responses/DocumentFile';
import { S3UploadResponse } from '@/types/Responses/S3';
import { DocumentResponse } from '@/types/Responses/Document';
import { CreateHighlightRequest } from '@/types/Requests/Highlight';
import { CreateDocumentFileRequest } from '@/types/Requests/DocumentFile';

const PdfViewer = dynamic(() => import('../components/PdfViewer'), { ssr: false });

const EditorPageContent: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const isGlobalLoading = useReduxSelector((state: RootState) => state.loading.isLoading);
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession();

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ユーザーIDを取得するヘルパー関数を追加
  const getUserId = useCallback(() => {
    return session?.user?.id || session?.user?.email || 'anonymous';
  }, [session]);

  const getUserName = useCallback(() => {
    return session?.user?.name || t("CommentPanel.comment-author-user");
  }, [session, t]);

  const getDocumentIdFromCookie = (): number | null => {
    const match = document.cookie.match(/(?:^|; )documentId=(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  // ハイライトとコメントを取得
  const fetchHighlightsAndComments = useCallback(async (fileId: number) => {
    dispatch(startLoading('Loading highlights and comments...'));
    try {
      const { data: response, error, status } = await apiClient<HighlightWithCommentsResponse[] | HighlightsWithStatusResponse>(`/highlights/file/${fileId}/`, {
        method: 'GET',
        headers: {Authorization: `Bearer ${session?.accessToken}` },
      });

      if (status === 404) {
        console.info('[fetchHighlightsAndComments] No highlights yet for fileId:', fileId);
        dispatch(setHighlights([]));
        dispatch(setComments([]));
        logUserAction('highlights_fetch_empty', {
          fileId,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      if (error) {
        console.error('[fetchHighlightsAndComments] Error:', error);
        setErrorMessage(t('Error.highlights-fetch-failed'));
        dispatch(setHighlights([]));
        dispatch(setComments([]));
        logUserAction('highlights_fetch_failed', {
          fileId,
          reason: error,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      if (!response) {
        console.warn('[fetchHighlightsAndComments] No response data for fileId:', fileId);
        dispatch(setHighlights([]));
        dispatch(setComments([]));
        logUserAction('highlights_fetch_no_data', {
          fileId,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      const highlightEntries: HighlightWithCommentsResponse[] = Array.isArray(response)
        ? response
        : response.highlights || [];

      if (!highlightEntries || highlightEntries.length === 0) {
        console.info('[fetchHighlightsAndComments] No highlights array in response for fileId:', fileId);
        dispatch(setHighlights([]));
        dispatch(setComments([]));
        logUserAction('highlights_fetch_empty', {
          fileId,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      console.log('Fetched highlights and ALL comments:');

      const highlights: PdfHighlight[] = highlightEntries.map((item: HighlightWithCommentsResponse) => {
        const h = item.highlight;
        const highlightId = h.id || h.id;
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
          rects: h.rects.map((rect: { page_num: number; x1: number; y1: number; x2: number; y2: number; element_type?: string }) => ({
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

      console.log('Converted highlights:');
      dispatch(setHighlights(highlights));

      const comments: CommentType[] = highlightEntries.flatMap((item: HighlightWithCommentsResponse) => {
        const h = item.highlight;
        const hId = (h.id || h.id)?.toString();
        if (!hId) return [];
        
        const list = Array.isArray(item.comments) ? item.comments : [];
        
        return list.map((c: { id: number; parent_id: number | null; author: string; text: string; created_at: string; updated_at?: string | null; deleted_at?: string | null; deleted_reason?: string | null }) => {
          console.log('[fetchHighlightsAndComments] Converting comment:', {
            id: c.id,
            parent_id: c.parent_id,
            author: c.author,
            text: c.text.substring(0, 30),
          });
          
          return {
            id: c.id.toString(),
            highlightId: hId,
            parentId: c.parent_id !== null && c.parent_id !== undefined 
              ? c.parent_id.toString() 
              : null,
            author: c.author || getUserName(),
            text: c.text,
            created_at: c.created_at,
            edited_at: c.updated_at || null,
            deleted: Boolean(c.deleted_at),
            deleted_at: c.deleted_at || null,
            deleted_reason: c.deleted_reason ?? null,
          };
        });
      });

      console.log('[fetchHighlightsAndComments] Final comments array:', {
        totalCount: comments.length,
        rootCount: comments.filter(c => c.parentId === null).length,
        replyCount: comments.filter(c => c.parentId !== null).length,
        comments: comments.map(c => ({
          id: c.id,
          parentId: c.parentId,
          author: c.author,
        })),
      });

      dispatch(setComments(comments));
      logUserAction('highlights_and_comments_loaded', {
        fileId,
        highlightCount: highlights.length,
        commentCount: comments.length,
        rootCommentCount: comments.filter(c => c.parentId === null).length,
        replyCount: comments.filter(c => c.parentId !== null).length,
        timestamp: new Date().toISOString(),
      }, getUserId());
    } finally {
      dispatch(stopLoading());
    }
  }, [dispatch, getUserName, session?.accessToken, t, getUserId]);

  const fetchDocumentFile = useCallback(async (documentId: number) => {
    dispatch(startLoading('Loading document file...'));
    try {
      const { data: response, error } = await apiClient<DocumentFileResponse[]>(`/documents/${documentId}/document-files/`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });

      if (error) {
        console.error('[fetchDocumentFile] Error:', error);
        setErrorMessage(t('Error.file-fetch-failed'));
        logUserAction('file_fetch_failed', {
          documentId,
          reason: error,
          timestamp: new Date().toISOString(),
        }, getUserId());
        setIsFileUploaded(false);
        return;
      }

      if (!response || response.length === 0) {
        console.info('[fetchDocumentFile] No files found for this document yet.');
        setIsFileUploaded(false);
        logUserAction('file_fetch_empty', {
          documentId,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      const latestFile = response[0];
      console.log(latestFile);
      dispatch(setFileId(latestFile.id));

      const { data: blobData, error: blobError } = await apiClient<Blob>(`/s3/get-file?key=${encodeURIComponent(latestFile.file_key)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
        responseType: 'blob',
      });

      if (blobError || !blobData) {
        console.error('[fetchDocumentFile] S3 fetch error:', blobError);
        setErrorMessage(t('Error.file-fetch-failed'));
        logUserAction('s3_file_fetch_failed', {
          documentId,
          fileKey: latestFile.file_key,
          reason: blobError,
          timestamp: new Date().toISOString(),
        }, getUserId());
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
      logUserAction('file_loaded', {
        documentId,
        fileId: latestFile.id,
        fileName: latestFile.file_name,
        mimeType: latestFile.mime_type,
        timestamp: new Date().toISOString(),
      }, getUserId());

      fetchHighlightsAndComments(latestFile.id);
    } finally {
      dispatch(stopLoading());
    }
  }, [dispatch, fetchHighlightsAndComments, session?.accessToken, t, getUserId]);

  const fetchDocumentInfo = useCallback(async (documentId: number) => {
    try {
      dispatch(startLoading('Loading document info...'));

      const { data: res, error } = await apiClient<DocumentResponse>(`/documents/${documentId}/`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });

      if (error) {
        console.error('[fetchDocumentInfo] Error:', error);
        setErrorMessage(t('Error.document-info-fetch-failed'));
        logUserAction('document_info_fetch_failed', {
          documentId,
          reason: error,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      const stage = res?.completion_stage ?? res?.stage ?? null;

      if (stage !== null && !Number.isNaN(stage)) {
        dispatch(setCompletionStage(stage));
        logUserAction('document_info_loaded', {
          documentId,
          completionStage: stage,
          timestamp: new Date().toISOString(),
        }, getUserId());
      } else {
        console.warn('Document info does not include a valid stage:', res);
        logUserAction('document_info_invalid_stage', {
          documentId,
          stage,
          timestamp: new Date().toISOString(),
        }, getUserId());
      }
    } finally {
      dispatch(stopLoading());
    }
  }, [dispatch, session?.accessToken, t, getUserId]);

  useEffect(() => {
    const documentId = getDocumentIdFromCookie();
    const isNewDocument = router.query.new === 'true';

    if (documentId && !isNewDocument) {
      logUserAction('editor_loaded', {
        documentId,
        isNewDocument: false,
        timestamp: new Date().toISOString(),
      }, getUserId());
      fetchDocumentInfo(documentId);
      fetchDocumentFile(documentId);
    } else if (documentId && isNewDocument) {
      logUserAction('editor_loaded', {
        documentId,
        isNewDocument: true,
        timestamp: new Date().toISOString(),
      }, getUserId());
      fetchDocumentInfo(documentId);
      console.log('New document created.');
    } else {
      console.warn('No document ID found in cookies');
      logUserAction('editor_load_failed', {
        reason: 'no_document_id',
        timestamp: new Date().toISOString(),
      }, getUserId());
      router.push('/documents');
    }
  }, [fetchDocumentInfo, fetchDocumentFile, router, getUserId]);

  // LLMコメント復元トリガーを監視して再フェッチ
  const lastLLMCommentRestoreTime = useSelector((state: RootState) => state.editor.lastLLMCommentRestoreTime);
  
  useEffect(() => {
    if (lastLLMCommentRestoreTime !== null && fileId) {
      console.log('[useEffect] LLM comment restore triggered, refetching highlights and comments');
      fetchHighlightsAndComments(fileId);
    }
  }, [lastLLMCommentRestoreTime, fileId, fetchHighlightsAndComments]);

  // ---------------------------
  // S3アップロード + バックエンド保存
  // ---------------------------
  const uploadPdfToS3AndSave = useCallback(async (file: File, filetype: string, filesize: number) => {
    if (!file) return;

    if (isFileUploaded) {
      setErrorMessage(t('Alert.file-already-uploaded'));
      logUserAction('file_upload_prevented', {
        reason: 'already_uploaded',
        timestamp: new Date().toISOString(),
      }, getUserId());
      return;
    }

    dispatch(startLoading('Uploading PDF...'));
    logUserAction('file_upload_started', {
      fileName: file.name,
      fileSize: filesize,
      mimeType: filetype,
      timestamp: new Date().toISOString(),
    }, getUserId());

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data: s3Data, error: s3Error, status: s3Status } = await apiClient<S3UploadResponse>('/s3/upload/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
        body: formData,
      });

      if (s3Error || !s3Data) {
        console.error('[uploadPdfToS3AndSave] S3 upload error:', s3Error);
        setErrorMessage(t('Error.s3-upload-failed'));
        logUserAction('file_upload_failed', {
          fileName: file.name,
          reason: 's3_upload_error',
          error: s3Error,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }
      if (s3Status >= 400) {
        console.error('[uploadPdfToS3AndSave] S3 upload status error:', s3Status);
        setErrorMessage(t('Error.s3-upload-failed'));
        logUserAction('file_upload_failed', {
          fileName: file.name,
          reason: 's3_status_error',
          status: s3Status,
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      const document_id = getDocumentIdFromCookie();
      if (!document_id) {
        console.error('[uploadPdfToS3AndSave] Document ID not found');
        setErrorMessage(t('Error.document-id-missing'));
        logUserAction('file_upload_failed', {
          fileName: file.name,
          reason: 'document_id_missing',
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      const { data: dbResponse, error: dbError } = await apiClient<CreateDocumentFileResponse>('/document-files/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
        body: {
          document_id: parseInt(document_id.toString(), 10),
          file_name: file.name,
          file_key: s3Data.s3_key,
          file_url: s3Data.s3_url,
          mime_type: filetype,
          file_size: filesize,
        } as CreateDocumentFileRequest,
      });

      if (dbError || !dbResponse) {
        console.error('[uploadPdfToS3AndSave] DB save error:', dbError);
        setErrorMessage(t('Error.metadata-save-failed'));
        logUserAction('file_upload_failed', {
          fileName: file.name,
          reason: 'metadata_save_error',
          error: dbError,
          timestamp: new Date().toISOString(),
        }, getUserId());
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
      logUserAction('file_upload_success', {
        fileName: file.name,
        fileId: dbResponse.id,
        documentId: document_id,
        timestamp: new Date().toISOString(),
      }, getUserId());
    } finally {
      dispatch(stopLoading());
    }
  }, [dispatch, t, isFileUploaded, session?.accessToken, getUserId]);

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
    logUserAction('panel_resize_started', {
      timestamp: new Date().toISOString(),
    }, getUserId());
  }, [getUserId]);

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
      logUserAction('panel_resize_finished', {
        pdfViewerWidth,
        timestamp: new Date().toISOString(),
      }, getUserId());
    }
  }, [measureHeight, pdfViewerWidth, getUserId]);

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
        logUserAction('file_upload_prevented', {
          reason: 'already_uploaded',
          timestamp: new Date().toISOString(),
        }, getUserId());
        return;
      }

      const uploadedFile = event.target.files?.[0];
      if (!uploadedFile) return;

      if (uploadedFile.type === 'application/pdf') {
        uploadPdfToS3AndSave(uploadedFile, uploadedFile.type, uploadedFile.size);
        // input をリセット
        event.target.value = '';
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
          logUserAction('text_file_loaded', {
            fileName: uploadedFile.name,
            fileType: uploadedFile.type,
            timestamp: new Date().toISOString(),
          }, getUserId());
        };
        reader.readAsText(uploadedFile);
        event.target.value = '';
      } else {
        setErrorMessage(t("Alert.file-support"));
        event.target.value = '';
        logUserAction('file_upload_invalid_type', {
          fileName: uploadedFile.name,
          fileType: uploadedFile.type,
          timestamp: new Date().toISOString(),
        }, getUserId());
      }
    },
    [dispatch, t, isFileUploaded, uploadPdfToS3AndSave, getUserId]
  );

  // === Request highlight (open memo modal) ===
  const handleRequestAddHighlight = useCallback((h: PdfHighlight) => {
    if (!fileId) {
      console.error('[handleRequestAddHighlight] File ID missing');
      setErrorMessage(t('Error.file-id-missing'));
      logUserAction('highlight_creation_failed', {
        reason: 'file_id_missing',
        timestamp: new Date().toISOString(),
      }, getUserId());
      return;
    }
    logUserAction('highlight_creation_started', {
      highlightId: h.id,
      highlightText: h.text.substring(0, 50),
      timestamp: new Date().toISOString(),
    }, getUserId());
    setPendingHighlight(h);
    dispatch(setActiveHighlightId(h.id));
    setShowMemoModal(true);
  }, [dispatch, t, fileId, getUserId]);

  // === Save memo + add highlight + add root comment ===
  const handleSaveMemo = useCallback(
    async (id: string, memo: string) => {
      if (pendingHighlight && pendingHighlight.id === id) {
        try {
          dispatch(startLoading('Saving highlight and memo...'));

          const documentId = getDocumentIdFromCookie();
          if (!documentId) {
            console.error('[handleSaveMemo] Document ID not found');
            setErrorMessage(t('Error.document-id-missing'));
            logUserAction('highlight_save_failed', {
              highlightId: id,
              reason: 'document_id_missing',
              timestamp: new Date().toISOString(),
            }, getUserId());
            return;
          }

          if (!fileId) {
            console.error('[handleSaveMemo] File ID missing');
            setErrorMessage(t('Error.file-id-missing'));
            logUserAction('highlight_save_failed', {
              highlightId: id,
              reason: 'file_id_missing',
              timestamp: new Date().toISOString(),
            }, getUserId());
            return;
          }

          const userName = getUserName();

          const { data: response, error } = await apiClient<CreateHighlightResponse>('/highlights/', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session?.accessToken}` },
            body: {
              document_file_id: fileId,
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
              element_type: pendingHighlight.type || 'pdf',
            } as CreateHighlightRequest,
          });

          if (error) {
            console.error('[handleSaveMemo] Error:', error);
            setErrorMessage(t('Error.highlight-save-failed'));
            logUserAction('highlight_save_failed', {
              highlightId: id,
              reason: error,
              timestamp: new Date().toISOString(),
            }, getUserId());
            return;
          }

          if (!response) {
            console.error('[handleSaveMemo] No response data received');
            setErrorMessage(t('Error.highlight-save-failed'));
            logUserAction('highlight_save_failed', {
              highlightId: id,
              reason: 'no_response_data',
              timestamp: new Date().toISOString(),
            }, getUserId());
            return;
          }

          console.log('Highlight saved:', response);

          if (!response.id) {
            console.error('[handleSaveMemo] Highlight ID missing in response');
            setErrorMessage(t('Error.highlight-save-failed'));
            logUserAction('highlight_save_failed', {
              highlightId: id,
              reason: 'highlight_id_missing',
              timestamp: new Date().toISOString(),
            }, getUserId());
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
            created_at: response.created_at,
            edited_at: null,
            deleted: false,
          };

          dispatch(addHighlightWithComment({ highlight: finalHighlight, initialComment: rootComment }));

          logUserAction('highlight_created', {
            highlightId: response.id,
            commentId: response.comment_id,
            memoLength: memo.length,
            timestamp: new Date().toISOString(),
          }, getUserId());

          setPendingHighlight(null);
          setShowMemoModal(false);
          // 作成されたルートコメントをアクティブにして、CommentPanelを自動スクロール
          dispatch(setActiveCommentId(response.comment_id.toString()));
        } finally {
          dispatch(stopLoading());
        }
        return;
      }

      dispatch(updateHighlightMemo({ id, memo }));
      logUserAction('highlight_memo_updated', {
        highlightId: id,
        memoLength: memo.length,
        timestamp: new Date().toISOString(),
      }, getUserId());
      setShowMemoModal(false);
      dispatch(setActiveHighlightId(null));
    },
    [dispatch, pendingHighlight, getUserName, t, fileId, getUserId, session?.accessToken]
  );

  // === Highlight Click ===
  const handleHighlightClick = useCallback((highlightId: string) => {
    dispatch(setActiveHighlightId(highlightId));
    logUserAction('highlight_clicked', {
      highlightId,
      timestamp: new Date().toISOString(),
    }, getUserId());
  }, [dispatch, getUserId]);

  // === Viewer ===
  const renderViewer = () => {
    if (!fileContent) return <p className={styles.noFileMessage}>{t("file-upload-txt")}</p>;

    if (fileType && fileType.includes('pdf')) {
      const pdfFile = typeof fileContent === 'string' ? fileContent : null;

      if (!pdfFile) {
        return <p className={styles.errorMessage}>{t("Error.file-format")}</p>;
      }

      return (
        <PdfViewer
          file={pdfFile}
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
              logUserAction('memo_modal_closed', {
                highlightId: pendingHighlight?.id || activeHighlightId,
                timestamp: new Date().toISOString(),
              }, getUserId());
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