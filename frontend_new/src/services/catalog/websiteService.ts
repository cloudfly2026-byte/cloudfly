// CLOUD-340 - Servicio HTTP para el módulo de Catálogo en Línea
// Consume los endpoints del WebsiteController (Backend API, puerto 8080)

import axios from 'axios';
import type {
  WebsiteStatusResponse,
  WebsiteMetrics,
  SubdomainValidation,
  WebsiteCreateRequest,
  WebsiteCreateResponse,
} from '@/types/catalog';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: `${API_BASE}/api/v1/website`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación Bearer
apiClient.interceptors.request.use((config) => {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejo de errores de autenticación
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default {
  async getStatus(): Promise<WebsiteStatusResponse> {
    const response = await apiClient.get('/status');
    return response.data;
  },

  async validateSubdomain(subdomain: string): Promise<SubdomainValidation> {
    const response = await apiClient.get(
      `/validate-subdomain?subdomain=${encodeURIComponent(subdomain)}`
    );
    return response.data;
  },

  async createWebsite(
    data: WebsiteCreateRequest
  ): Promise<WebsiteCreateResponse> {
    const response = await apiClient.post('/create', data);
    return response.data;
  },

  async toggleStatus(enable: boolean): Promise<void> {
    await apiClient.put('/toggle-status', { enable });
  },

  async deleteWebsite(): Promise<void> {
    await apiClient.delete('/delete');
  },

  async getMetrics(): Promise<WebsiteMetrics> {
    const response = await apiClient.get('/metrics');
    return response.data;
  },
};