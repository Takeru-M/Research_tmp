type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiRequestOptions {
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
  responseType?: 'json' | 'arrayBuffer' | 'text' | 'blob';
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

interface ErrorResponse {
  detail: string | { msg?: string }[] | Array<{ loc?: any; msg?: string; type?: string }>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL_LOCAL;

async function parseErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get('Content-Type') || '';
  const fallback = res.statusText || 'Request failed';

  try {
    if (contentType.includes('application/json')) {
      const json = (await res.json()) as ErrorResponse;
      const detail: any = (json as any)?.detail;

      if (!detail) return fallback;
      if (typeof detail === 'string') return detail;

      if (Array.isArray(detail)) {
        const msgs = detail
          .map((e: any) => {
            if (typeof e === 'string') return e;
            if (e?.msg) return e.msg;
            return '';
          })
          .filter(Boolean);
        if (msgs.length > 0) return msgs.join('\n');
      }
      return fallback;
    }

    const text = await res.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

// Markdown コードブロック除去と JSON パース
export function parseJSONResponse(responseText: string): any {
  try {
    return JSON.parse(responseText);
  } catch (e) {
    // Markdown コードブロックを除去してリトライ
    const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw e;
  }
}

// セッション切れ時の処理関数
async function handleSessionExpired(): Promise<void> {
  // next-auth の signOut を呼び出す
  const { signOut } = await import('next-auth/react');
  
  // 現在のURLを保存
  const currentPath = window.location.pathname + window.location.search;
  
  await signOut({ redirect: false });
  
  // メッセージ表示用のダイアログ
  const message = 'セッションが切れました。ログインページにリダイレクトします。';
  
  // ブラウザのアラート、またはカスタムダイアログを表示
  if (typeof window !== 'undefined') {
    // カスタムダイアログを表示する場合は、以下のようにする
    const showDialog = (): Promise<void> => {
      return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'alertdialog');
        dialog.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 10000;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          max-width: 400px;
        `;
        
        const title = document.createElement('h2');
        title.style.cssText = 'margin: 0 0 12px 0; font-size: 18px; color: #d32f2f;';
        title.textContent = 'セッションが切れました';
        
        const text = document.createElement('p');
        text.style.cssText = 'margin: 0 0 16px 0; font-size: 14px; color: #666;';
        text.textContent = 'ログインページにリダイレクトしています...';
        
        dialog.appendChild(title);
        dialog.appendChild(text);
        document.body.appendChild(dialog);
        
        // 2秒後にリダイレクト
        setTimeout(() => {
          document.body.removeChild(dialog);
          resolve();
        }, 2000);
      });
    };
    
    await showDialog();
  }
  
  // ログインページにリダイレクト（リダイレクト先のURLを指定）
  const loginUrl = `/login?error=session_expired&callbackUrl=${encodeURIComponent(currentPath)}`;
  window.location.href = loginUrl;
}

export async function apiClient<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const startTime = performance.now();
  const { method = 'GET', body, headers = {}, responseType = 'json' } = options;

  try {
    const fetchHeaders: Record<string, string> = { ...headers };

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body && !isFormData && !fetchHeaders['Content-Type']) {
      fetchHeaders['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: fetchHeaders,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });

    // セッション切れ判定（401 or 403）
    if (res.status === 401 || res.status === 403) {
      console.warn('[apiClient] Session expired detected. Status:', res.status);
      await handleSessionExpired();
      // リダイレクト後は実行されないが、念のため終了
      return { data: null, error: 'Session expired', status: res.status };
    }

    if (!res.ok) {
      const errorMessage = await parseErrorMessage(res);
      return { data: null, error: errorMessage, status: res.status };
    }

    const contentType = res.headers.get('Content-Type') || '';
    let data: T | null = null;

    if (responseType === 'arrayBuffer') {
      data = (await res.arrayBuffer()) as T;
    } else if (responseType === 'blob') {
      data = (await res.blob()) as T;
    } else if (responseType === 'text') {
      const text = await res.text();
      data = (text?.length ? (text as T) : (method === 'DELETE' ? ({ success: true } as T) : null));
    } else {
      const text = await res.text();
      if (!text || text.length === 0) {
        data = (method === 'DELETE' ? ({ success: true } as T) : null);
      } else if (contentType.includes('application/json')) {
        data = JSON.parse(text);
      } else {
        data = text as T;
      }
    }

    return { data, error: null, status: res.status };
  } catch (err: any) {
    return {
      data: null,
      error: err?.message || 'ネットワークエラーが発生しました',
      status: 0,
    };
  }
}
