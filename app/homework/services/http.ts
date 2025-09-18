export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

const DEFAULT_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
};

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    ?? (typeof window === "undefined"
      ? process.env.INTERNAL_API_BASE_URL ?? "http://localhost:3000"
      : window.location.origin);
  const basePath = path.startsWith("http") ? path : `${origin ?? ""}${path}`;
  if (!params) return basePath;
  const url = new URL(basePath);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    url.searchParams.append(key, String(value));
  });
  return url.toString();
}

export async function http<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...init } = options;
  const url = buildUrl(path, params);
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const response = await fetch(url, {
    ...init,
    headers: isFormData ? headers : { ...DEFAULT_HEADERS, ...headers },
    cache: "no-store",
  });

  if (!response.ok) {
    let payload: unknown = undefined;
    try {
      payload = await response.json();
    } catch {
      // ignore
    }
    const error = new Error(
      response.statusText || "Request failed",
    ) as Error & { status?: number; payload?: unknown };
    error.status = response.status;
    if (payload) error.payload = payload;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
