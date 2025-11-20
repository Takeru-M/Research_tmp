import { TFunction } from 'i18next';

/**
 * メールアドレスのバリデーション
 * - 空欄チェックはHTML側のrequiredで対応
 * - 正規表現で形式チェック
 */
export const validateEmail = (email: string, t: TFunction): string | null => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) ? null : t('Signup.validation.email-invalid');
};

/**
 * パスワードのバリデーション
 * - 8文字以上
 * - 大文字1文字以上
 * - 小文字1文字以上
 * - 数字1文字以上
 */
export const validatePassword = (password: string, t: TFunction): string | null => {
  if (password.length < 8) return t('Signup.validation.password-min');
  if (!/[A-Z]/.test(password)) return t('Signup.validation.password-uppercase');
  if (!/[a-z]/.test(password)) return t('Signup.validation.password-lowercase');
  if (!/\d/.test(password)) return t('Signup.validation.password-number');
  return null;
};

/**
 * パスワード確認用のバリデーション
 * - パスワードと確認用パスワードが一致しているか
 */
export const validateConfirmPassword = (password: string, confirmPassword: string, t: TFunction): string | null => {
  return password === confirmPassword ? null : t('Signup.validation.password-confirm');
};

/**
 * ユーザ名のバリデーション
 * - 3文字以上
 */
export const validateUsername = (username: string, t: TFunction): string | null => {
  if (!username || username.length < 3) return t('Signup.validation.username-min');
  return null;
};
