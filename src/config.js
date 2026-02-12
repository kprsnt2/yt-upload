// API base URL - Vercel API routes are relative (/api/...)
// In development with separate backend, use VITE_API_URL env var
const API_BASE = import.meta.env.VITE_API_URL || '';

export const API = `${API_BASE}/api`;
export const getMediaUrl = (path) => path; // Images are now base64 data URLs
