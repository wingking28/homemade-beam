import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: async (user, token) => {
    await AsyncStorage.setItem('auth_token', token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(user));
    set({ user, token });
  },

  updateUser: async (user) => {
    await AsyncStorage.setItem('auth_user', JSON.stringify(user));
    set({ user });
  },

  clearAuth: async () => {
    await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
    set({ user: null, token: null });
  },

  loadFromStorage: async () => {
    const token = await AsyncStorage.getItem('auth_token');
    const userJson = await AsyncStorage.getItem('auth_user');
    const user = userJson ? (JSON.parse(userJson) as User) : null;
    set({ user, token, isLoading: false });
  },
}));
