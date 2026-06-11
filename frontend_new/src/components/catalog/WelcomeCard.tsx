'use client';

import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import StorefrontIcon from '@mui/icons-material/Storefront';

interface WelcomeCardProps {
  onActivate: () => void;
}

export default function WelcomeCard({ onActivate }: WelcomeCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Paper
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 3,
          p: { xs: 3, sm: 4, md: 5 },
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -30,
            left: -30,
            width: 150,
            height: 150,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          }}
        />

        <Box position="relative" zIndex={1}>
          <StorefrontIcon sx={{ fontSize: { xs: 48, sm: 56 }, mb: 2, opacity: 0.9 }} />
          
          <Typography variant="h4" fontWeight="bold" mb={1}>
            ¡Bienvenido a tu Tienda en Línea!
          </Typography>
          
          <Typography variant="body1" mb={3} sx={{ opacity: 0.9, maxWidth: 500 }}>
            Tu catálogo en línea no está activado aún. Crea tu tienda virtual y empieza a vender en internet con tu propio subdominio.
          </Typography>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={onActivate}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.9)',
                },
              }}
            >
              Crear Catálogo en Línea
            </Button>
          </motion.div>
        </Box>
      </Paper>
    </motion.div>
  );
}
