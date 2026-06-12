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

// Interceptor para agregar token de autenticación Bearer y headers de contexto
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    try {
      const token = localStorage.getItem('jwt');
      const activeTenantId = localStorage.getItem('activeTenantId');
      const activeCompanyId = localStorage.getItem('activeCompanyId');

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      if (activeTenantId) {
        config.headers['X-Tenant-Id'] = activeTenantId;
      }
      if (activeCompanyId) {
        config.headers['X-Company-Id'] = activeCompanyId;
      }
    } catch (e) {
      console.error('Error setting auth headers in websiteService:', e);
    }
  }
  return config;
});

// Interceptor para manejo de errores de autenticación
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        const isAuthPage = path.includes('/login') || path.includes('/register') || path.includes('/recover-password');
        if (!isAuthPage) {
          localStorage.removeItem('jwt');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export interface WebsiteResponse {
  id: number;
  siteName: string;
  description: string;
  status: string;
  domain: string;
  template: string;
  theme: number;
  domainId: number;
  tenantId: number;
  companyId: number;
}

export default {
  async getStatus(): Promise<WebsiteStatusResponse> {
    const response = await apiClient.get('/status');
    const website = response.data;
    if (!website || !website.id) {
      return {
        success: true,
        data: {
          exists: false,
          status: null,
          subdomain: null,
          siteName: null,
        },
      };
    }
    const subdomain = website.domain ? website.domain.split('.')[0] : null;
    return {
      success: true,
      data: {
        exists: true,
        status: website.status,
        subdomain: subdomain,
        siteName: website.siteName,
        id: website.id,
        description: website.description,
        domain: website.domain,
        template: website.template,
        theme: website.theme,
        domainId: website.domainId,
        tenantId: website.tenantId,
        companyId: website.companyId,
      } as any,
    };
  },

  async getWebsiteStatus(): Promise<any> {
    const response = await apiClient.get('/status');
    return response.data;
  },

  async validateSubdomain(subdomain: string): Promise<SubdomainValidation> {
    const response = await apiClient.get(
      `/domain/validate?subdomain=${encodeURIComponent(subdomain)}`
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
    // Note: The backend expects toggle?websiteId=...&status=...
    // For now, if toggleStatus is called, we can read status and websiteId if we have them.
    // If not, we fall back or construct correctly. Since the component calls toggleStatus(newValue),
    // let's pass status as ENABLED or DISABLED.
    // To get websiteId, we can attempt to fetch it first, or use a context.
    const statusVal = enable ? 'ENABLED' : 'DISABLED';
    const statusData = await this.getStatus();
    const websiteId = (statusData as any)?.id;
    if (websiteId) {
      await apiClient.put(`/toggle?websiteId=${websiteId}&status=${statusVal}`);
    } else {
      console.error('Cannot toggle status: No website ID found');
    }
  },

  async deleteWebsite(): Promise<void> {
    // The backend expects delete?websiteId=...
    const statusData = await this.getStatus();
    const websiteId = (statusData as any)?.id;
    if (websiteId) {
      await apiClient.delete(`/delete?websiteId=${websiteId}`);
    } else {
      console.error('Cannot delete website: No website ID found');
    }
  },

  async getMetrics(): Promise<WebsiteMetrics> {
    const statusData = await this.getStatus();
    const websiteId = (statusData as any)?.id;
    if (websiteId) {
      const response = await apiClient.get(`/metrics?websiteId=${websiteId}`);
      return response.data;
    }
    return { visitsByYear: [], origins: [], topPages: [], bounceRate: 0 };
  },

  async rebuildWebsite(websiteId: number): Promise<void> {
    await apiClient.post(`/rebuild?websiteId=${websiteId}`);
  },
};