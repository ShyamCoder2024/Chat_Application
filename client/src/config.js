const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
console.log('API URL:', apiUrl);
export const API_URL = apiUrl;
