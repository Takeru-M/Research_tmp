import React, { useState, useCallback, FormEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { logUserAction } from '../utils/logger';
import { apiClient } from '@/utils/apiClient';
import styles from '../styles/Signup.module.css';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      router.replace('/projects');
    }
  }, [status, router]);

  const handleSignup = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const uError = validateUsername(username, t);
    const eError = validateEmail(email, t);
    const pError = validatePassword(password, t);
    const cError = validateConfirmPassword(password, confirmPassword, t);

    setUsernameError(uError);
    setEmailError(eError);
    setPasswordError(pError);
    setConfirmPasswordError(cError);

    if (uError || eError || pError || cError) {
      logUserAction('signup_validation_failed', {
        errors: {
          username: !!uError,
          email: !!eError,
          password: !!pError,
          confirmPassword: !!cError,
        },
        timestamp: new Date().toISOString(),
      });
      setFormError(t('Signup.validation.fix-errors'));
      return;
    }

    setIsSubmitting(true);

    logUserAction('signup_attempt', {
      username,
      email: email.replace(/(.{2})(.*)(.{2})@(.*)/, '$1***$3@$4'), // メールアドレスをマスク
      timestamp: new Date().toISOString(),
    });

    const { data, error } = await apiClient<any>('/signup', {
      method: 'POST',
      body: {
        username,
        email,
        password,
        confirm_password: confirmPassword
      },
    });

    if (error) {
      console.error('[Signup] Signup error:', error);
      logUserAction('signup_failed', {
        reason: error,
        timestamp: new Date().toISOString(),
      });
      setFormError(error);
      setIsSubmitting(false);
      return;
    }

    if (!data) {
      console.warn('[Signup] No data received');
      logUserAction('signup_failed', {
        reason: 'no_data_received',
        timestamp: new Date().toISOString(),
      });
      setFormError(t('Signup.error'));
      setIsSubmitting(false);
      return;
    }

    logUserAction('signup_success', {
      username,
      email: email.replace(/(.{2})(.*)(.{2})@(.*)/, '$1***$3@$4'),
      timestamp: new Date().toISOString(),
    });
    setSuccessMessage(t('Signup.success'));

    const loginResult = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    if (loginResult?.ok) {
      logUserAction('auto_login_after_signup', {
        username,
        timestamp: new Date().toISOString(),
      });
      router.replace('/projects');
    } else {
      console.error('[Signup] Auto-login failed');
      logUserAction('auto_login_after_signup_failed', {
        reason: loginResult?.error,
        timestamp: new Date().toISOString(),
      });
      setFormError(t('Signup.login-failed'));
      setIsSubmitting(false);
    }
  }, [username, email, password, confirmPassword, router, t]);

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSignup}>
        <h2 className={styles.title}>
          {t('Signup.title')}
        </h2>

        {formError && <p className={styles.formError}>{formError}</p>}
        {successMessage && <p className={styles.successMessage}>{successMessage}</p>}

        <div className={styles.inputGroup}>
          <label htmlFor="username" className={styles.label}>
            {t('Signup.username')}
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onBlur={() => setUsernameError(validateUsername(username, t))}
            required
            className={`${styles.input} ${usernameError ? styles.inputError : ''}`}
          />
          {usernameError && <p className={styles.errorText}>{usernameError}</p>}
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="email" className={styles.label}>
            {t('Signup.email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onBlur={() => setEmailError(validateEmail(email, t))}
            required
            className={`${styles.input} ${emailError ? styles.inputError : ''}`}
          />
          {emailError && <p className={styles.errorText}>{emailError}</p>}
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="password" className={styles.label}>
            {t('Signup.password')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onBlur={() => setPasswordError(validatePassword(password, t))}
            required
            className={`${styles.input} ${passwordError ? styles.inputError : ''}`}
          />
          {passwordError && <p className={styles.errorText}>{passwordError}</p>}
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="confirm-password" className={styles.label}>
            {t('Signup.confirm-password')}
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            onBlur={() => setConfirmPasswordError(validateConfirmPassword(password, confirmPassword, t))}
            required
            className={`${styles.input} ${confirmPasswordError ? styles.inputError : ''}`}
          />
          {confirmPasswordError && <p className={styles.errorText}>{confirmPasswordError}</p>}
        </div>

        <button type="submit" className={styles.button} disabled={isSubmitting}>
          {isSubmitting ? t('Signup.submitting') : t('Signup.button-text')}
        </button>
      </form>

      <p className={styles.footer}>
        {t('Signup.has-account')}<br />
        <Link href="/login" className={styles.link}>
          {t('Signup.login-link-text')}
        </Link>
      </p>
    </div>
  );
};

export default SignupPage;
