const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

let _accessToken: string | null = null;

export function getAccessToken() {
  return _accessToken;
}

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    _accessToken = data.access_token;
    return _accessToken;
  } catch {
    return null;
  }
}

export async function logout() {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  _accessToken = null;
}
