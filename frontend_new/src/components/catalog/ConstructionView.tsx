'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, LinearProgress, Button, CircularProgress, Alert } from '@mui/material';
import { motion } from 'framer-motion';
import ConstructionIcon from '@mui/icons-material/Construction';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { companyService } from '@/services/companies/companyService';
import { mediaService } from '@/services/mediaService';
import websiteService from '@/services/catalog/websiteService';

import MediaLibraryDialog from '@/components/media/MediaLibraryDialog';

const steps = [
  { label: 'Configurando subdominio', description: 'Preparando tu dominio personalizado...' },
  { label: 'Generando estructura', description: 'Creando las paginas de tu tienda...' },
  { label: 'Optimizando rendimiento', description: 'Ajustando velocidad y SEO...' },
  { label: 'Publicando tienda', description: 'Tu tienda estara lista pronto...' },
];

interface Props {
  status: {
    id: number;
    companyId: number;
    tenantId: number;
    siteName: string;
    status: string;
  };
  onRebuild: () => void;
}

export default function ConstructionView({ status, onRebuild }: Props) {
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [companyData, setCompanyData] = useState<any>(null);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const resolveImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_URL}${url}`;
  };

  useEffect(() => {
    async function loadCompany() {
      try {
        const data = await companyService.getCompanyById(status.companyId);
        setCompanyData(data);
      } catch (err) {
        console.error('Failed to load company details', err);
        setError('No se pudieron cargar los detalles de la empresa.');
      } finally {
        setLoadingCompany(false);
      }
    }
    loadCompany();
  }, [status.companyId]);

  const handleSelectLogo = (media: any) => {
    setSelectedMedia(media);
    setPreviewUrl(resolveImageUrl(media.url));
  };

  const handleContinue = async () => {
    if (!selectedMedia) return;
    setUploading(true);
    setError(null);
    try {
      // 1. Update company logo URL
      await companyService.updateCompany(status.companyId, {
        name: companyData.name,
        nit: companyData.nit,
        address: companyData.address,
        phone: companyData.phone,
        status: companyData.status,
        logoUrl: selectedMedia.url
      });

      // 2. Trigger rebuild in storefront constructor
      await websiteService.rebuildWebsite(status.id);

      // 3. Update local companyData immediately so the building progress screen
      //    shows right away, avoiding the race condition where refetch returns
      //    stale data before the backend update propagates.
      setCompanyData((prev: any) => ({ ...prev, logoUrl: selectedMedia.url }));

      // 4. Refetch status in parent
      onRebuild();
    } catch (err: any) {
      console.error('Failed to save logo and rebuild', err);
      setError(err?.response?.data?.message || 'Ocurrió un error al cargar el logo y reanudar la construcción.');
    } finally {
      setUploading(false);
    }
  };

  if (loadingCompany) {
    return (
      <Paper elevation={0} sx={{ borderRadius: 3, p: 5, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
        <CircularProgress size={50} />
        <Typography variant="body1" sx={{ mt: 2 }} color="text.secondary">
          Cargando configuración de la tienda...
        </Typography>
      </Paper>
    );
  }

  const hasLogo = companyData?.logoUrl && companyData.logoUrl.trim() !== '';

  if (!hasLogo) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper elevation={0} sx={{ borderRadius: 3, p: { xs: 3, sm: 4, md: 5 }, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
          <Box mb={2}>
            <PhotoCamera sx={{ fontSize: 64, color: 'warning.main' }} />
          </Box>

          <Typography variant="h4" fontWeight="bold" mb={2}>
            Se requiere un logotipo para tu tienda
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', mb: 4 }}>
            Tu tienda está en estado de construcción, pero para continuar con el diseño de marca y la selección automática de colores, necesitamos que selecciones o cargues el logotipo oficial de tu empresa.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>{error}</Alert>}

          <Box sx={{ mb: 4 }}>
            <Button
              variant="outlined"
              onClick={() => setMediaDialogOpen(true)}
              startIcon={<PhotoCamera />}
              sx={{ px: 4, py: 1.5, borderRadius: 2 }}
            >
              Seleccionar de la Galería
            </Button>
          </Box>

          {previewUrl && (
            <Box mb={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Typography variant="subtitle2" mb={1} color="text.secondary">Vista previa del logotipo:</Typography>
              <Box
                component="img"
                src={previewUrl}
                alt="Preview Logo"
                sx={{
                  maxHeight: 120,
                  maxWidth: 240,
                  objectFit: 'contain',
                  borderRadius: 2,
                  border: '1px dashed',
                  borderColor: 'divider',
                  p: 1,
                  bgcolor: 'background.default'
                }}
              />
            </Box>
          )}

          <Button
            variant="contained"
            disabled={!selectedMedia || uploading}
            onClick={handleContinue}
            sx={{ px: 6, py: 1.8, borderRadius: 2, minWidth: 200 }}
          >
            {uploading ? <CircularProgress size={24} color="inherit" /> : 'Subir y Continuar'}
          </Button>

          <MediaLibraryDialog
            open={mediaDialogOpen}
            onClose={() => setMediaDialogOpen(false)}
            onSelect={handleSelectLogo}
          />
        </Paper>
      </motion.div>
    );
  }

  // Si ya tiene logo, mostrar el progreso animado normal
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Paper elevation={0} sx={{ borderRadius: 3, p: { xs: 3, sm: 4, md: 5 }, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ConstructionIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        </motion.div>

        <Typography variant="h4" fontWeight="bold" mb={1}>
          ¡Tu tienda está en construcción!
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Nuestro agente constructor de IA está diseñando tu escaparate. Te notificaremos por correo y WhatsApp cuando esté lista.
        </Typography>

        <Box sx={{ maxWidth: 500, mx: 'auto', mb: 4 }}>
          <LinearProgress
            variant="indeterminate"
            sx={{ height: 8, borderRadius: 4, mb: 3 }}
          />
        </Box>

        <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, maxWidth: 500, mx: 'auto', textAlign: 'left' }}>
          {steps.map((step, index) => (
            <Box
              key={index}
              component="li"
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
                mb: 3,
                pl: 1,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: 'primary.light',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  mt: 0.5,
                }}
              >
                <Typography variant="caption" color="primary.contrastText" fontWeight="bold">
                  {index + 1}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight="medium">
                  {step.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {step.description}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>
    </motion.div>
  );
}
