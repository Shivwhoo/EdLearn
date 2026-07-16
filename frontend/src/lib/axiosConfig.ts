import axios from 'axios';

const BACKEND_HINT_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const errorHandler = (error: any) => {
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

