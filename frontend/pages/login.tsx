import React, { useState, useCallback, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { logUserAction } from '../utils/logger';
import styles from '../styles/Login.module.css';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();
  const { status, data: session } = useSession({
    required: false,
  });

  // ユーザーIDを取得するヘルパー関数
  const getUserId = useCallback(() => {
    return session?.user?.id || session?.user?.email || 'anonymous';
  }, [session]);

  const handleLogin = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);

    // ログイン試行時は匿名でログ記録（ユーザーIDがまだ確定していないため）
    logUserAction('login_attempt', {
      email: email.replace(/(.{2})(.*)(.{2})@(.*)/, '$1***$3@$4'),
      timestamp: new Date().toISOString(),
    }, 'anonymous'); // ログイン前は匿名

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    console.log("[Login] SignIn result:", result);

    if (result?.error) {
      console.error("[Login] Sign-in error:", result.error);
      logUserAction('login_failed', {
        reason: result.error,
        email: email.replace(/(.{2})(.*)(.{2})@(.*)/, '$1***$3@$4'),
        timestamp: new Date().toISOString(),
      }, 'anonymous'); // ログイン失敗時も匿名
      setAuthError(t('Login.error-message'));
      setIsLoading(false);
      return;
    }

    if (result?.ok) {
      console.log("[Login] Sign-in successful, redirecting to /projects");
      
      // ログイン成功後、セッション情報を取得するまで少し待つ
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // ログイン成功時はユーザーIDを記録
      // この時点ではまだsessionが更新されていない可能性があるため、emailを使用
      logUserAction('login_success', {
        email: email.replace(/(.{2})(.*)(.{2})@(.*)/, '$1***$3@$4'),
        timestamp: new Date().toISOString(),
      }, email); // ログイン成功時はemailをユーザーIDとして使用
      
      router.push('/projects');
    }
  }, [email, password, router, t]);

  if (status === 'loading') {
    return <div className={styles.loading}>{t('Loading...')}</div>;
  }

  if (status === "authenticated") {
    // 既にログイン済みの場合
    logUserAction('login_page_accessed_while_authenticated', {
      timestamp: new Date().toISOString(),
    }, getUserId());
    router.push('/projects');
    return null;
  }

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleLogin}>
        <h2 className={styles.title}>
          {t('Login.title')}
        </h2>

        {router.query.error === 'session-expired' && (
          <p className={styles.error}>
            {t('Alert.session-expired')}
          </p>
        )}

        {(authError || (router.query.error && router.query.error !== 'session-expired')) && (
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
            disabled={isLoading}
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
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          className={styles.button}
          disabled={isLoading}
        >
          {isLoading ? t('Login.logging-in') : t('Login.button-text')}
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
