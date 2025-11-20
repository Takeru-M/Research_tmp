import React, { useState, useCallback, FormEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useSession();
  const loading = status === 'loading';

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleLogin = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setAuthError(t('Login.error-message'));
      console.error("Login failed:", result.error);
    }
  }, [email, password, t]);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    outline: 'none',
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
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>{t('Loading...')}</div>;
  }

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      padding: '20px',
    }}>
      <form style={{
        width: '100%',
        maxWidth: '400px',
        padding: '30px',
        borderRadius: '16px',
        backgroundColor: '#fff',
        boxShadow: '0 8px 24px rgba(149, 157, 165, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }} onSubmit={handleLogin}>
        <h2 style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: 600, color: '#333' }}>
          {t('Login.title')}
        </h2>

        {(authError || router.query.error) && (
          <p style={{ color: '#dc2626', textAlign: 'center' }}>
            {authError || t('Login.error-message')}
          </p>
        )}

        <div>
          <label htmlFor="email">{t('Login.email')}</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            required
          />
        </div>

        <div>
          <label htmlFor="password">{t('Login.password')}</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            required
          />
        </div>

        <button type="submit" style={buttonStyle}>
          {loading ? t('Login.logging-in') : t('Login.button-text')}
        </button>
      </form>

      <p style={{ marginTop: '15px', textAlign: 'center', fontSize: '0.9rem', color: '#4b5563' }}>
        {t('Login.no-account')}<br />
        <Link href="/signup" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
          {t('Login.signup-link-text')}
        </Link>
      </p>
    </div>
  );
};

export default LoginPage;
