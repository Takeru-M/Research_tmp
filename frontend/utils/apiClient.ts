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

const API_BASE_URL = process.env.NEXT_PUBLIC_NEXT_API_URL1 || '';

export async function apiClient<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {}, responseType = 'json' } = options;

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = res.headers.get('Content-Type') || '';

    if (!res.ok) {
      const errorText = await res.text();
      return {
        data: null,
        error: errorText || res.statusText,
        status: res.status
      };
    }

    let data: T | null = null;
    
    if (method === 'DELETE') {
      data = null;
    } else if (responseType === 'arrayBuffer') {
      data = (await res.arrayBuffer()) as T;
    } else if (responseType === 'text') {
      data = (await res.text()) as T;
    } else if (contentType.includes('application/json')) {
      data = await res.json();
    }

    return { data, error: null, status: res.status };
  } catch (err: any) {
    return {
      data: null,
      error: err.message || 'Unknown error',
      status: 0 // ネットワークエラー等
    };
  }
}
