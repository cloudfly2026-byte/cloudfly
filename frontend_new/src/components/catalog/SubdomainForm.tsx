'use client';

import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Alert,
  InputAdornment, CircularProgress, Paper, Chip
} from '@mui/material';
import { motion } from 'framer-motion';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import websiteService from '@/services/catalog/websiteService';
import { useSubdomainValidation } from '@/hooks/catalog/useSubdomainValidation';
import type { WebsiteCreateRequest } from '@/types/catalog';

interface SubdomainFormProps {
  onCreated: () => void;
}

export default function SubdomainForm({ onCreated }: SubdomainFormProps) {
  const [subdomain, setSubdomain] = useState('');
  const [siteName, setSiteName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: validation, isValidating } = useSubdomainValidation(subdomain);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation?.available || !siteName.trim() || !subdomain.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const data: WebsiteCreateRequest = {
        siteName: siteName.trim(),
        description: description.trim(),
        subdomain: subdomain.trim(),
      };
      await websiteService.createWebsite(data);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear la tienda');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = siteName.trim() && subdomain.trim() && validation?.available && !isSubmitting;

  if (!showForm) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper elevation={0} sx={{ borderRadius: 3, p: { xs: 3, sm: 4 }, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
          <Typography variant="h5" fontWeight="bold" mb={2}>
            Configura tu Tienda
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Ingresa el nombre de tu tienda y el subdominio deseado
          </Typography>
          <Button variant="contained" size="large" onClick={() => setShowForm(true)}>
            Comenzar
          </Button>
        </Paper>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Paper elevation={0} sx={{ borderRadius: 3, p: { xs: 3, sm: 4 }, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" fontWeight="bold" mb={1}>
          Configura tu Tienda
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Ingresa el nombre de tu tienda y el subdominio deseado
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Nombre de la Tienda"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="Ej: Mi Tienda Online"
            required
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Subdominio"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="mi-tienda"
            required
            sx={{ mb: 1 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Typography variant="body2" color="text.secondary">
                    .cloudfly.com.co
                  </Typography>
                </InputAdornment>
              ),
            }}
            helperText="Solo letras minúsculas y guiones. Entre 3 y 63 caracteres."
          />

          {subdomain.length >= 3 && (
            <Box mb={2}>
              {isValidating ? (
                <Chip icon={<CircularProgress size={16} />} label="Validando..." size="small" />
              ) : validation?.available ? (
                <Chip icon={<CheckCircleIcon />} label="Subdominio disponible" color="success" size="small" />
              ) : (
                <Chip icon={<ErrorIcon />} label={validation?.message || 'No disponible'} color="error" size="small" />
              )}
            </Box>
          )}

          <TextField
            fullWidth
            label="Descripción (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe tu tienda..."
            multiline
            rows={2}
            sx={{ mb: 3 }}
          />

          <Alert severity="info" sx={{ mb: 2 }}>
            La construcción del sitio se realiza con el subdominio. Posteriormente podrás asignar tu propio dominio personalizado.
          </Alert>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <motion.div whileHover={{ scale: isFormValid ? 1.02 : 1 }} whileTap={{ scale: isFormValid ? 0.98 : 1 }}>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={!isFormValid}
              sx={{ py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}
            >
              {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Crear Tienda'}
            </Button>
          </motion.div>
        </Box>
      </Paper>
    </motion.div>
  );
}
