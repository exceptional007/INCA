import axios from "axios";
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
const authBaseURL = import.meta.env.VITE_AUTH_API_URL || baseURL;
const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});
const transport = axios.create({ baseURL: authBaseURL, withCredentials: true, timeout: 20_000 });
let refreshPending: Promise<string> | null = null;
let generation = 0;
export function clearSession() {
  generation++;
  localStorage.removeItem("inca_token");
  localStorage.removeItem("inca_user");
  delete api.defaults.headers.common.Authorization;
  window.dispatchEvent(new Event("inca-auth-updated"));
}
export function storeSession(token: string, user: unknown) {
  localStorage.setItem("inca_token", token);
  localStorage.setItem("inca_user", JSON.stringify(user));
  window.dispatchEvent(new Event("inca-auth-updated"));
}
export function startSession(token: string, user: unknown) {
  generation++;
  storeSession(token, user);
}
export function refreshSession(failedToken?: string): Promise<string> {
  if (refreshPending) return refreshPending;
  const currentGeneration = generation;
  const run = async () => {
    const latest = localStorage.getItem("inca_token");
    if (failedToken && latest && latest !== failedToken) return latest;
    const response = await transport.post("/auth/refresh");
    if (currentGeneration !== generation) throw new Error("Session ended.");
    const { accessToken, user } = response.data.data;
    storeSession(accessToken, user);
    return accessToken as string;
  };
  refreshPending = (
    navigator.locks ? navigator.locks.request("inca-refresh", run) : run()
  ).finally(() => {
    refreshPending = null;
  });
  return refreshPending;
}
api.interceptors.request.use((config) => {
  if (/^\/auth(?:\/|$)/.test(config.url || "")) config.baseURL = authBaseURL;
  const token = localStorage.getItem("inca_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const publicAuth =
      /\/auth\/(login|refresh|forgot-password|reset-password|logout)$/.test(
        config?.url || "",
      );
    if (
      error.response?.status === 403 &&
      error.response?.data?.message === "PASSWORD_CHANGE_REQUIRED"
    ) {
      if (location.pathname !== "/change-password")
        location.assign("/change-password");
    }
    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      !publicAuth
    ) {
      config._retried = true;
      try {
        const previous = String(config.headers?.Authorization || "").replace(
          /^Bearer /,
          "",
        );
        await refreshSession(previous);
        return api(config);
      } catch (refreshError: any) {
        // A disconnected device must retain its signed-in offline workspace.
        if (!refreshError.response || refreshError.response.status >= 500) return Promise.reject(refreshError);
        clearSession();
        if (
          !["/login", "/forgot-password", "/reset-password"].includes(
            location.pathname,
          )
        )
          location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);
export default api;
