import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import { STAGE } from '../utils/constants';
import type { Project } from '../redux/features/editor/editorTypes';
import Cookies from 'js-cookie';
import { useTranslation } from 'react-i18next';
import { clearAllState } from '../redux/features/editor/editorSlice';
import { setDocumentName } from '../redux/features/editor/editorSlice';
import { apiClient } from '../utils/apiClient';
import { logUserAction } from '../utils/logger';
import { ErrorDisplay } from '../components/ErrorDisplay';
import styles from '../styles/Projects.module.css';

const Projects: React.FC = () => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editedName, setEditedName] = useState('');
  const [hasAuthError, setHasAuthError] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const { data: session, status } = useSession();

  // ユーザーIDを取得するヘルパー関数
  const getUserId = useCallback(() => {
    return session?.user?.id || session?.user?.email || 'anonymous';
  }, [session]);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      logUserAction('projects_page_unauthenticated', {
        timestamp: new Date().toISOString(),
      }, 'anonymous');
      signIn();
      return;
    }

    const fetchProjects = async () => {
      setLoading(true);
      setErrorMessage(null);
      dispatch(clearAllState());

      logUserAction('projects_fetch_started', {
        timestamp: new Date().toISOString(),
      }, getUserId());

      const { data, error, status: httpStatus } = await apiClient<Project[]>('/projects', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (error) {
        console.error('[fetchProjects] Error:', error, 'Status:', httpStatus);
        
        // 401など認証エラーの場合のみログインへ
        if (httpStatus === 401) {
          setHasAuthError(true);
          logUserAction('projects_fetch_auth_error', {
            status: httpStatus,
            timestamp: new Date().toISOString(),
          }, getUserId());
          await signIn(undefined, { callbackUrl: '/projects' });
          return;
        }
        
        // それ以外のエラーはエラーメッセージのみ表示
        setErrorMessage(t('Error.fetch-projects-failed'));
        logUserAction('projects_fetch_failed', {
          reason: error,
          status: httpStatus,
          timestamp: new Date().toISOString(),
        }, getUserId());
        setLoading(false);
        return;
      }

      if (!data) {
        console.warn('[fetchProjects] No data received');
        setErrorMessage(t('Error.fetch-projects-failed'));
        logUserAction('projects_fetch_no_data', {
          timestamp: new Date().toISOString(),
        }, getUserId());
        setLoading(false);
        return;
      }

      setProjects(data);
      setHasAuthError(false);
      setLoading(false);
      logUserAction('projects_loaded', {
        count: data.length,
        timestamp: new Date().toISOString(),
      }, getUserId());
    };

    // 認証エラー発生中は再実行しない
    if (!hasAuthError) {
      fetchProjects();
    }
  }, [session, status, dispatch, t, hasAuthError, getUserId]);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  const handleSelectProject = (projectId: number, projectName: string) => {
    Cookies.set('projectId', projectId.toString(), { expires: 7, sameSite: 'lax', secure: true });
    dispatch(setDocumentName(projectName));
    logUserAction('project_selected', {
      projectId,
      projectName,
      timestamp: new Date().toISOString(),
    }, getUserId());
    router.push('/');
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    setCreating(true);
    setErrorMessage(null);

    logUserAction('project_creation_started', {
      projectName: newProjectName,
      timestamp: new Date().toISOString(),
    }, getUserId());

    const { data, error } = await apiClient<Project>('/projects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.accessToken}`,
      },
      body: {
        project_name: newProjectName,
        stage: STAGE.GIVE_OPTION_TIPS,
      },
    });

    if (error) {
      console.error('[handleCreateProject] Error:', error);
      setErrorMessage(t('Error.create-project-failed'));
      logUserAction('project_creation_failed', {
        projectName: newProjectName,
        reason: error,
        timestamp: new Date().toISOString(),
      }, getUserId());
      setCreating(false);
      return;
    }

    if (!data) {
      console.warn('[handleCreateProject] No data received');
      setErrorMessage(t('Error.create-project-failed'));
      logUserAction('project_creation_no_data', {
        projectName: newProjectName,
        timestamp: new Date().toISOString(),
      }, getUserId());
      setCreating(false);
      return;
    }

    const newProject: Project = data;
    setProjects([...projects, newProject]);
    setNewProjectName('');

    Cookies.set('projectId', newProject.id.toString(), { sameSite: 'lax', secure: true });
    Cookies.set('completionStage', STAGE.GIVE_OPTION_TIPS.toString(), { sameSite: 'lax', secure: true });
    
    setCreating(false);
    logUserAction('project_created', {
      projectId: newProject.id,
      projectName: newProject.project_name,
      timestamp: new Date().toISOString(),
    }, getUserId());
    router.push('/?new=true');
  };

  const handleToggleMenu = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    const isOpening = openMenuId !== projectId;
    setOpenMenuId(isOpening ? projectId : null);
    
    if (isOpening) {
      logUserAction('project_menu_opened', {
        projectId,
        timestamp: new Date().toISOString(),
      }, getUserId());
    }
  };

  const handleEditClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingProject(project);
    setEditedName(project.project_name);
    setOpenMenuId(null);
    logUserAction('project_edit_started', {
      projectId: project.id,
      projectName: project.project_name,
      timestamp: new Date().toISOString(),
    }, getUserId());
  };

  const handleDeleteClick = async (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    
    const project = projects.find(p => p.id === projectId);
    if (!confirm(t("Document.delete-confirm"))) {
      logUserAction('project_deletion_cancelled', {
        projectId,
        projectName: project?.project_name,
        timestamp: new Date().toISOString(),
      }, getUserId());
      return;
    }
    
    setErrorMessage(null);

    logUserAction('project_deletion_started', {
      projectId,
      projectName: project?.project_name,
      timestamp: new Date().toISOString(),
    }, getUserId());

    const { error } = await apiClient<null>(`/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session?.accessToken}`,
      },
    });

    if (error) {
      console.error('[handleDeleteClick] Error:', error);
      setErrorMessage(t('Error.delete-project-failed'));
      logUserAction('project_deletion_failed', {
        projectId,
        projectName: project?.project_name,
        reason: error,
        timestamp: new Date().toISOString(),
      }, getUserId());
      setOpenMenuId(null);
      return;
    }

    setProjects(projects.filter(p => p.id !== projectId));
    setOpenMenuId(null);
    logUserAction('project_deleted', {
      projectId,
      projectName: project?.project_name,
      timestamp: new Date().toISOString(),
    }, getUserId());
  };

  const handleSaveEdit = async () => {
    if (!editingProject || !editedName.trim()) return;
    
    setErrorMessage(null);

    logUserAction('project_update_started', {
      projectId: editingProject.id,
      oldName: editingProject.project_name,
      newName: editedName,
      timestamp: new Date().toISOString(),
    }, getUserId());

    const { data, error } = await apiClient<Project>(`/projects/${editingProject.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${session?.accessToken}`,
      },
      body: { project_name: editedName },
    });

    if (error) {
      console.error('[handleSaveEdit] Error:', error);
      setErrorMessage(t('Error.update-project-failed'));
      logUserAction('project_update_failed', {
        projectId: editingProject.id,
        oldName: editingProject.project_name,
        newName: editedName,
        reason: error,
        timestamp: new Date().toISOString(),
      }, getUserId());
      return;
    }

    if (!data) {
      console.warn('[handleSaveEdit] No data received');
      setErrorMessage(t('Error.update-project-failed'));
      logUserAction('project_update_no_data', {
        projectId: editingProject.id,
        oldName: editingProject.project_name,
        newName: editedName,
        timestamp: new Date().toISOString(),
      }, getUserId());
      return;
    }

    const updated: Project = data;
    setProjects(projects.map(p => p.id === updated.id ? updated : p));
    setEditingProject(null);
    setEditedName('');
    logUserAction('project_updated', {
      projectId: updated.id,
      oldName: editingProject.project_name,
      newName: updated.project_name,
      timestamp: new Date().toISOString(),
    }, getUserId());
  };

  const handleCancelEdit = () => {
    if (editingProject) {
      logUserAction('project_edit_cancelled', {
        projectId: editingProject.id,
        projectName: editingProject.project_name,
        timestamp: new Date().toISOString(),
      }, getUserId());
    }
    setEditingProject(null);
    setEditedName('');
  };

  if (status === 'loading' || hasAuthError) {
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
          ) : projects.length === 0 ? (
            <div className={styles.emptyState}>
              {t("Document.non-document")}
            </div>
          ) : (
            <div className={styles.projectListContainer}>
              <ul className={styles.projectList}>
                {projects.map((project, index) => {
                  const isCompleted = project.stage === STAGE.EXPORT || Number(project.stage) === 4;
                  const isMenuOpen = openMenuId === project.id;
                  
                  return (
                    <li
                      key={project.id}
                      className={`${styles.projectItem} ${isMenuOpen ? styles.menuOpen : ''}`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className={styles.projectItemInner}>
                        <button
                          onClick={() => handleSelectProject(project.id, project.project_name)}
                          className={`${styles.projectButton} ${isCompleted ? styles.completed : ''}`}
                        >
                          <span className={styles.projectName}>{project.project_name}</span>
                          <div className={styles.projectMeta}>
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
                          onClick={(e) => handleToggleMenu(e, project.id)}
                          className={styles.menuButton}
                        >
                          ⋮
                        </button>
                      </div>

                      {isMenuOpen && (
                        <div className={styles.dropdownMenu}>
                          <button
                            onClick={(e) => handleEditClick(e, project)}
                            className={styles.menuItem}
                          >
                            {t("Utils.edit")}
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(e, project.id)}
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
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              placeholder={t("Document.project-name-placeholder")}
              className={styles.input}
              disabled={creating}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !creating && newProjectName.trim()) {
                  handleCreateProject();
                }
              }}
            />
            <button
              onClick={handleCreateProject}
              disabled={creating || !newProjectName.trim()}
              className={styles.createButton}
            >
              {creating ? t("Document.loading-text") : t("Document.create-button-text")}
            </button>
          </div>
        </div>

        {editingProject && (
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

export default Projects;
