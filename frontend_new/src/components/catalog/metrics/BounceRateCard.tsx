'use client';

import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { demoBounceRate } from '@/data/demoMetrics';

export default function BounceRateCard() {
  return (
    <Card sx={{ height: '100%', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Tasa de Rebote
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <TrendingDownIcon color="success" />
          <Typography variant="h3" fontWeight="bold" color="success.main">
            {demoBounceRate}%
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mt={1}>
          Promedio mensual
        </Typography>
      </CardContent>
    </Card>
  );
}
