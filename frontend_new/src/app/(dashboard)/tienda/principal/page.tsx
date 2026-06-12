'use client';

import React, { useState, useCallback } from 'react';
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
 * Pagina principal del modulo de Tienda en Linea.
 * Implementa una maquina de estados finitos (FSM) con 4 estados:
 *
 * NO_WEBSITE -> SUBDOMAIN_FORM -> CONSTRUCTION -> DASHBOARD (ENABLED/DISABLED)
 *
 * Las transiciones entre estados se animan con Framer Motion (AnimatePresence).
 * El estado inicial se determina consultando useWebsiteStatus().
 *
 * Transiciones:
 * - NO_WEBSITE -> SUBDOMAIN_FORM: Usuario hace click en "Crear Catalogo"
 * - SUBDOMAIN_FORM -> CONSTRUCTION: Usuario crea el website exitosamente
 * - CONSTRUCTION -> DASHBOARD: Polling detecta status ENABLED/DISABLED
 * - DASHBOARD -> NO_WEBSITE: Usuario elimina la tienda
 */
export default function TiendaPrincipalPage() {
  const {
    data: websiteStatus,
    isLoading,
    error,
    refetch,
  } = useWebsiteStatus();

  //
  // Estado local para manejar la vista SUBDOMAIN_FORM.
  // Este estado es 100% del lado del cliente: el usuario hace click
  // en "Crear Catalogo" y se muestra el formulario.
  // Cuando el website se crea exitosamente, onCreated() hace refetch()
  // y el status del backend pasa a CONSTRUCTION.
  //
  const [showSubdomainForm, setShowSubdomainForm] = useState(false);

  const handleCrearCatalogo = useCallback(() => {
    setShowSubdomainForm(true);
  }, []);

  const handleWebsiteCreated = useCallback(() => {
    // El website se creo exitosamente en el backend.
    // Refetch para obtener el nuevo status (CONSTRUCTION).
    setShowSubdomainForm(false);
    refetch();
  }, [refetch]);

  const handleBackToWelcome = useCallback(() => {
    setShowSubdomainForm(false);
  }, []);

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
    // ESTADO: SUBDOMAIN_FORM
    // El usuario hizo click en "Crear Catalogo" pero aun no
    // existe website en el backend. Se muestra el formulario.
    // ─────────────────────────────────────────────────────────
    if (showSubdomainForm && (!status?.exists || !status?.status)) {
      return (
        <motion.div
          key="subdomain-form"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <SubdomainForm onCreated={handleWebsiteCreated} />
        </motion.div>
      );
    }

    // ─────────────────────────────────────────────────────────
    // ESTADO: NO_WEBSITE
    // No existe website -> mostrar WelcomeCard con boton CTA
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
          <WelcomeCard onActivate={handleCrearCatalogo} />
        </motion.div>
      );
    }

    // ─────────────────────────────────────────────────────────
    // ESTADO: CONSTRUCTION
    // Website en construccion -> mostrar animacion de progreso
    // El polling automatico (30s) detectara el cambio a ENABLED
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
          <ConstructionView status={status} onRebuild={refetch} />
        </motion.div>
      );
    }

    // ─────────────────────────────────────────────────────────
    // ESTADO: ENABLED / DISABLED
    // Website activo -> mostrar Dashboard con metricas
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
    // FALLBACK: Estado desconocido -> mostrar WelcomeCard
    // ─────────────────────────────────────────────────────────
    return (
      <motion.div
        key="welcome-fallback"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
      >
        <WelcomeCard onActivate={handleCrearCatalogo} />
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

      {/* Titulo de pagina */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}
      >
        <StorefrontIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="bold">
          Mi Tienda en Linea
        </Typography>
      </Box>

      {/* Contenido con AnimatePresence para transiciones animadas */}
      <AnimatePresence mode="wait">
        {renderContent()}
      </AnimatePresence>
    </Container>
  );
}
