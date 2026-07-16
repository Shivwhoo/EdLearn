import axios from 'axios';

// Centralized axios instance with credentials for API calls.
// baseURL left empty to use relative URLs as before.
const api = axios.create({
  baseURL: '',
  withCredentials: true,
});

export default api;
