'use client';

import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { demoVisitsByYear } from '@/data/demoMetrics';

export default function VisitsChart() {
  return (
    <Card sx={{ height: '100%', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Visitas por Año
        </Typography>
        <Box height={250}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={demoVisitsByYear}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="visits" fill="#667eea" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
