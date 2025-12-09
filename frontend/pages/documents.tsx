import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { signIn, signOut } from 'next-auth/react';
import { STAGE } from '../utils/constants';
import type { Document } from '../redux/features/editor/editorTypes';
import Cookies from 'js-cookie';
import { useTranslation } from 'react-i18next';
import { clearAllState } from '../redux/features/editor/editorSlice';
import { setDocumentName } from '../redux/features/editor/editorSlice';
import { apiClient } from '../utils/apiClient';
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
  const { data: session, status } = useSession();

  // ユーザーIDを取得するヘルパー関数
  const getUserId = useCallback(() => {
    return session?.user?.id || session?.user?.email || 'anonymous';
  }, [session]);

  // ドキュメント一覧の取得
  useEffect(() => {
    if (status !== 'authenticated') return;

    const fetchDocuments = async () => {
      setLoading(true);
      setErrorMessage(null);
      dispatch(clearAllState());

      logUserAction('documents_fetch_started', {
        timestamp: new Date().toISOString(),
      }, getUserId());

      const { data, error, status: httpStatus } = await apiClient<Document[]>('/documents/', {
        method: 'GET',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });

      if (error) {
        console.error('[fetchDocuments] Error:', error, 'Status:', httpStatus);
        if (httpStatus === 401 || httpStatus === 403) {
          logUserAction('documents_fetch_auth_error', {
            status: httpStatus,
            timestamp: new Date().toISOString(),
          }, getUserId());

          setErrorMessage(t('Error.session-expired'));
          setLoading(false);

          setTimeout(async () => {
            await signOut({ redirect: false });
            router.push('/login?error=session_expired');
          }, 2000);
          return;
        }

        setErrorMessage(t('Error.fetch-documents-failed'));
        logUserAction('documents_fetch_failed', {
          reason: error,
          status: httpStatus,
          timestamp: new Date().toISOString(),
        }, getUserId());
        setLoading(false);
        return;
      }

      if (!data) {
        console.warn('[fetchDocuments] No data received');
        setErrorMessage(t('Error.fetch-documents-failed'));
        logUserAction('documents_fetch_no_data', {
          timestamp: new Date().toISOString(),
        }, getUserId());
        setLoading(false);
        return;
      }

      setDocuments(data);
      setLoading(false);
      logUserAction('documents_loaded', {
        count: data.length,
        timestamp: new Date().toISOString(),
      }, getUserId());
    };

    fetchDocuments();
  }, [session, status, dispatch, t, getUserId, router]);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  const handleSelectDocument = (documentId: number, documentName: string) => {
    Cookies.set('documentId', documentId.toString(), { expires: 7, sameSite: 'lax', secure: true });
    dispatch(setDocumentName(documentName));
    logUserAction('document_selected', {
      documentId,
      documentName,
      timestamp: new Date().toISOString(),
    }, getUserId());
    router.push('/');
  };

  const handleCreateDocument = async () => {
    if (!newDocumentName.trim()) return;
    
    setCreating(true);
    setErrorMessage(null);

    logUserAction('document_creation_started', {
      documentName: newDocumentName,
      timestamp: new Date().toISOString(),
    }, getUserId());

    const { data, error } = await apiClient<Document>('/documents/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.accessToken}`},
      body: {
        document_name: newDocumentName,
        stage: STAGE.GIVE_OPTION_TIPS,
      },
    });

    if (error) {
      console.error('[handleCreateDocument] Error:', error);
      setErrorMessage(t('Error.create-document-failed'));
      logUserAction('document_creation_failed', {
        documentName: newDocumentName,
        reason: error,
        timestamp: new Date().toISOString(),
      }, getUserId());
      setCreating(false);
      return;
    }

    if (!data) {
      console.warn('[handleCreateDocument] No data received');
      setErrorMessage(t('Error.create-document-failed'));
      logUserAction('document_creation_no_data', {
        documentName: newDocumentName,
        timestamp: new Date().toISOString(),
      }, getUserId());
      setCreating(false);
      return;
    }

    const newDocument: Document = data;
    setDocuments([...documents, newDocument]);
    setNewDocumentName('');

    Cookies.set('documentId', newDocument.id.toString(), { sameSite: 'lax', secure: true });
    Cookies.set('completionStage', STAGE.GIVE_OPTION_TIPS.toString(), { sameSite: 'lax', secure: true });
    
    setCreating(false);
    logUserAction('document_created', {
      documentId: newDocument.id,
      documentName: newDocument.document_name,
      timestamp: new Date().toISOString(),
    }, getUserId());
    router.push('/?new=true');
  };

  const handleToggleMenu = (e: React.MouseEvent, documentId: number) => {
    e.stopPropagation();
    const isOpening = openMenuId !== documentId;
    setOpenMenuId(isOpening ? documentId : null);
    
    if (isOpening) {
      logUserAction('document_menu_opened', {
        documentId,
        timestamp: new Date().toISOString(),
      }, getUserId());
    }
  };

  const handleEditClick = (e: React.MouseEvent, document: Document) => {
    e.stopPropagation();
    setEditingDocument(document);
    setEditedName(document.document_name);
    setOpenMenuId(null);
    logUserAction('document_edit_started', {
      documentId: document.id,
      documentName: document.document_name,
      timestamp: new Date().toISOString(),
    }, getUserId());
  };

  const handleDeleteClick = async (e: React.MouseEvent, documentId: number) => {
    e.stopPropagation();
    
    const document = documents.find(p => p.id === documentId);
    if (!confirm(t("Document.delete-confirm"))) {
      logUserAction('document_deletion_cancelled', {
        documentId,
        documentName: document?.document_name,
        timestamp: new Date().toISOString(),
      }, getUserId());
      return;
    }
    
    setErrorMessage(null);

    logUserAction('document_deletion_started', {
      documentId,
      documentName: document?.document_name,
      timestamp: new Date().toISOString(),
    }, getUserId());

    const { error } = await apiClient<null>(`/documents/${documentId}/`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.accessToken}` },
    });

    if (error) {
      console.error('[handleDeleteClick] Error:', error);
      setErrorMessage(t('Error.delete-document-failed'));
      logUserAction('document_deletion_failed', {
        documentId,
        documentName: document?.document_name,
        reason: error,
        timestamp: new Date().toISOString(),
      }, getUserId());
      setOpenMenuId(null);
      return;
    }

    setDocuments(documents.filter(p => p.id !== documentId));
    setOpenMenuId(null);
    logUserAction('document_deleted', {
      documentId,
      documentName: document?.document_name,
      timestamp: new Date().toISOString(),
    }, getUserId());
  };

  const handleSaveEdit = async () => {
    if (!editingDocument || !editedName.trim()) return;
    
    setErrorMessage(null);

    logUserAction('document_update_started', {
      documentId: editingDocument.id,
      oldName: editingDocument.document_name,
      newName: editedName,
      timestamp: new Date().toISOString(),
    }, getUserId());

    const { data, error } = await apiClient<Document>(`/documents/${editingDocument.id}/`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${session?.accessToken}` },
      body: { document_name: editedName },
    });

    if (error) {
      console.error('[handleSaveEdit] Error:', error);
      setErrorMessage(t('Error.update-document-failed'));
      logUserAction('document_update_failed', {
        documentId: editingDocument.id,
        oldName: editingDocument.document_name,
        newName: editedName,
        reason: error,
        timestamp: new Date().toISOString(),
      }, getUserId());
      return;
    }

    if (!data) {
      console.warn('[handleSaveEdit] No data received');
      setErrorMessage(t('Error.update-document-failed'));
      logUserAction('document_update_no_data', {
        documentId: editingDocument.id,
        oldName: editingDocument.document_name,
        newName: editedName,
        timestamp: new Date().toISOString(),
      }, getUserId());
      return;
    }

    const updated: Document = data;
    setDocuments(documents.map(p => p.id === updated.id ? updated : p));
    setEditingDocument(null);
    setEditedName('');
    logUserAction('document_updated', {
      documentId: updated.id,
      oldName: editingDocument.document_name,
      newName: updated.document_name,
      timestamp: new Date().toISOString(),
    }, getUserId());
  };

  const handleCancelEdit = () => {
    if (editingDocument) {
      logUserAction('document_edit_cancelled', {
        documentId: editingDocument.id,
        documentName: editingDocument.document_name,
        timestamp: new Date().toISOString(),
      }, getUserId());
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
          <h2 className={styles.title}>
            {t("Document.document-list")}
          </h2>

          {loading ? (
            <div className={styles.loadingText}>
              {t("Document.loading-text")}
            </div>
          ) : documents.length === 0 ? (
            <div className={styles.emptyState}>
              {t("Document.non-document")}
            </div>
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
                                aria-label={t("Utils.complete")}
                                title={t("Utils.complete")}
                              >
                                {t("Utils.complete")}
                              </span>
                            ) : (
                              <span className={styles.arrowIcon}>
                                →
                              </span>
                            )}
                          </div>
                        </button>

                        <button
                          onClick={(e) => handleToggleMenu(e, document.id)}
                          className={styles.menuButton}
                        >
                          ⋮
                        </button>
                      </div>

                      {isMenuOpen && (
                        <div className={styles.dropdownMenu}>
                          <button
                            onClick={(e) => handleEditClick(e, document)}
                            className={styles.menuItem}
                          >
                            {t("Utils.edit")}
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(e, document.id)}
                            className={`${styles.menuItem} ${styles.delete}`}
                          >
                            {t("Utils.delete")}
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
            <h3 className={styles.createTitle}>
              {t("Document.create-new-document")}
            </h3>
            <input
              type="text"
              value={newDocumentName}
              onChange={e => setNewDocumentName(e.target.value)}
              placeholder={t("Document.document-name-placeholder")}
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
              {creating ? t("Document.loading-text") : t("Document.create-button-text")}
            </button>
          </div>
        </div>

        {editingDocument && (
          <div
            className={styles.modalOverlay}
            onClick={handleCancelEdit}
          >
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={styles.modalTitle}>
                {t("Document.edit-name")}
              </h3>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className={styles.modalInput}
                autoFocus
              />
              <div className={styles.modalActions}>
                <button
                  onClick={handleCancelEdit}
                  className={styles.cancelButton}
                >
                  {t("Utils.cancel")}
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editedName.trim()}
                  className={styles.saveButton}
                >
                  {t("Utils.save")}
                </button>
              </div>
            </div>
          </div>
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

export default Documents;
