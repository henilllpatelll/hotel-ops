import axios from 'axios';

const api = axios.create({
  baseURL: 'http://172.20.0.211:4000/api'
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export default api;
