// Main API client - talks to gateway and identity services
import { env } from '$env/dynamic/public';

const GATEWAY = env.PUBLIC_GATEWAY_URL || 'http://localhost:3001';
const IDENTITY = env.PUBLIC_IDENTITY_URL || 'http://localhost:3005';
const NOTIF = env.PUBLIC_NOTIFICATION_URL || 'http://localhost:3004';

export { GATEWAY, IDENTITY, NOTIF };

async function apiFetch(path: string, opts: RequestInit = {}, token?: string | null) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(opts.headers as Record<string, string>)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${GATEWAY}${path}`, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, ...data };
    return data;
}

async function identityFetch(path: string, opts: RequestInit = {}, token?: string | null) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(opts.headers as Record<string, string>)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${IDENTITY}${path}`, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, ...data };
    return data;
}

export const api = {
    login: async (student_id: string, password: string) => {
        const res = await fetch(`${IDENTITY}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id, password })
        });
        const data = await res.json();
        if (!res.ok) throw data;
        return data;
    },

    register: async (student_id: string, password: string, full_name: string, department: string, batch: string) => {
        const res = await fetch(`${IDENTITY}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id, password, full_name, department, batch })
        });
        const data = await res.json();
        if (!res.ok) throw data;
        return data;
    },

    getProfile: (token: string) => identityFetch('/auth/me', {}, token),

    changePassword: (token: string, current_password: string, new_password: string) =>
        apiFetch('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ current_password, new_password })
        }, token),

    getMenu: (token: string) => apiFetch('/menu', {}, token),

    placeOrder: (token: string, item_id: number, idempotency_key: string) =>
        apiFetch('/order', { method: 'POST', body: JSON.stringify({ item_id, idempotency_key }) }, token),

    getOrder: (token: string, orderId: string) => apiFetch(`/order/${orderId}`, {}, token),

    getOrderHistory: (token: string) => apiFetch('/orders/history', {}, token),

    getHealth: async () => {
        // /health returns 503 when degraded but still has a valid body — don't treat that as an error
        const res = await fetch(`${GATEWAY}/health`);
        return res.json();
    },

    getMetrics: () => apiFetch('/metrics'),

    seedStock: (token: string) => apiFetch('/stock/seed', { method: 'POST' }, token)
};

// quick wrapper so we can use login() directly without api.login()
export async function login(student_id: string, password: string) {
    return api.login(student_id, password);
}
