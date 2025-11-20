import React, { useState, useCallback, FormEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import styles from '../styles/Home.module.css';
import Link from 'next/link';
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateUsername,
} from '../utils/validation';

const SignupPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 各入力欄ごとのエラーを保持
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleSignup = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    // フォーム送信時にすべてのバリデーションを確認
    const uError = validateUsername(username, t);
    const eError = validateEmail(email, t);
    const pError = validatePassword(password, t);
    const cError = validateConfirmPassword(password, confirmPassword, t);

    setUsernameError(uError);
    setEmailError(eError);
    setPasswordError(pError);
    setConfirmPasswordError(cError);

    if (uError || eError || pError || cError) {
      setFormError(t('Signup.validation.fix-errors')); // 全体エラー
      return;
    }

    try {
      const res = await fetch(`/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, confirm_password: confirmPassword }),
      });

      const data = await res.json().catch(() => ({})); // JSON parse error対策

      if (!res.ok) {
        // FastAPI側の detail, message, errors などを確認して表示
        const errorMessage =
          (data.detail as string) ||
          (Array.isArray(data.errors) ? data.errors.join(', ') : undefined) ||
          t('Signup.error');
        setFormError(errorMessage);
        return;
      }

      setSuccessMessage(t('Signup.success'));

      // 自動ログイン
      const loginResult = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (loginResult?.ok) {
        router.push('/');
      } else {
        // ログイン失敗時にフォームエラー表示も可
        setFormError(t('Signup.login-failed'));
        router.push('/login');
      }
    } catch (err: unknown) {
      console.error('Signup error:', err);

      // ネットワークエラーや予期しないエラーも明確に
      if (err instanceof Error) {
        setFormError(`${t('Signup.error')}: ${err.message}`);
      } else {
        setFormError(t('Signup.error'));
      }
    }
  }, [username, email, password, confirmPassword, router, t]);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    outline: 'none',
  };

  const errorTextStyle: React.CSSProperties = {
    color: '#dc2626',
    fontSize: '0.85rem',
    marginTop: '4px',
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

        {formError && <p style={{ color: '#dc2626', textAlign: 'center' }}>{formError}</p>}
        {successMessage && <p style={{ color: '#16a34a', textAlign: 'center' }}>{successMessage}</p>}

        {/* ユーザ名入力 */}
        <div>
          <label htmlFor="username">{t('Signup.username')}</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onBlur={() => setUsernameError(validateUsername(username, t))} // blur時にチェック
            required
            style={inputStyle}
          />
          {usernameError && <p style={errorTextStyle}>{usernameError}</p>}
        </div>

        {/* メールアドレス入力 */}
        <div>
          <label htmlFor="email">{t('Signup.email')}</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onBlur={() => setEmailError(validateEmail(email, t))}
            required
            style={inputStyle}
          />
          {emailError && <p style={errorTextStyle}>{emailError}</p>}
        </div>

        {/* パスワード入力 */}
        <div>
          <label htmlFor="password">{t('Signup.password')}</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onBlur={() => setPasswordError(validatePassword(password, t))}
            required
            style={inputStyle}
          />
          {passwordError && <p style={errorTextStyle}>{passwordError}</p>}
        </div>

        {/* パスワード確認 */}
        <div>
          <label htmlFor="confirm-password">{t('Signup.confirm-password')}</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            onBlur={() => setConfirmPasswordError(validateConfirmPassword(password, confirmPassword, t))}
            required
            style={inputStyle}
          />
          {confirmPasswordError && <p style={errorTextStyle}>{confirmPasswordError}</p>}
        </div>

        {/* サインアップボタン */}
        <button type="submit" style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          {t('Signup.button-text')}
        </button>
      </form>

      {/* ログインリンク */}
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
