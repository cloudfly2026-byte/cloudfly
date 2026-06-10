'use client';

import React from 'react';
import { Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { demoTopPages } from '@/data/demoMetrics';

export default function TopPagesTable() {
  return (
    <Card sx={{ height: '100%', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Páginas Más Vistas
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Página</TableCell>
                <TableCell align="right">Vistas</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {demoTopPages.map((page, index) => (
                <TableRow key={index}>
                  <TableCell>{page.page}</TableCell>
                  <TableCell align="right">{page.views.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
