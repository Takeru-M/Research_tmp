import React, { useState, useCallback, FormEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import styles from '../styles/Home.module.css';
import Link from 'next/link';

const SignupPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useSession();
  const loading = status === 'loading';

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleSignup = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError(t('Signup.password-mismatch'));
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || t('Signup.error'));
        return;
      }

      setSuccessMessage(t('Signup.success'));
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      console.error(err);
      setError(t('Signup.error'));
    }
  }, [username, email, password, confirmPassword, router, t]);

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
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      padding: '20px',
      width: '100%'
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
      }} onSubmit={handleSignup}>
        <h2 style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: 600, color: '#333' }}>
          {t('Signup.title')}
        </h2>

        {error && <p style={{ color: '#dc2626', textAlign: 'center' }}>{error}</p>}
        {successMessage && <p style={{ color: '#16a34a', textAlign: 'center' }}>{successMessage}</p>}

        <div>
          <label htmlFor="username">{t('Signup.username')}</label>
          <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} required />
        </div>

        <div>
          <label htmlFor="email">{t('Signup.email')}</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
        </div>

        <div>
          <label htmlFor="password">{t('Signup.password')}</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} required />
        </div>

        <div>
          <label htmlFor="confirm-password">{t('Signup.confirm-password')}</label>
          <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} required />
        </div>

        <button type="submit" style={buttonStyle}>{t('Signup.button-text')}</button>
      </form>

      <p style={{ marginTop: '15px', textAlign: 'center', fontSize: '0.9rem', color: '#4b5563' }}>
        {t('Signup.has-account')}<br />
        <Link href="/login" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
          {t('Signup.login-link-text')}
        </Link>
      </p>
    </div>
  );
};

export default SignupPage;
