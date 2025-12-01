import React, { useState, useCallback, FormEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import styles from '../styles/Login.module.css';

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
      router.push('/projects');
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

  if (loading) {
    return <div className={styles.loading}>{t('Loading...')}</div>;
  }

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleLogin}>
        <h2 className={styles.title}>
          {t('Login.title')}
        </h2>

        {(authError || router.query.error) && (
          <p className={styles.error}>
            {authError || t('Login.error-message')}
          </p>
        )}

        <div className={styles.inputGroup}>
          <label htmlFor="email" className={styles.label}>
            {t('Login.email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="password" className={styles.label}>
            {t('Login.password')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            required
          />
        </div>

        <button
          type="submit"
          className={styles.button}
          disabled={loading}
        >
          {loading ? t('Login.logging-in') : t('Login.button-text')}
        </button>
      </form>

      <p className={styles.footer}>
        {t('Login.no-account')}<br />
        <Link href="/signup" className={styles.link}>
          {t('Login.signup-link-text')}
        </Link>
      </p>
    </div>
  );
};

export default LoginPage;
