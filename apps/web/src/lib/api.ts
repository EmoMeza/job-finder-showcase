export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isJson = body !== undefined && !(body instanceof FormData);
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include', // envía la cookie de sesión
    // Con FormData el navegador pone el Content-Type multipart con su boundary.
    headers: isJson ? { 'Content-Type': 'application/json' } : undefined,
    body: isJson ? JSON.stringify(body) : (body as FormData | undefined),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: unknown } | null;
    const message =
      typeof data?.message === 'string'
        ? data.message
        : `${method} ${path} respondió ${response.status}`;
    throw new ApiError(response.status, message);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const apiGet = <T>(path: string) => request<T>('GET', path);

export const apiPost = <T>(path: string, body?: unknown) => request<T>('POST', path, body);

export const apiPut = <T>(path: string, body: unknown) => request<T>('PUT', path, body);

export const apiDelete = <T>(path: string) => request<T>('DELETE', path);
