import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { STAGE } from '../utils/constants';
import type { Project } from '../redux/features/editor/editorTypes';
import Cookies from 'js-cookie';
import { useTranslation } from 'react-i18next';
import { clearAllState } from '../redux/features/editor/editorSlice';

const Projects: React.FC = () => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const dispatch = useDispatch();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      dispatch(clearAllState());
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('ドキュメント一覧の取得に失敗しました');
        const data: Project[] = await res.json();
        setProjects(data);
      } catch (err: any) {
        setError(err.message || '不明なエラー');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [session, status, router]);

  const handleSelectProject = (projectId: number) => {
    // 選択したドキュメントIDをクッキーに保存
    Cookies.set('projectId', projectId.toString(), { expires: 7, sameSite: 'lax', secure: true });
    router.push('/');
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: newProjectName,
          stage: STAGE.GIVE_OPTION_TIPS,
        }),
      });
      if (!res.ok) throw new Error('ドキュメント作成に失敗しました');
      const newProject: Project = await res.json();
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

  if (status === 'loading') {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>;
  }

  // ルーターが準備完了しているか確認
  if (!router.isReady) return null;

  // 現在のページが /projects ページかどうかを判定
  const isProjectsPage = router.pathname === '/projects';

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
            padding: '8px'
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
                    }}
                  >
                    <button
                      onClick={() => handleSelectProject(project.id)}
                      style={{
                        width: '100%',
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
                            marginLeft: '12px',
                            border: '1px solid #bbf7d0',
                          }}
                          aria-label="完了"
                          title="完了"
                        >
                            完了
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.9rem',
                            color: '#6b7280',
                            marginLeft: '12px',
                          }}
                        >
                          →
                        </span>
                      )}
                    </button>
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

      {/* ドキュメント一覧に戻るボタン (projectsページ以外で表示) */}
      {!isProjectsPage && (
        <button
          onClick={() => router.push('/projects')}
          style={{
            padding: '6px 14px',
            cursor: 'pointer',
            backgroundColor: '#f1f3f5',
            border: '1px solid #d0d7de',
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: '#333',
            fontWeight: 600,
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '16px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e9ecef';
            e.currentTarget.style.borderColor = '#c1c8ce';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f1f3f5';
            e.currentTarget.style.borderColor = '#d0d7de';
          }}
        >
          <span>←</span>
          <span>{t("Document.document-list")}</span>
        </button>
      )}

      {/* PDF倍率変更UI (projectsページ以外で表示) */}
      {/* TODO: いらんとこでは非表示 */}
      {!isProjectsPage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
          <label htmlFor="pdf-scale-select">倍率:</label>
          <select
            id="pdf-scale-select"
            value={1}
            onChange={() => {}}
            style={{ padding: '5px', minWidth: '80px' }}
          >
            <option value={1}>100%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
          </select>
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
