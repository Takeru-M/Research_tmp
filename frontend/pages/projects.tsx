import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { STAGE } from '../utils/constants';
import type { Project } from '../redux/features/editor/editorTypes';
import Cookies from 'js-cookie';
import { useTranslation } from 'react-i18next';
import { clearAllState } from '../redux/features/editor/editorSlice';
import { setDocumentName } from '../redux/features/editor/editorSlice';
import { apiClient } from '../utils/apiClient';

const Projects: React.FC = () => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editedName, setEditedName] = useState('');
  const router = useRouter();
  const dispatch = useDispatch();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;
    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      dispatch(clearAllState());
      const { data, error } = await apiClient<Project[]>('/projects');
      if (error) throw new Error('ドキュメント一覧の取得に失敗しました');
      setProjects(data || []);
      setLoading(false);
    };
    fetchProjects();
  }, [session, status, router, dispatch]);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  const handleSelectProject = (projectId: number, projectName: string) => {
    // 選択したドキュメントIDをクッキーに保存
    Cookies.set('projectId', projectId.toString(), { expires: 7, sameSite: 'lax', secure: true });
    
    // プロジェクト名を Redux に保存
    dispatch(setDocumentName(projectName));
    
    router.push('/');
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { data, error } = await apiClient<Project>('/projects', {
        method: 'POST',
        body: {
          project_name: newProjectName,
          stage: STAGE.GIVE_OPTION_TIPS,
        },
      });
      if (error) throw new Error('ドキュメント作成に失敗しました');
      const newProject: Project = data as Project;
      setProjects([...projects, newProject]);
      setNewProjectName('');

      // 新規作成したドキュメントIDをクッキーに保存してトップページへ遷移
      Cookies.set('projectId', newProject.id.toString(), { sameSite: 'lax', secure: true });
      Cookies.set('completionStage', STAGE.GIVE_OPTION_TIPS.toString(), { sameSite: 'lax', secure: true });
      router.push('/');
    } catch (err: any) {
      setError(err.message || '不明なエラー');
    } finally {
      setCreating(false);
    }
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
    
    // try {
    //   const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      
    //   // 204 No Content は成功
    //   if (res.status === 204 || res.ok) {
    //     setProjects(projects.filter(p => p.id !== projectId));
    //     setOpenMenuId(null);
    //     return;
    //   }
      
    //   // エラーレスポンスの処理
    //   const errorData = await res.json().catch(() => ({ message: '削除に失敗しました' }));
    //   throw new Error(errorData.message || '削除に失敗しました');
    // } catch (err: any) {
    //   console.error('Delete error:', err);
    //   setError(err.message || '不明なエラー');
    // }
    const { data, error } = await apiClient<null>(`/projects/${projectId}`, {
      method: 'DELETE',
    });
    if (error) throw new Error('削除に失敗しました');
    setProjects(projects.filter(p => p.id !== projectId));
    setOpenMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingProject || !editedName.trim()) return;
    
    try {
      const { data, error } = await apiClient<Project>(`/projects/${editingProject.id}`, {
        method: 'PUT',
        body: { project_name: editedName },
      });
      if (error) throw new Error('更新に失敗しました');
      const updated: Project = data as Project;
      setProjects(projects.map(p => p.id === updated.id ? updated : p));
      setEditingProject(null);
      setEditedName('');
    } catch (err: any) {
      setError(err.message || '不明なエラー');
    }
  };

  const handleCancelEdit = () => {
    setEditingProject(null);
    setEditedName('');
  };

  if (status === 'loading') {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>;
  }

  // ルーターが準備完了しているか確認
  if (!router.isReady) return null;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      width: '100%'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(149, 157, 165, 0.15)',
        padding: '40px',
        width: '100%',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: '#1e40af',
          marginBottom: '32px',
          textAlign: 'center',
          borderBottom: '3px solid #3b82f6',
          paddingBottom: '16px'
        }}>
          {t("Document.document-list")}
        </h2>

        {error && (
          <div style={{
            color: '#dc2626',
            marginBottom: '20px',
            textAlign: 'center',
            background: '#fee2e2',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #fecaca'
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#6b7280',
            fontSize: '1.1rem'
          }}>
            読み込み中...
          </div>
        ) : projects.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#6b7280',
            marginBottom: '32px',
            padding: '40px 20px',
            background: '#f9fafb',
            borderRadius: '12px',
            fontSize: '1rem'
          }}>
            {t("Document.non-document")}
          </div>
        ) : (
          <div style={{
            marginBottom: '32px',
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '8px',
            position: 'relative',
            overflowX: 'visible'
          }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {projects.map((project, index) => {
                const isCompleted = project.stage === STAGE.EXPORT || Number(project.stage) === 4;
                return (
                  <li
                    key={project.id}
                    style={{
                      marginBottom: '12px',
                      animation: `fadeIn 0.3s ease-in ${index * 0.1}s both`,
                      position: 'relative',
                      zIndex: openMenuId === project.id ? 100 : 1,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        position: 'relative',
                      }}
                    >
                      <button
                        onClick={() => handleSelectProject(project.id, project.project_name)}
                        style={{
                          flex: 1,
                          padding: '16px 20px',
                          borderRadius: '12px',
                          border: isCompleted ? '2px solid #86efac' : '2px solid #e5e7eb',
                          background: isCompleted
                            ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)'
                            : 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                          cursor: 'pointer',
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          textAlign: 'left',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                          color: isCompleted ? '#14532d' : '#1f2937',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                        onMouseEnter={(e) => {
                          if (isCompleted) {
                            e.currentTarget.style.background =
                              'linear-gradient(135deg, #bbf7d0 0%, #a7f3d0 100%)';
                            e.currentTarget.style.borderColor = '#22c55e';
                            e.currentTarget.style.boxShadow =
                              '0 4px 12px rgba(34, 197, 94, 0.3)';
                          } else {
                            e.currentTarget.style.background =
                              'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)';
                            e.currentTarget.style.borderColor = '#3b82f6';
                            e.currentTarget.style.boxShadow =
                              '0 4px 12px rgba(59, 130, 246, 0.3)';
                          }
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isCompleted
                            ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)'
                            : 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)';
                          e.currentTarget.style.borderColor = isCompleted ? '#86efac' : '#e5e7eb';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow =
                            '0 2px 4px rgba(0,0,0,0.05)';
                        }}
                      >
                        <span style={{ flex: 1 }}>{project.project_name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isCompleted ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                background: '#dcfce7',
                                color: '#166534',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                border: '1px solid #bbf7d0',
                              }}
                              aria-label={t("Utils.complete")}
                              title={t("Utils.complete")}
                            >
                              {t("Utils.complete")}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.9rem',
                                color: '#6b7280',
                              }}
                            >
                              →
                            </span>
                          )}
                        </div>
                      </button>

                      {/* 3点メニューボタン - ボタンの外側に配置 */}
                      <button
                        onClick={(e) => handleToggleMenu(e, project.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '8px',
                          fontSize: '1.2rem',
                          color: '#6b7280',
                          borderRadius: '4px',
                          transition: 'background 0.2s',
                          marginLeft: '8px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        ⋮
                      </button>
                    </div>

                    {/* ドロップダウンメニュー */}
                    {openMenuId === project.id && (
                      <div
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '60px',
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          zIndex: 1000,
                          minWidth: '120px',
                        }}
                      >
                        <button
                          onClick={(e) => handleEditClick(e, project)}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            color: '#374151',
                            borderBottom: '1px solid #f3f4f6',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          {t("Utils.edit")}
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(e, project.id)}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            color: '#dc2626',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#fef2f2';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
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

        <div style={{
          borderTop: '2px solid #e5e7eb',
          paddingTop: '24px'
        }}>
          <h3 style={{
            fontSize: '1.2rem',
            fontWeight: 600,
            color: '#374151',
            marginBottom: '16px'
          }}>
            {t("Document.create-new-document")}
          </h3>
          <input
            type="text"
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            placeholder={t("Document.project-name-placeholder")}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '10px',
              border: '2px solid #d1d5db',
              marginBottom: '16px',
              fontSize: '1rem',
              transition: 'border-color 0.2s',
              outline: 'none'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
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
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              background: creating || !newProjectName.trim() ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              cursor: creating || !newProjectName.trim() ? 'not-allowed' : 'pointer',
              fontSize: '1.05rem',
              fontWeight: 700,
              transition: 'all 0.2s',
              boxShadow: creating || !newProjectName.trim() ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.4)'
            }}
            onMouseEnter={(e) => {
              if (!creating && newProjectName.trim()) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = creating || !newProjectName.trim() ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.4)';
            }}
          >
            {creating ? t("Document.loading-text") : t("Document.create-button-text")}
          </button>
        </div>
      </div>

      {/* 編集モーダル */}
      {editingProject && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleCancelEdit}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#1f2937',
              marginBottom: '24px',
            }}>
              {t("Document.edit-name")}
            </h3>
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '10px',
                border: '2px solid #d1d5db',
                marginBottom: '24px',
                fontSize: '1rem',
                outline: 'none',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelEdit}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#6b7280',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                }}
              >
                {t("Utils.cancel")}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editedName.trim()}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: !editedName.trim() ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#fff',
                  cursor: !editedName.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                  boxShadow: !editedName.trim() ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.4)',
                }}
                onMouseEnter={(e) => {
                  if (editedName.trim()) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = !editedName.trim() ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.4)';
                }}
              >
                {t("Utils.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Projects;
