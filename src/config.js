// API base URL - uses environment variable in production, localhost in development
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const API = `${API_BASE}/api`;
export const getMediaUrl = (path) => `${API_BASE}${path}`;
