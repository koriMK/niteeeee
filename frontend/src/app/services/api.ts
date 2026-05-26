const BASE_URL = import.meta.env.VITE_API_URL || '';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}
function setCookie(name: string, value: string) {
  const isSecure = window.location.protocol === 'https:';
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Strict${isSecure ? '; Secure' : ''}`;
}
function deleteCookie(name: string) {
  const isSecure = window.location.protocol === 'https:';
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Strict${isSecure ? '; Secure' : ''}`;
}
function getToken() { return getCookie('access_token'); }
function getRefreshToken() { return getCookie('refresh_token'); }

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setCookie('access_token', data.access_token);
    setCookie('refresh_token', data.refresh_token);
    return true;
  } catch { return false; }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error('Could not connect to server. Please check your connection and try again.');
  }

  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, options, false);
    deleteCookie('access_token');
    deleteCookie('refresh_token');
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────
export interface AuthUser { id: number; phone: string; name: string | null }
export interface AuthResponse {
  access_token: string; refresh_token: string;
  token_type: string; user: AuthUser;
}

export async function checkPhone(phone: string): Promise<{ exists: boolean; phone: string; name: string | null }> {
  const safePhone = phone.replace(/[\r\n]/g, '');
  return request('/api/auth/check-phone', { method: 'POST', body: JSON.stringify({ phone: safePhone }) });
}

export async function createAccount(phone: string, pin: string, name?: string): Promise<AuthResponse> {
  const safePhone = phone.replace(/[\r\n]/g, '');
  const safePin = pin.replace(/[\r\n]/g, '');
  const safeName = name ? name.replace(/[\r\n]/g, '') : undefined;
  const data = await request<AuthResponse>('/api/auth/create-account', {
    method: 'POST', body: JSON.stringify({ phone: safePhone, pin: safePin, name: safeName }),
  });
  setCookie('access_token', data.access_token);
  setCookie('refresh_token', data.refresh_token);
  return data;
}

export async function loginWithPin(phone: string, pin: string): Promise<AuthResponse> {
  const safePhone = phone.replace(/[\r\n]/g, '');
  const safePin = pin.replace(/[\r\n]/g, '');
  const data = await request<AuthResponse>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ phone: safePhone, pin: safePin }),
  });
  setCookie('access_token', data.access_token);
  setCookie('refresh_token', data.refresh_token);
  return data;
}

export async function forgotPin(phone: string): Promise<{ wa_link: string }> {
  const safePhone = phone.replace(/[\r\n]/g, '');
  return request(`/api/auth/forgot-pin?phone=${encodeURIComponent(safePhone)}`);
}

export function isLoggedIn() { return !!getToken(); }

export function logout() {
  deleteCookie('access_token');
  deleteCookie('refresh_token');
}

export async function logoutApi() {
  deleteCookie('access_token');
  deleteCookie('refresh_token');
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/me');
}

export async function updateProfile(name: string): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

// ── Products ──────────────────────────────────────────────
export interface BackendProduct {
  id: number; name: string; description: string | null;
  category: string; price: number; stock: number;
  unit: string; image_urls: string[]; is_active: boolean;
}

export async function fetchProducts(params?: { category?: string; search?: string }) {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  return request<{ items: BackendProduct[]; total: number }>(`/api/products${query ? `?${query}` : ''}`);
}

// ── Orders ────────────────────────────────────────────────
export interface OrderItemPayload { product_id: number; quantity: number }

export async function createOrder(items: OrderItemPayload[], delivery_address?: string, vendor_id?: number | null) {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ items, delivery_type: 'delivery', delivery_address, vendor_id }),
  });
}

export async function fetchMyOrders() { return request('/api/orders'); }

// ── Payments ──────────────────────────────────────────────
export async function initiateSTKPush(phone: string, amount: number, order_id?: number) {
  return request('/api/payments/stk-push', {
    method: 'POST', body: JSON.stringify({ phone, amount, order_id }),
  });
}

export async function checkPaymentStatus(checkout_request_id: string): Promise<{ checkout_request_id: string; status: 'pending' | 'completed' | 'failed'; amount: number; order_id: number | null }> {
  return request(`/api/payments/status/${checkout_request_id}`);
}

// ── App Config ─────────────────────────────────────────────
export interface AppConfig {
  whatsapp_number: string;
}

let cachedConfig: AppConfig | null = null;

export async function fetchConfig(): Promise<AppConfig> {
  return request<AppConfig>('/api/config');
}

export async function getAppConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    cachedConfig = await fetchConfig();
    return cachedConfig;
  } catch (err) {
    console.error('Failed to fetch config, using fallback:', err);
    return { whatsapp_number: '254792125943' };
  }
}
