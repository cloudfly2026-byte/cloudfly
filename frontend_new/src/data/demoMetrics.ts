// CLOUD-341 - Datos demo para el dashboard de métricas del Catálogo en Línea
// Estos datos se usan hasta que el backend de métricas esté disponible
// La estructura coincide con la interfaz WebsiteMetrics de types/catalog.ts

export const demoVisitsByYear = [
  { year: '2022', visits: 1200 },
  { year: '2023', visits: 3400 },
  { year: '2024', visits: 5600 },
  { year: '2025', visits: 8200 },
  { year: '2026', visits: 11500 },
];

export const demoOrigins = [
  { name: 'Google', value: 45 },
  { name: 'Directo', value: 25 },
  { name: 'Redes Sociales', value: 15 },
  { name: 'Email', value: 10 },
  { name: 'Otros', value: 5 },
];

export const demoTopPages = [
  { page: '/inicio', views: 4500 },
  { page: '/productos', views: 3200 },
  { page: '/contacto', views: 1800 },
  { page: '/carrito', views: 1200 },
  { page: '/checkout', views: 800 },
];

export const demoBounceRate = 32.5;
