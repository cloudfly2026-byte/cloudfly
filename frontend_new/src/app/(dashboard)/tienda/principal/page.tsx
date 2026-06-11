'use client';

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Breadcrumbs,
  Link,
  CircularProgress,
  Alert,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebsiteStatus } from '@/hooks/catalog/useWebsiteStatus';
import type { WebsiteStatus } from '@/types/catalog';
import WelcomeCard from '@/components/catalog/WelcomeCard';
import SubdomainForm from '@/components/catalog/SubdomainForm';
import ConstructionView from '@/components/catalog/ConstructionView';
import WebsiteDashboard from '@/components/catalog/WebsiteDashboard';

/**
 * Página principal del módulo de Tienda en Línea.
 * Implementa una máquina de estados finitos (FSM) con 4 estados:
 *
 * NO_WEBSITE → SUBDOMAIN_FORM → CONSTRUCTION → DASHBOARD (ENABLED/DISABLED)
 *
 * Las transiciones entre estados se animan con Framer Motion (AnimatePresence).
 * El estado inicial se determina consultando useWebsiteStatus().
 */
export default function TiendaPrincipalPage() {
  const {
    data: websiteStatus,
    isLoading,
    error,
    refetch,
  } = useWebsiteStatus();

  const renderContent = () => {
    // Estado de carga
    if (isLoading) {
      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="60vh"
        >
          <CircularProgress size={60} />
        </Box>
      );
    }

    // Error global
    if (error) {
      return (
        <Alert severity="error" sx={{ mb: 3 }}>
          Error al cargar el estado de la tienda. Por favor, intenta
          nuevamente.
        </Alert>
      );
    }

    const status: WebsiteStatus | undefined = websiteStatus?.data;

    // ─────────────────────────────────────────────────────────
    // ESTADO: NO_WEBSITE
    // No existe website → mostrar WelcomeCard con botón CTA
    // ─────────────────────────────────────────────────────────
    if (!status?.exists || !status?.status) {
      return (
        <motion.div
          key="welcome"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
        >
          <WelcomeCard onActivate={() => refetch()} />
        </motion.div>
      );
    }

    // ─────────────────────────────────────────────────────────
    // ESTADO: CONSTRUCTION
    // Website en construcción → mostrar animación de progreso
    // El polling automático (30s) detectará el cambio a ENABLED
    // ─────────────────────────────────────────────────────────
    if (status.status === 'CONSTRUCTION') {
      return (
        <motion.div
          key="construction"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
        >
          <ConstructionView />
        </motion.div>
      );
    }

    // ─────────────────────────────────────────────────────────
    // ESTADO: ENABLED / DISABLED
    // Website activo → mostrar Dashboard con métricas
    // ─────────────────────────────────────────────────────────
    if (status.status === 'ENABLED' || status.status === 'DISABLED') {
      return (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
        >
          <WebsiteDashboard status={status} />
        </motion.div>
      );
    }

    // ─────────────────────────────────────────────────────────
    // FALLBACK: Estado desconocido → mostrar WelcomeCard
    // ─────────────────────────────────────────────────────────
    return (
      <motion.div
        key="welcome-fallback"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
      >
        <WelcomeCard onActivate={() => refetch()} />
      </motion.div>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
      {/* Breadcrumb: Dashboard > Tienda > Principal */}
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="breadcrumb"
        sx={{ mb: 2 }}
      >
        <Link underline="hover" color="inherit" href="/dashboard">
          Dashboard
        </Link>
        <Link underline="hover" color="inherit" href="/tienda">
          Tienda
        </Link>
        <Typography color="text.primary">Principal</Typography>
      </Breadcrumbs>

      {/* Título de página */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}
      >
        <StorefrontIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="bold">
          Mi Tienda en Línea
        </Typography>
      </Box>

      {/* Contenido con AnimatePresence para transiciones animadas */}
      <AnimatePresence mode="wait">
        {renderContent()}
      </AnimatePresence>
    </Container>
  );
}
