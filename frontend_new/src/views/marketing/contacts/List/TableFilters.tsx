'use client';

import { useState, useEffect, useCallback } from 'react';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import { Icon } from '@iconify/react';

import CustomTextField from '@core/components/mui/TextField';
import type { Contact, ContactFilters } from '@/types/marketing/contactTypes';
import type { Pipeline, Stage } from '@/types/marketing/pipelineTypes';

interface TableFiltersProps {
  onFiltersChange: (filters: ContactFilters) => void;
  pipelines: Pipeline[];
}

const TableFilters = ({ onFiltersChange, pipelines = [] }: TableFiltersProps) => {
  const [nameSearch, setNameSearch] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [identificationSearch, setIdentificationSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [pipelineId, setPipelineId] = useState<string>('');
  const [stageId, setStageId] = useState<string>('');
  const [stages, setStages] = useState<Stage[]>([]);

  // Debounced filter emission
  useEffect(() => {
    const timer = setTimeout(() => {
      const filters: ContactFilters = {};
      if (nameSearch.trim()) filters.name = nameSearch.trim();
      if (emailSearch.trim()) filters.email = emailSearch.trim();
      if (phoneSearch.trim()) filters.phone = phoneSearch.trim();
      if (identificationSearch.trim()) filters.identification = identificationSearch.trim();
      onFiltersChange(filters);
    }, 300);

    return () => clearTimeout(timer);
  }, [nameSearch, emailSearch, phoneSearch, identificationSearch, onFiltersChange]);

  // Load stages when selected pipeline changes
  useEffect(() => {
    if (pipelineId) {
      const selected = pipelines.find((p) => String(p.id) === pipelineId);
      setStages(selected?.stages || []);
    } else {
      setStages([]);
    }
    setStageId('');
  }, [pipelineId, pipelines]);

  const handleClearFilters = useCallback(() => {
    setNameSearch('');
    setEmailSearch('');
    setPhoneSearch('');
    setIdentificationSearch('');
    setStatus('');
    setPipelineId('');
    setStageId('');
    onFiltersChange({});
  }, [onFiltersChange]);

  return (
    <CardContent>
      <Grid container spacing={4}>
        {/* Primary search: Name */}
        <Grid item xs={12} sm={6} md={3}>
          <CustomTextField
            fullWidth
            label='Buscar por Nombre'
            placeholder='Nombre del contacto...'
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <Icon icon='tabler:search' className='text-xl' />
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        {/* Email filter */}
        <Grid item xs={12} sm={6} md={3}>
          <CustomTextField
            fullWidth
            label='Buscar por Email'
            placeholder='email@ejemplo.com'
            value={emailSearch}
            onChange={(e) => setEmailSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <Icon icon='tabler:mail' className='text-xl' />
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        {/* Phone filter */}
        <Grid item xs={12} sm={6} md={3}>
          <CustomTextField
            fullWidth
            label='Buscar por Teléfono'
            placeholder='Número de teléfono...'
            value={phoneSearch}
            onChange={(e) => setPhoneSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <Icon icon='tabler:phone' className='text-xl' />
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        {/* Identification filter */}
        <Grid item xs={12} sm={6} md={3}>
          <CustomTextField
            fullWidth
            label='Buscar por Identificación'
            placeholder='NIT, CC, CE...'
            value={identificationSearch}
            onChange={(e) => setIdentificationSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <Icon icon='tabler:id' className='text-xl' />
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        {/* Status filter */}
        <Grid item xs={12} sm={6} md={3}>
          <CustomTextField
            select
            fullWidth
            label='Estado'
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            SelectProps={{ displayEmpty: true }}
          >
            <MenuItem value=''>Todos</MenuItem>
            <MenuItem value='true'>Activo</MenuItem>
            <MenuItem value='false'>Inactivo</MenuItem>
          </CustomTextField>
        </Grid>

        {/* Pipeline filter */}
        <Grid item xs={12} sm={6} md={3}>
          <CustomTextField
            select
            fullWidth
            label='Embudo'
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            SelectProps={{ displayEmpty: true }}
          >
            <MenuItem value=''>Todos</MenuItem>
            {pipelines.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>
                {p.name}
              </MenuItem>
            ))}
          </CustomTextField>
        </Grid>

        {/* Stage filter */}
        <Grid item xs={12} sm={6} md={3}>
          <CustomTextField
            select
            fullWidth
            label='Etapa'
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            SelectProps={{ displayEmpty: true }}
            disabled={!pipelineId}
          >
            <MenuItem value=''>Todas</MenuItem>
            {stages.map((s) => (
              <MenuItem key={s.id} value={String(s.id)}>
                {s.name}
              </MenuItem>
            ))}
          </CustomTextField>
        </Grid>

        {/* Clear filters button */}
        <Grid item xs={12} sm={6} md={3}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              height: '100%',
              pt: { xs: 0, sm: 2.5 },
            }}
          >
            <Button
              variant='outlined'
              color='secondary'
              onClick={handleClearFilters}
              startIcon={<Icon icon='tabler:x' />}
              fullWidth
            >
              Limpiar Filtros
            </Button>
          </Box>
        </Grid>
      </Grid>
    </CardContent>
  );
};

export default TableFilters;
