import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { STAGE } from '../utils/constants';
import type { Document } from '../redux/features/editor/editorTypes';
import {
  clearAllState,
  setCompletionStage,
  setDocumentName,
  setPreferredDocumentId,
} from '../redux/features/editor/editorSlice';
import { apiClient } from '@/utils/apiClient';
import { FastApiAuthResponse } from '@/types/Responses/Auth';
import { logUserAction } from '../utils/logger';
import { ErrorDisplay } from '../components/ErrorDisplay';
import styles from '../styles/Documents.module.css';

const Documents: React.FC = () => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [newDocumentName, setNewDocumentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [editedName, setEditedName] = useState('');
  const router = useRouter();
  const dispatch = useDispatch();
  const { data: session, status, update: updateSession } = useSession();

  const authHeaders = useMemo(
    () => (session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined),
    [session?.accessToken]
  );

  const runWithFlag = useCallback(async (
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    task: () => Promise<void>
  ) => {
    setter(true);
    try {
      await task();
    } finally {
      setter(false);
    }
  }, []);

  const getUserId = useCallback(() => session?.user?.id || session?.user?.email || 'anonymous', [session]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const fetchDocuments = async () => {
      await runWithFlag(setLoading, async () => {
        setErrorMessage(null);
        dispatch(clearAllState());

        logUserAction(
          'documents_fetch_started',
          {
            timestamp: new Date().toISOString(),
          },
          getUserId()
        );

        const { data, error, status: httpStatus } = await apiClient<Document[]>('/documents/', {
          method: 'GET',
          headers: authHeaders,
        });

        if (error) {
          console.error('[fetchDocuments] Error:', error, 'Status:', httpStatus);
          setErrorMessage(t('Error.fetch-documents-failed'));
          logUserAction(
            'documents_fetch_failed',
            {
              reason: error,
              status: httpStatus,
              timestamp: new Date().toISOString(),
            },
            getUserId()
          );
          return;
        }

        if (!data) {
          console.warn('[fetchDocuments] No data received');
          setErrorMessage(t('Error.fetch-documents-failed'));
          logUserAction(
            'documents_fetch_no_data',
            {
              timestamp: new Date().toISOString(),
            },
            getUserId()
          );
          return;
        }

        setDocuments(data);
        logUserAction(
          'documents_loaded',
          {
            count: data.length,
            timestamp: new Date().toISOString(),
          },
          getUserId()
        );
      });
    };

    fetchDocuments();
  }, [authHeaders, status, dispatch, t, getUserId, runWithFlag]);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  const handleSelectDocument = async (documentId: number, documentName: string) => {
    try {
      const { data, error } = await apiClient<FastApiAuthResponse>('/auth/select-document/', {
        method: 'POST',
        headers: authHeaders,
        body: { document_id: documentId },
      });

      if (error || !data) {
        console.error('[handleSelectDocument] Error:', error);
        logUserAction(
          'document_selection_failed',
          {
            documentId,
            reason: error,
            timestamp: new Date().toISOString(),
          },
          getUserId()
        );
        return;
      }

      dispatch(setPreferredDocumentId(documentId));
      dispatch(setDocumentName(documentName));

      logUserAction(
        'document_selected',
        {
          documentId,
          documentName,
          timestamp: new Date().toISOString(),
        },
        getUserId()
      );

      if (updateSession) {
        const updateResult = await updateSession({
          accessToken: data.access_token,
          preferredDocumentId: documentId,
        });
        console.log('[handleSelectDocument] Session update result:', updateResult);
      }

      router.push('/');
    } catch (error) {
      console.error('[handleSelectDocument] Error:', error);
      logUserAction(
        'document_selection_error',
        {
          documentId,
          reason: error instanceof Error ? error.message : 'unknown',
          timestamp: new Date().toISOString(),
        },
        getUserId()
      );
    }
  };

  const handleCreateDocument = async () => {
    if (!newDocumentName.trim()) return;
    setErrorMessage(null);

    await runWithFlag(setCreating, async () => {
      logUserAction(
        'document_creation_started',
        {
          documentName: newDocumentName,
          timestamp: new Date().toISOString(),
        },
        getUserId()
      );

      const { data, error } = await apiClient<Document>('/documents/', {
        method: 'POST',
        headers: authHeaders,
        body: {
          document_name: newDocumentName,
          stage: STAGE.THINKING_PROCESS_SELF,
        },
      });

      if (error) {
        console.error('[handleCreateDocument] Error:', error);
        if (error.includes('409') || error.includes('同じ名前') || error.includes('already exists')) {
          setErrorMessage(t('Error.duplicate-document-name'));
        } else {
          setErrorMessage(t('Error.create-document-failed'));
        }
        logUserAction(
          'document_creation_failed',
          {
            documentName: newDocumentName,
            reason: error,
            timestamp: new Date().toISOString(),
          },
          getUserId()
        );
        return;
      }

      if (!data) {
        console.warn('[handleCreateDocument] No data received');
        setErrorMessage(t('Error.create-document-failed'));
        logUserAction(
          'document_creation_no_data',
          {
            documentName: newDocumentName,
            timestamp: new Date().toISOString(),
          },
          getUserId()
        );
        return;
      }

      const newDocument: Document = data;
      setDocuments((prev) => [...prev, newDocument]);
      setNewDocumentName('');

      try {
        const { data: selectData, error: selectError } = await apiClient<FastApiAuthResponse>('/auth/select-document/', {
          method: 'POST',
          headers: authHeaders,
          body: { document_id: newDocument.id },
        });

        if (selectError || !selectData) {
          console.error('[handleCreateDocument] Error selecting new document:', selectError);
          dispatch(setDocumentName(newDocument.document_name));
          dispatch(setCompletionStage(STAGE.THINKING_OPTION_LLM));
          dispatch(setPreferredDocumentId(newDocument.id));
          router.push('/?new=true');
          return;
        }

        dispatch(setDocumentName(newDocument.document_name));
        dispatch(setCompletionStage(STAGE.THINKING_OPTION_LLM));
        dispatch(setPreferredDocumentId(newDocument.id));

        logUserAction(
          'document_created',
          {
            documentId: newDocument.id,
            documentName: newDocument.document_name,
            timestamp: new Date().toISOString(),
          },
          getUserId()
        );

        if (updateSession) {
          const updateResult = await updateSession({
            accessToken: selectData.access_token,
            preferredDocumentId: newDocument.id,
          });
          console.log('[handleCreateDocument] Session update result:', updateResult);
        }

        router.push('/?new=true');
      } catch (error) {
        console.error('[handleCreateDocument] Error:', error);
        setErrorMessage(t('Error.create-document-failed'));
      }
    });
  };

  const handleToggleMenu = (e: React.MouseEvent, documentId: number) => {
    e.stopPropagation();
    const isOpening = openMenuId !== documentId;
    setOpenMenuId(isOpening ? documentId : null);

    if (isOpening) {
      logUserAction(
        'document_menu_opened',
        {
          documentId,
          timestamp: new Date().toISOString(),
        },
        getUserId()
      );
    }
  };

  const handleEditClick = (e: React.MouseEvent, document: Document) => {
    e.stopPropagation();
    setEditingDocument(document);
    setEditedName(document.document_name);
    setOpenMenuId(null);
    logUserAction(
      'document_edit_started',
      {
        documentId: document.id,
        documentName: document.document_name,
        timestamp: new Date().toISOString(),
      },
      getUserId()
    );
  };

  const handleDeleteClick = async (e: React.MouseEvent, documentId: number) => {
    e.stopPropagation();

    const document = documents.find((p) => p.id === documentId);
    if (!confirm(t('Document.delete-confirm'))) {
      logUserAction(
        'document_deletion_cancelled',
        {
          documentId,
          documentName: document?.document_name,
          timestamp: new Date().toISOString(),
        },
        getUserId()
      );
      return;
    }

    setErrorMessage(null);

    logUserAction(
      'document_deletion_started',
      {
        documentId,
        documentName: document?.document_name,
        timestamp: new Date().toISOString(),
      },
      getUserId()
    );

    const { error } = await apiClient<null>(`/documents/${documentId}/`, {
      method: 'DELETE',
      headers: authHeaders,
    });

    if (error) {
      console.error('[handleDeleteClick] Error:', error);
      setErrorMessage(t('Error.delete-document-failed'));
      logUserAction(
        'document_deletion_failed',
        {
          documentId,
          documentName: document?.document_name,
          reason: error,
          timestamp: new Date().toISOString(),
        },
        getUserId()
      );
      setOpenMenuId(null);
      return;
    }

    setDocuments(documents.filter((p) => p.id !== documentId));
    setOpenMenuId(null);
    logUserAction(
      'document_deleted',
      {
        documentId,
        documentName: document?.document_name,
        timestamp: new Date().toISOString(),
      },
      getUserId()
    );
  };

  const handleSaveEdit = async () => {
    if (!editingDocument || !editedName.trim()) return;

    setErrorMessage(null);

    logUserAction(
      'document_update_started',
      {
        documentId: editingDocument.id,
        oldName: editingDocument.document_name,
        newName: editedName,
        timestamp: new Date().toISOString(),
      },
      getUserId()
    );

    const { data, error } = await apiClient<Document>(`/documents/${editingDocument.id}/`, {
      method: 'PUT',
      headers: authHeaders,
      body: { document_name: editedName },
    });

    if (error) {
      console.error('[handleSaveEdit] Error:', error);
      if (error.includes('409') || error.includes('同じ名前') || error.includes('already exists')) {
        setErrorMessage(t('Error.duplicate-document-name'));
      } else {
        setErrorMessage(t('Error.update-document-failed'));
      }
      logUserAction(
        'document_update_failed',
        {
          documentId: editingDocument.id,
          oldName: editingDocument.document_name,
          newName: editedName,
          reason: error,
          timestamp: new Date().toISOString(),
        },
        getUserId()
      );
      return;
    }

    if (!data) {
      console.warn('[handleSaveEdit] No data received');
      setErrorMessage(t('Error.update-document-failed'));
      logUserAction(
        'document_update_no_data',
        {
          documentId: editingDocument.id,
          oldName: editingDocument.document_name,
          newName: editedName,
          timestamp: new Date().toISOString(),
        },
        getUserId()
      );
      return;
    }

    const updated: Document = data;
    setDocuments(documents.map((p) => (p.id === updated.id ? updated : p)));
    setEditingDocument(null);
    setEditedName('');
    logUserAction(
      'document_updated',
      {
        documentId: updated.id,
        oldName: editingDocument.document_name,
        newName: updated.document_name,
        timestamp: new Date().toISOString(),
      },
      getUserId()
    );
  };

  const handleCancelEdit = () => {
    if (editingDocument) {
      logUserAction(
        'document_edit_cancelled',
        {
          documentId: editingDocument.id,
          documentName: editingDocument.document_name,
          timestamp: new Date().toISOString(),
        },
        getUserId()
      );
    }
    setEditingDocument(null);
    setEditedName('');
  };

  if (status === 'loading') {
    return <div className={styles.loadingText}>Loading...</div>;
  }

  if (!router.isReady) return null;

  return (
    <>
      <div className={styles.container}>
        <div className={styles.contentWrapper}>
          <h2 className={styles.title}>{t('Document.document-list')}</h2>

          {loading ? (
            <div className={styles.loadingText}>{t('Document.loading-text')}</div>
          ) : documents.length === 0 ? (
            <div className={styles.emptyState}>{t('Document.non-document')}</div>
          ) : (
            <div className={styles.documentListContainer}>
              <ul className={styles.documentList}>
                {documents.map((document, index) => {
                  const isCompleted = document.stage === STAGE.EXPORT || Number(document.stage) === 4;
                  const isMenuOpen = openMenuId === document.id;

                  return (
                    <li
                      key={document.id}
                      className={`${styles.documentItem} ${isMenuOpen ? styles.menuOpen : ''}`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className={styles.documentItemInner}>
                        <button
                          onClick={() => handleSelectDocument(document.id, document.document_name)}
                          className={`${styles.documentButton} ${isCompleted ? styles.completed : ''}`}
                        >
                          <span className={styles.documentName}>{document.document_name}</span>
                          <div className={styles.documentMeta}>
                            {isCompleted ? (
                              <span
                                className={styles.completeBadge}
                                aria-label={t('Utils.complete')}
                                title={t('Utils.complete')}
                              >
                                {t('Utils.complete')}
                              </span>
                            ) : (
                              <span className={styles.arrowIcon}>→</span>
                            )}
                          </div>
                        </button>

                        <button onClick={(e) => handleToggleMenu(e, document.id)} className={styles.menuButton}>
                          ⋮
                        </button>
                      </div>

                      {isMenuOpen && (
                        <div className={styles.dropdownMenu}>
                          <button onClick={(e) => handleEditClick(e, document)} className={styles.menuItem}>
                            {t('Utils.edit')}
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(e, document.id)}
                            className={`${styles.menuItem} ${styles.delete}`}
                          >
                            {t('Utils.delete')}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className={styles.createSection}>
            <h3 className={styles.createTitle}>{t('Document.create-new-document')}</h3>
            <input
              type="text"
              value={newDocumentName}
              onChange={(e) => setNewDocumentName(e.target.value)}
              placeholder={t('Document.document-name-placeholder')}
              className={styles.input}
              disabled={creating}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !creating && newDocumentName.trim()) {
                  handleCreateDocument();
                }
              }}
            />
            <button
              onClick={handleCreateDocument}
              disabled={creating || !newDocumentName.trim()}
              className={styles.createButton}
            >
              {creating ? t('Document.loading-text') : t('Document.create-button-text')}
            </button>
          </div>
        </div>

        {editingDocument && (
          <div className={styles.modalOverlay} onClick={handleCancelEdit}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>{t('Document.edit-name')}</h3>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className={styles.modalInput}
                autoFocus
              />
              <div className={styles.modalActions}>
                <button onClick={handleCancelEdit} className={styles.cancelButton}>
                  {t('Utils.cancel')}
                </button>
                <button onClick={handleSaveEdit} disabled={!editedName.trim()} className={styles.saveButton}>
                  {t('Utils.save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {errorMessage && <ErrorDisplay message={errorMessage} onClose={() => setErrorMessage(null)} />}
    </>
  );
};

export default Documents;
