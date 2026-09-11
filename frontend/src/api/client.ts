import axios from "axios";
import { useAuthStore } from "@/stores/authStore";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, try to refresh once
let refreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken) {
      logout();
      return Promise.reject(error);
    }

    if (refreshing) {
      // Queue request until refresh completes
      return new Promise((resolve, reject) => {
        refreshQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }

    refreshing = true;
    try {
      const res = await axios.post("/api/v1/auth/refresh", { refresh_token: refreshToken });
      const { access_token, refresh_token } = res.data;
      setTokens(access_token, refresh_token);
      refreshQueue.forEach((cb) => cb(access_token));
      refreshQueue = [];
      original.headers.Authorization = `Bearer ${access_token}`;
      return api(original);
    } catch {
      logout();
      return Promise.reject(error);
    } finally {
      refreshing = false;
    }
  }
);

export default api;
