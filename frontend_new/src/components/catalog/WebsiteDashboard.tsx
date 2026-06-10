'use client';

import React from 'react';
import { Box, Grid, Typography, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import StatusToggle from './StatusToggle';
import DeleteStoreButton from './DeleteStoreButton';
import VisitsChart from './metrics/VisitsChart';
import OriginsChart from './metrics/OriginsChart';
import TopPagesTable from './metrics/TopPagesTable';
import BounceRateCard from './metrics/BounceRateCard';
import type { WebsiteStatus } from '@/types/catalog';

interface WebsiteDashboardProps {
  status: WebsiteStatus;
}

export default function WebsiteDashboard({ status }: WebsiteDashboardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Paper elevation={0} sx={{ borderRadius: 3, p: { xs: 2, sm: 3 }, mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2}>
          <Box>
            <Typography variant="h5" fontWeight="bold">
              {status.siteName || 'Mi Tienda'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {status.subdomain}.cloudfly.com.co
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <StatusToggle initialStatus={status.status === 'ENABLED'} />
            <DeleteStoreButton />
          </Box>
        </Box>
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <VisitsChart />
        </Grid>
        <Grid item xs={12} md={4}>
          <BounceRateCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <OriginsChart />
        </Grid>
        <Grid item xs={12} md={6}>
          <TopPagesTable />
        </Grid>
      </Grid>
    </motion.div>
  );
}
