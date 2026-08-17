import type { ApiResponse, ErrorCode } from '@/types/api';

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
    public fields?: string[],
  ) {
    super(message);
  }
}

type JsonInit = Omit<RequestInit, 'body'> & { body?: unknown };

export async function api<T>(path: string, init: JsonInit = {}): Promise<T> {
  const { body, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const json = (await res.json()) as ApiResponse<T>;
  if (!json.ok) {
    throw new ApiError(json.error.code, json.error.message, res.status, json.error.fields);
  }
  return json.data;
}
