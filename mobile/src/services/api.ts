import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('auth_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Auth
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/login', data),
  getMe: () => api.get<{ user: User }>('/auth/me'),
  updateProfile: (data: { name?: string; avatarUrl?: string }) =>
    api.put<{ user: User }>('/auth/profile', data),
};

// Users
export const usersApi = {
  search: (q: string) => api.get<{ users: User[] }>(`/users/search?q=${encodeURIComponent(q)}`),
};

// Friends
export const friendsApi = {
  getAll: () => api.get<{ friends: User[] }>('/friends'),
  getRequests: () => api.get<{ requests: FriendRequest[] }>('/friends/requests'),
  sendRequest: (receiverId: string) =>
    api.post<{ request: FriendRequest }>('/friends/request', { receiverId }),
  respond: (id: string, action: 'accept' | 'decline') =>
    api.put<{ request: FriendRequest }>(`/friends/requests/${id}`, { action }),
  remove: (friendId: string) => api.delete<{ success: boolean }>(`/friends/${friendId}`),
};

// Groups
export const groupsApi = {
  getAll: () => api.get<{ groups: Group[] }>('/groups'),
  get: (id: string) => api.get<{ group: Group }>(`/groups/${id}`),
  create: (data: { name: string; description?: string; memberIds?: string[] }) =>
    api.post<{ group: Group }>('/groups', data),
  addMember: (groupId: string, userId: string) =>
    api.post<{ member: GroupMember }>(`/groups/${groupId}/members`, { userId }),
  removeMember: (groupId: string, userId: string) =>
    api.delete<{ success: boolean }>(`/groups/${groupId}/members/${userId}`),
  getBalances: (groupId: string) =>
    api.get<{ balances: Balance[] }>(`/groups/${groupId}/balances`),
  delete: (groupId: string) =>
    api.delete<{ success: boolean }>(`/groups/${groupId}`),
};

// Expenses
export const expensesApi = {
  getForGroup: (groupId: string) =>
    api.get<{ expenses: Expense[] }>(`/expenses/groups/${groupId}`),
  getHistory: (
    groupId: string,
    params?: { page?: number; limit?: number; order?: 'desc' | 'asc' }
  ) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.order) qs.set('order', params.order);
    const query = qs.toString();
    return api.get<{ expenses: Expense[]; total: number; page: number; limit: number; hasMore: boolean }>(
      `/expenses/groups/${groupId}/history${query ? `?${query}` : ''}`
    );
  },
  create: (
    groupId: string,
    data: { description: string; amount: number; splits?: { userId: string; amount: number }[] }
  ) => api.post<{ expense: Expense }>(`/expenses/groups/${groupId}`, data),
  delete: (id: string) => api.delete<{ success: boolean }>(`/expenses/${id}`),
  settleShare: (shareId: string) =>
    api.put<{ share: ExpenseShare }>(`/expenses/shares/${shareId}/settle`, {}),
};

// Payment requests
export const paymentRequestsApi = {
  getAll: (
    params?:
      | 'sent'
      | 'received'
      | 'all'
      | {
          type?: 'sent' | 'received' | 'all';
          page?: number;
          limit?: number;
          order?: 'desc' | 'asc';
          search?: string;
          status?: 'active' | 'inactive';
        }
  ) => {
    const opts = typeof params === 'string' ? { type: params } : params;
    const qs = new URLSearchParams();
    if (opts?.type) qs.set('type', opts.type);
    if (opts?.page) qs.set('page', String(opts.page));
    if (opts?.limit) qs.set('limit', String(opts.limit));
    if (opts?.order) qs.set('order', opts.order);
    if (opts?.search) qs.set('search', opts.search);
    if (opts?.status) qs.set('status', opts.status);
    const query = qs.toString();
    return api.get<{ requests: PaymentRequest[]; total: number; page: number; limit: number; hasMore: boolean }>(
      `/payment-requests${query ? `?${query}` : ''}`
    );
  },
  create: (data: { receiverId: string; amount: number; description: string }) =>
    api.post<{ request: PaymentRequest }>('/payment-requests', data),
  updateStatus: (id: string, status: 'PAID' | 'CANCELLED') =>
    api.put<{ request: PaymentRequest }>(`/payment-requests/${id}`, { status }),
};

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  sender?: User;
  receiver?: User;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdById: string;
  members: GroupMember[];
  expenses?: Expense[];
  _count?: { expenses: number };
  createdAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  user: User;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: User;
  shares: ExpenseShare[];
  isSettled?: boolean;
  createdAt: string;
}

export interface ExpenseShare {
  id: string;
  userId: string;
  amount: number;
  isPaid: boolean;
  user: User;
}

export interface PaymentRequest {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  description: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  sender: User;
  receiver: User;
  createdAt: string;
}

export interface Balance {
  user: User;
  net: number;
}
