'use client';

import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { demoOrigins } from '@/data/demoMetrics';

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'];

export default function OriginsChart() {
  return (
    <Card sx={{ height: '100%', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Orígenes de Tráfico
        </Typography>
        <Box height={250}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={demoOrigins}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {demoOrigins.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
