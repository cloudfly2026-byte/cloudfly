'use client';

import React from 'react';
import { Box, Typography, Paper, LinearProgress } from '@mui/material';
import { motion } from 'framer-motion';
import ConstructionIcon from '@mui/icons-material/Construction';

const steps = [
  { label: 'Configurando subdominio', description: 'Preparando tu dominio personalizado...' },
  { label: 'Generando estructura', description: 'Creando las paginas de tu tienda...' },
  { label: 'Optimizando rendimiento', description: 'Ajustando velocidad y SEO...' },
  { label: 'Publicando tienda', description: 'Tu tienda estara lista pronto...' },
];

export default function ConstructionView() {
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
          Tu tienda esta en construccion!
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Nuestro agente constructor esta trabajando en tu tienda. Te notificaremos cuando este lista.
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
