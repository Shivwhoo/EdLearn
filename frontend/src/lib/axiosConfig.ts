import axios from 'axios';

const BACKEND_HINT_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const errorHandler = async (error: any) => {
  if (axios.isAxiosError(error) && !error.response) {
    const reason = error.request
      ? `Could not reach the backend server (is it running on ${BACKEND_HINT_URL}? underlying error: ${error.message})`
      : `Request could not be sent: ${error.message}`;

    // Synthesize a response body so existing `err.response?.data?.error`
    // call sites throughout the app pick this message up automatically.
    error.response = {
      data: { error: reason },
      status: 0,
      statusText: 'Network Error',
      headers: {},
      config: error.config ?? ({ headers: {} } as any),
    };
    return Promise.reject(error);
  }

  if (axios.isAxiosError(error) && error.response?.status === 401) {
    const originalRequest = error.config as any;

    if (!originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes('/api/auth/refresh')) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          originalRequest._retry = true;
          return axios(originalRequest);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('edlearn_refresh_token') : null;

      if (!refreshToken) {
        processQueue(error, null);
        isRefreshing = false;
        return Promise.reject(error);
      }

      const refreshResponse = await axios.post('/api/auth/refresh', {
        refreshToken
      });

      if (refreshResponse.data?.success) {
        const newToken = refreshResponse.data.token;
        const newRefreshToken = refreshResponse.data.refreshToken;

        if (typeof window !== 'undefined') {
          localStorage.setItem('edlearn_token', newToken);
          localStorage.setItem('edlearn_refresh_token', newRefreshToken);
        }

        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;

        processQueue(null, newToken);
        isRefreshing = false;
        return axios(originalRequest);
      }
    } catch (refreshError) {
      processQueue(refreshError, null);
      isRefreshing = false;
      return Promise.reject(error);
    }
  }

  return Promise.reject(error);
};

// Apply interceptor to the global axios instance
axios.interceptors.response.use(
  (response) => response,
  errorHandler
);

// Create the custom instance for InteractiveAssistant
const api = axios.create({
  baseURL: '',
  withCredentials: true,
});

// Also apply the same interceptor to the custom instance
api.interceptors.response.use(
  (response) => response,
  errorHandler
);

export default api;

