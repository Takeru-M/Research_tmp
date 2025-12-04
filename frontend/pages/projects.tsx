import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      signIn();
      return;
    }

    const fetchProjects = async () => {
      setLoading(true);
      setErrorMessage(null);
      dispatch(clearAllState());

      const { data, error, status: httpStatus } = await apiClient<Project[]>('/projects', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (error) {
        // 401など認証エラーの場合のみログインへ
        if (httpStatus === 401) {
          setHasAuthError(true);
          await signIn(undefined, { callbackUrl: '/projects' });
          return;
        }
        
        // それ以外のエラーはエラーメッセージのみ表示
        setErrorMessage(error);
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMessage(t('Error.fetch-projects-failed') || 'プロジェクト取得に失敗しました');
        setLoading(false);
        return;
      }

      setProjects(data);
      setHasAuthError(false);
      setLoading(false);
    };

    // 認証エラー発生中は再実行しない
    if (!hasAuthError) {
      fetchProjects();
    }
  }, [session, status, dispatch, t, hasAuthError]);

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
    router.push('/');
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    setCreating(true);
    setErrorMessage(null);

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
      setErrorMessage(error);
      setCreating(false);
      return;
    }

    if (!data) {
      setErrorMessage(t('Error.create-project-failed') || 'ドキュメント作成に失敗しました');
      setCreating(false);
      return;
    }

    const newProject: Project = data;
    setProjects([...projects, newProject]);
    setNewProjectName('');

    Cookies.set('projectId', newProject.id.toString(), { sameSite: 'lax', secure: true });
    Cookies.set('completionStage', STAGE.GIVE_OPTION_TIPS.toString(), { sameSite: 'lax', secure: true });
    
    setCreating(false);
    router.push('/?new=true');
  };

  const handleToggleMenu = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === projectId ? null : projectId);
  };

  const handleEditClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingProject(project);
    setEditedName(project.project_name);
    setOpenMenuId(null);
  };

  const handleDeleteClick = async (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    if (!confirm(t("Document.delete-confirm"))) return;
    
    setErrorMessage(null);

    const { error } = await apiClient<null>(`/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session?.accessToken}`,
      },
    });

    if (error) {
      setErrorMessage(error);
      setOpenMenuId(null);
      return;
    }

    setProjects(projects.filter(p => p.id !== projectId));
    setOpenMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingProject || !editedName.trim()) return;
    
    setErrorMessage(null);

    const { data, error } = await apiClient<Project>(`/projects/${editingProject.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${session?.accessToken}`,
      },
      body: { project_name: editedName },
    });

    if (error) {
      setErrorMessage(error);
      return;
    }

    if (!data) {
      setErrorMessage(t('Error.update-project-failed') || '更新に失敗しました');
      return;
    }

    const updated: Project = data;
    setProjects(projects.map(p => p.id === updated.id ? updated : p));
    setEditingProject(null);
    setEditedName('');
  };

  const handleCancelEdit = () => {
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
              読み込み中...
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
