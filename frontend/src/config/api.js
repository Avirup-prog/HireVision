// Centralized API configuration for HireVision
// In development, defaults to local FastAPI server: http://localhost:8000
// In production (Vercel/Render), configured via VITE_API_BASE_URL environment variable

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
