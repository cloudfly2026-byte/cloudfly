// CLOUD-339 - Tipos TypeScript para el módulo de Catálogo en Línea
// Este archivo define las interfaces que tipan las respuestas del Backend API (WebsiteController)
// Relacionado: CLOUD-334 (ticket padre)

export type WebsiteStatusEnum = 'ENABLED' | 'DISABLED' | 'CONSTRUCTION';

export interface WebsiteStatus {
  exists: boolean;
  status: WebsiteStatusEnum | null;
  subdomain: string | null;
  siteName: string | null;
}

export interface WebsiteStatusResponse {
  success: boolean;
  data: WebsiteStatus;
  message?: string;
}

export interface WebsiteMetrics {
  visitsByYear: { year: string; visits: number }[];
  origins: { name: string; value: number }[];
  topPages: { page: string; views: number }[];
  bounceRate: number;
}

export interface SubdomainValidation {
  available: boolean;
  message: string;
}

export interface WebsiteCreateRequest {
  siteName: string;
  description: string;
  subdomain: string;
}

export interface WebsiteCreateResponse {
  id: number;
  siteName: string;
  status: WebsiteStatusEnum;
  subdomain: string;
}
