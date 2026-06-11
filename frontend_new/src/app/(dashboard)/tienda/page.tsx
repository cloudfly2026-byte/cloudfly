'use client';

import React from 'react';
import { Box, Container, Typography, useMediaQuery, useTheme } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import WelcomeCard from '@/components/catalog/WelcomeCard';
import SubdomainForm from '@/components/catalog/SubdomainForm';
import ConstructionView from '@/components/catalog/ConstructionView';
import WebsiteDashboard from '@/components/catalog/WebsiteDashboard';
import { useWebsiteStatus } from '@/hooks/catalog/useWebsiteStatus';
import type { WebsiteStatus } from '@/types/catalog';

export default function TiendaPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: websiteStatus, isLoading, error, refetch } = useWebsiteStatus();

  const renderContent = () => {
    if (isLoading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Typography variant="h6" color="text.secondary">
              Cargando...
            </Typography>
          </motion.div>
        </Box>
      );
    }

    if (error) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <Typography variant="h6" color="error">
            Error al cargar el estado de la tienda
          </Typography>
        </Box>
      );
    }

    const status: WebsiteStatus | undefined = websiteStatus?.data;

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

    switch (status.status) {
      case 'CONSTRUCTION':
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

      case 'ENABLED':
      case 'DISABLED':
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

      default:
        return (
          <motion.div
            key="welcome-default"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <WelcomeCard onActivate={() => refetch()} />
          </motion.div>
        );
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
      <Box
        component={motion.div}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <Box mb={{ xs: 2, sm: 3 }}>
          <Typography
            variant={isMobile ? 'h5' : 'h4'}
            component="h1"
            fontWeight="bold"
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Tienda en Línea
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Gestiona tu catálogo en línea y vende en internet
          </Typography>
        </Box>

        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </Box>
    </Container>
  );
}
