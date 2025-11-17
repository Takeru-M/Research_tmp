import React, { useState, useCallback, FormEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useSession();
  const loading = status === 'loading';

  // 既に認証済みの場合はメインページにリダイレクト
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleLogin = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false, // ページ遷移は自分で行う
    });

    if (result && result.error) {
      // FastAPIからの認証エラーまたはネットワークエラー
      setAuthError(t('Login.error-message'));
      console.error("Login failed:", result.error);
    } else if (result && result.ok) {
      // 認証成功時、NextAuth.jsが自動でセッションを設定し、ページがリフレッシュされます。
      // useEffectでリダイレクトされるため、ここでは何もしません。
    }

  }, [username, password, t]);

  // スタイルの定義 (既存のまま)
const containerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f3f4f6',
    padding: '20px',
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '360px',
    padding: '30px',
    borderRadius: '16px',
    backgroundColor: '#ffffff',
    boxShadow: '0 8px 24px rgba(149, 157, 165, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  };

  const titleStyle: React.CSSProperties = {
    textAlign: 'center',
    fontSize: '1.6rem',
    fontWeight: 600,
    marginBottom: '5px',
    color: '#333',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.9rem',
    fontWeight: 500,
    marginBottom: '4px',
    color: '#4b5563',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const inputFocusStyle: React.CSSProperties = {
    borderColor: '#3b82f6',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.2)',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    backgroundColor: loading ? '#60a5fa' : '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.2s',
  };

  // NextAuthのロード中はスピナーなどを表示可能
  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>{t('Loading...')}</div>;
  }

  return (
    <div style={containerStyle}>
      <form style={cardStyle} onSubmit={handleLogin}>
        <h2 style={titleStyle}>{t('Login.title')}</h2>

        {(authError || router.query.error) && (
          <p style={{ color: '#dc2626', textAlign: 'center' }}>
            {authError || t('Login.error-message')}
          </p>
        )}

        <div>
          <label style={labelStyle} htmlFor="username">
            {t('Login.username')}
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onFocus={(e) =>
              Object.assign(e.target.style, inputFocusStyle)
            }
            onBlur={(e) =>
              Object.assign(e.target.style, inputStyle)
            }
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
            disabled={loading}
            required
          />
        </div>

        <div>
          <label style={labelStyle} htmlFor="password">
            {t('Login.password')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onFocus={(e) =>
              Object.assign(e.target.style, inputFocusStyle)
            }
            onBlur={(e) =>
              Object.assign(e.target.style, inputStyle)
            }
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            disabled={loading}
            required
          />
        </div>

        <button type="submit" style={buttonStyle} disabled={loading}>
          {loading ? t('Login.logging-in') : t('Login.button-text')}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;