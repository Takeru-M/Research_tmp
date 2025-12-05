type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiRequestOptions {
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
  responseType?: 'json' | 'arrayBuffer' | 'text';
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

interface ErrorResponse {
  detail: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiV1Client<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const startTime = performance.now();
  const { method = 'GET', body, headers = {}, responseType = 'json' } = options;

  try {
    const fetchHeaders: Record<string, string> = { ...headers };

    // bodyがある場合のみContent-Typeを追加
    if (body && !fetchHeaders['Content-Type']) {
      fetchHeaders['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: fetchHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    // const duration = performance.now() - startTime;
    // logApiCall(method, path, res.status, duration);

    const contentType = res.headers.get('Content-Type') || '';

    if (!res.ok) {
      let errorMessage = res.statusText;

      // エラーレスポンスのパース
      try {
        const errorText = await res.text();
        if (errorText) {
          // FastAPIのエラーレスポンス形式を処理
          const errorJson: ErrorResponse = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorText;
        }
      } catch (e) {
        // JSON パースに失敗した場合はそのままテキストを使用
      }

      return {
        data: null,
        error: errorMessage,
        status: res.status,
      };
    }

    let data: T | null = null;

    // レスポンスボディが空の場合の処理
    const text = await res.text();
    if (!text || text.length === 0) {
      data = (method === 'DELETE' ? { success: true } : null) as T;
    } else if (responseType === 'arrayBuffer') {
      // arrayBuffer の場合は再フェッチが必要
      const arrayRes = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: fetchHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
      data = (await arrayRes.arrayBuffer()) as T;
    } else if (responseType === 'text') {
      data = text as T;
    } else if (contentType.includes('application/json')) {
      data = JSON.parse(text);
    } else {
      data = text as T;
    }

    return { data, error: null, status: res.status };
  } catch (err: any) {
    // const duration = performance.now() - startTime;
    // logApiCall(method, path, 0, duration);
    return {
      data: null,
      error: err.message || 'ネットワークエラーが発生しました',
      status: 0,
    };
  }
}
