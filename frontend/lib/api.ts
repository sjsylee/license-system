import { getAccessToken, refreshAccessToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  // Access token 만료 시 자동 갱신 후 재시도
  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, options, false);
    throw new ApiError(401, "Unauthorized");
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail ?? "API Error");
  return data as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// --- Auth ---
export const authApi = {
  login: (username: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
};

// --- Programs ---
export type MetaValueType = "int" | "str" | "bool" | "float";

export type MetaSchema = {
  id: number;
  key: string;
  value_type: MetaValueType;
  description: string | null;
  default_value: string | null;
};

export type Program = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  meta_schemas: MetaSchema[];
};

export const programApi = {
  list: () => request<Program[]>("/admin/programs"),
  get: (id: number) => request<Program>(`/admin/programs/${id}`),
  create: (name: string, description?: string) =>
    request<Program>("/admin/programs", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),
  update: (id: number, description: string) =>
    request<Program>(`/admin/programs/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ description }),
    }),
  delete: (id: number) =>
    request<void>(`/admin/programs/${id}`, { method: "DELETE" }),
  createMetaSchema: (programId: number, data: Omit<MetaSchema, "id">) =>
    request<MetaSchema>(`/admin/programs/${programId}/meta-schemas`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteMetaSchema: (schemaId: number) =>
    request<void>(`/admin/programs/meta-schemas/${schemaId}`, {
      method: "DELETE",
    }),
  uploadImage: async (id: number, file: File): Promise<Program> => {
    const { getAccessToken } = await import("./auth");
    const token = getAccessToken();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/admin/programs/${id}/upload-image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json();
      throw new ApiError(res.status, data.detail ?? "업로드 실패");
    }
    return res.json();
  },
};

// --- Licenses ---
export type Device = {
  id: number;
  hwid: string;
  device_name: string | null;
  activated_at: string;
  last_seen_at: string;
};

export type LicenseMeta = {
  key: string;
  value: string;
};

export type License = {
  id: number;
  program_id: number;
  username: string;
  license_key: string;
  expires_at: string | null;
  max_devices: number;
  is_active: boolean;
  created_at: string;
  user_id: string | null;
  email: string | null;
  phone: string | null;
  meta: LicenseMeta[];
  devices: Device[];
};

export type LicenseCreateInput = {
  program_id: number;
  username: string;
  expires_at?: string | null;
  max_devices?: number;
  meta?: { schema_id: number; value: string }[];
  user_id?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type LicenseUpdateInput = {
  expires_at?: string | null;
  max_devices?: number;
  is_active?: boolean;
  user_id?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type BulkLicenseItem = {
  username: string;
  license_key: string;
  expires_at: string | null;
};

export type BulkImportItemResult = {
  username: string;
  license_key: string;
  success: boolean;
  error: string | null;
};

export type BulkImportResponse = {
  total: number;
  imported: number;
  skipped: number;
  results: BulkImportItemResult[];
};

export const licenseApi = {
  list: (programId: number) =>
    request<License[]>(`/admin/licenses?program_id=${programId}`),
  get: (id: number) => request<License>(`/admin/licenses/${id}`),
  create: (data: LicenseCreateInput) =>
    request<License>("/admin/licenses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: LicenseUpdateInput) =>
    request<License>(`/admin/licenses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<void>(`/admin/licenses/${id}`, { method: "DELETE" }),
  removeDevice: (licenseId: number, hwid: string) =>
    request<void>(
      `/admin/licenses/${licenseId}/devices/${encodeURIComponent(hwid)}`,
      { method: "DELETE" }
    ),
  bulkImport: (
    programId: number,
    maxDevices: number,
    licenses: BulkLicenseItem[],
    meta: { schema_id: number; value: string }[] = [],
  ) =>
    request<BulkImportResponse>("/admin/licenses/bulk-import", {
      method: "POST",
      body: JSON.stringify({ program_id: programId, max_devices: maxDevices, licenses, meta }),
    }),
};
