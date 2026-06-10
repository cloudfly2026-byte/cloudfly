'use client';

import React, { useState } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, CircularProgress } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import websiteService from '@/services/catalog/websiteService';

export default function DeleteStoreButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await websiteService.deleteWebsite();
      window.location.reload();
    } catch (error) {
      console.error('Error deleting store:', error);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        color="error"
        startIcon={<DeleteIcon />}
        onClick={() => setOpen(true)}
        size="small"
      >
        Eliminar Tienda
      </Button>

      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogTitle>¿Eliminar tienda?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Esta acción no se puede deshacer. Se eliminará tu tienda en línea, el subdominio y todos los datos asociados.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleDelete} color="error" disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : <DeleteIcon />}>
            {loading ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
