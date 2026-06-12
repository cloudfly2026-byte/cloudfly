'use client';

// CLOUD-328 - Página del Dashboard de Métricas del Sitio Web
// Integra los 4 componentes de métricas con datos demo

import React from 'react';
import { Grid, Typography, Box } from '@mui/material';
import VisitsChart from '@/components/catalog/metrics/VisitsChart';
import OriginsChart from '@/components/catalog/metrics/OriginsChart';
import TopPagesTable from '@/components/catalog/metrics/TopPagesTable';
import BounceRateCard from '@/components/catalog/metrics/BounceRateCard';

export default function MetricsPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        Métricas del Sitio Web
      </Typography>
      <Grid container spacing={3}>
        {/* Visitas por Año - BarChart (8 columnas en desktop, 12 en móvil) */}
        <Grid item xs={12} md={8}>
          <VisitsChart />
        </Grid>

        {/* Orígenes de Tráfico - PieChart (4 columnas en desktop, 12 en móvil) */}
        <Grid item xs={12} md={4}>
          <OriginsChart />
        </Grid>

        {/* Páginas Más Vistas - Tabla (8 columnas en desktop, 12 en móvil) */}
        <Grid item xs={12} md={8}>
          <TopPagesTable />
        </Grid>

        {/* Tasa de Rebote - Card (4 columnas en desktop, 12 en móvil) */}
        <Grid item xs={12} md={4}>
          <BounceRateCard />
        </Grid>
      </Grid>
    </Box>
  );
}