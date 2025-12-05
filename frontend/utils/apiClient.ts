type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiRequestOptions {
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
  responseType?: 'json' | 'arrayBuffer' | 'text' | 'blob'; // 追加
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

interface ErrorResponse {
  detail: string | { msg?: string }[] | Array<{ loc?: any; msg?: string; type?: string }>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_NEXT_API_URL;

// FastAPIのエラーレスポンス(detailがstring or array)を安全に取り出して文字列化
async function parseErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get('Content-Type') || '';
  let fallback = res.statusText || 'Request failed';

  try {
    if (contentType.includes('application/json')) {
      const json = (await res.json()) as ErrorResponse;
      const detail = (json as any)?.detail;

      if (!detail) return fallback;

      // detail: string
      if (typeof detail === 'string') return detail;

      // detail: Array (422 ValidationErrorなど)
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

    // JSON以外のときはtextをそのまま
    const text = await res.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

export async function apiClient<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const startTime = performance.now();
  const { method = 'GET', body, headers = {}, responseType = 'json' } = options;

  try {
    const fetchHeaders: Record<string, string> = { ...headers };

    // Accept-Language を自動付与（未指定時のみ）
    if (!fetchHeaders['Accept-Language'] && typeof navigator !== 'undefined') {
      const lang = (navigator.language || 'en').split('-')[0];
      fetchHeaders['Accept-Language'] = lang;
    }

    // Content-TypeはFormData以外かつ未指定時のみ自動付与
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body && !isFormData && !fetchHeaders['Content-Type']) {
      fetchHeaders['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: fetchHeaders,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });

    // const duration = performance.now() - startTime;
    // logApiCall(method, path, res.status, duration); // 削除

    if (!res.ok) {
      const errorMessage = await parseErrorMessage(res);
      return { data: null, error: errorMessage, status: res.status };
    }

    // 成功時のレスポンス解析
    let data: T | null = null;

    if (responseType === 'arrayBuffer') {
      data = (await res.arrayBuffer()) as T;
    } else if (responseType === 'blob') {
      data = (await res.blob()) as T;
    } else if (responseType === 'text') {
      data = (await res.text()) as T;
    } else {
      // json優先だが、空ボディも許容
      const contentType = res.headers.get('Content-Type') || '';
      const text = await res.text();
      if (!text || text.length === 0) {
        data = null;
      } else if (contentType.includes('application/json')) {
        data = JSON.parse(text);
      } else {
        // JSON以外が返るケースはtextとして返す
        data = text as T;
      }
    }

    return { data, error: null, status: res.status };
  } catch (err: any) {
    // const duration = performance.now() - startTime;
    // logApiCall(method, path, 0, duration); // 削除
    return {
      data: null,
      error: err?.message || 'ネットワークエラーが発生しました',
      status: 0,
    };
  }
}
