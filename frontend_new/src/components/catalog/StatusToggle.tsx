'use client';

import React, { useState } from 'react';
import { Switch, FormControlLabel, CircularProgress, Box, Typography } from '@mui/material';
import websiteService from '@/services/catalog/websiteService';

interface StatusToggleProps {
  initialStatus: boolean;
}

export default function StatusToggle({ initialStatus }: StatusToggleProps) {
  const [enabled, setEnabled] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setLoading(true);
    try {
      await websiteService.toggleStatus(newValue);
      setEnabled(newValue);
    } catch (error) {
      console.error('Error toggling status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" alignItems="center" gap={1}>
      {loading && <CircularProgress size={16} />}
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={handleToggle}
            disabled={loading}
            color="success"
          />
        }
        label={
          <Typography variant="body2" fontWeight="medium">
            {enabled ? 'Activada' : 'Desactivada'}
          </Typography>
        }
      />
    </Box>
  );
}
