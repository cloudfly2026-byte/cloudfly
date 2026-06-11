'use client';

import React from 'react';
import { Box, Typography, Paper, LinearProgress, Stepper, Step, StepLabel, StepContent } from '@mui/material';
import { motion } from 'framer-motion';
import ConstructionIcon from '@mui/icons-material/Construction';

const steps = [
  { label: 'Configurando subdominio', description: 'Preparando tu dominio personalizado...' },
  { label: 'Generando estructura', description: 'Creando las páginas de tu tienda...' },
  { label: 'Optimizando rendimiento', description: 'Ajustando velocidad y SEO...' },
  { label: 'Publicando tienda', description: 'Tu tienda estará lista pronto...' },
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
          ¡Tu tienda está en construcción!
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Nuestro agente constructor está trabajando en tu tienda. Te notificaremos cuando esté lista.
        </Typography>

        <Box sx={{ maxWidth: 500, mx: 'auto', mb: 4 }}>
          <LinearProgress
            variant="indeterminate"
            sx={{ height: 8, borderRadius: 4, mb: 3 }}
          />
        </Box>

        <Stepper orientation="vertical" activeStep={-1}>
          {steps.map((step, index) => (
            <Step key={index} active={false}>
              <StepLabel
                StepIconProps={{
                  sx: { color: 'primary.light' },
                }}
              >
                <Typography variant="subtitle1" fontWeight="medium">
                  {step.label}
                </Typography>
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary">
                  {step.description}
                </Typography>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Paper>
    </motion.div>
  );
}
