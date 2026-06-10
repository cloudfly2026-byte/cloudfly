/**
 * Website Service - API client for the Online Catalog Module
 * Base URL: /api/v1/website
 */

import axiosInstance from '@/utils/axiosInstance';

export interface WebsiteResponse {
  id: number | null;
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

export interface WebsiteCreateRequest {
  subdomain: string;
  siteName: string;
  description?: string;
  tenantId?: number;
  companyId?: number;
}

export interface WebsiteMetricsDTO {
  yearlyVisits: { month: string; visits: number }[];
  origins: { source: string; percentage: number }[];
  topPages: { path: string; views: number }[];
  bounceRate: number;
}

const API_BASE = '/api/v1/website';

export const websiteService = {
  /**
   * Check if a website exists for the current user's company.
   */
  getWebsiteStatus: async (): Promise<WebsiteResponse | null> => {
    try {
      const response = await axiosInstance.get<WebsiteResponse>(`${API_BASE}/status`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Create a new website catalog.
   */
  createWebsite: async (data: WebsiteCreateRequest): Promise<WebsiteResponse> => {
    const response = await axiosInstance.post<WebsiteResponse>(`${API_BASE}/create`, data);
    return response.data;
  },

  /**
   * Toggle website status (ENABLED / DISABLED).
   */
  toggleStatus: async (websiteId: number, status: string): Promise<WebsiteResponse> => {
    const response = await axiosInstance.put<WebsiteResponse>(
      `${API_BASE}/toggle?websiteId=${websiteId}&status=${status}`
    );
    return response.data;
  },

  /**
   * Delete a website.
   */
  deleteWebsite: async (websiteId: number): Promise<void> => {
    await axiosInstance.delete(`${API_BASE}/delete?websiteId=${websiteId}`);
  },

  /**
   * Get demo metrics for the website dashboard.
   */
  getMetrics: async (websiteId: number): Promise<WebsiteMetricsDTO> => {
    const response = await axiosInstance.get<WebsiteMetricsDTO>(
      `${API_BASE}/metrics?websiteId=${websiteId}`
    );
    return response.data;
  },

  /**
   * Validate subdomain availability.
   */
  validateSubdomain: async (subdomain: string): Promise<boolean> => {
    const response = await axiosInstance.get<{ available: boolean }>(
      `${API_BASE}/domain/validate?subdomain=${encodeURIComponent(subdomain)}`
    );
    return response.data.available;
  },
};

export default websiteService;