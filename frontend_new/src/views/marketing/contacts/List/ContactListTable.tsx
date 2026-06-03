'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Button,
  LinearProgress,
  Avatar,
  Tooltip,
  Paper,
  TablePagination,
  alpha,
} from '@mui/material';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useGetContactsQuery,
  useDeleteContactMutation,
} from '@/redux/api/contactsApi';
import { tagService } from '@/services/marketing/tagService';
import { pipelineService } from '@/services/marketing/pipelineService';
import type { Contact, ContactFilters } from '@/types/marketing/contactTypes';
import type { Pipeline } from '@/types/marketing/pipelineTypes';
import CRMStatsCards from './CRMStatsCards';
import TableFilters from './TableFilters';

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 10;

export default function ContactListTable() {
  const router = useRouter();

  // Server-side pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);

  // Server-side filter state
  const [filters, setFilters] = useState<ContactFilters>({});

  // Pipelines for display names
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  // RTK Query: fetch contacts from backend_new with server-side pagination & filters
  const {
    data: paginatedData,
    isLoading,
    isFetching,
    error,
  } = useGetContactsQuery(
    { page, size: rowsPerPage, ...filters },
    {
      // Refetch on arg change (page/filters)
      refetchOnMountOrArgChange: true,
    }
  );

  // RTK Query: delete mutation with automatic cache invalidation
  const [deleteContact] = useDeleteContactMutation();

  // Load pipelines on mount (for display names only)
  React.useEffect(() => {
    pipelineService.getAllPipelines().then((data) => setPipelines(data || [])).catch(() => {});
  }, []);

  // Enrich contacts with tags (fetched in parallel for current page)
  const [enrichedContacts, setEnrichedContacts] = useState<Contact[]>([]);

  React.useEffect(() => {
    const contacts = paginatedData?.data ?? [];
    if (contacts.length === 0) {
      setEnrichedContacts([]);
      return;
    }

    Promise.all(
      contacts.map(async (c: Contact) => {
        try {
          const tags = await tagService.getContactTags(c.id);
          return { ...c, tags };
        } catch {
          return { ...c, tags: [] };
        }
      })
    ).then(setEnrichedContacts);
  }, [paginatedData?.data]);

  // Handlers
  const handleEdit = useCallback(
    (contact: Contact) => {
      router.push(`/marketing/contacts/${contact.id}`);
    },
    [router]
  );

  const handleAdd = useCallback(() => {
    router.push(`/marketing/contacts/new`);
  }, [router]);

  const handleDelete = useCallback(
    async (id: number) => {
      if (!window.confirm('¿Seguro de eliminar este contacto?')) return;
      try {
        await deleteContact(id).unwrap();
        // Cache invalidation happens automatically via RTK Query tags
      } catch (err) {
        console.error('Error al eliminar contacto:', err);
      }
    },
    [deleteContact]
  );

  // Server-side filter handler (resets to page 0)
  const handleFiltersChange = useCallback((newFilters: ContactFilters) => {
    setFilters(newFilters);
    setPage(0);
  }, []);

  // Pagination handlers
  const handlePageChange = useCallback((_event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setRowsPerPage(parseInt(event.target.value, 10));
      setPage(0);
    },
    []
  );

  // Display helpers
  const getPipelineName = useCallback(
    (id?: number) => {
      if (!id) return 'N/A';
      const p = pipelines.find((item) => item.id === id);
      return p ? p.name : 'Desconocido';
    },
    [pipelines]
  );

  const getStageName = useCallback(
    (pipelineId?: number, stageId?: number) => {
      if (!pipelineId || !stageId) return 'Buzón de Entrada';
      const p = pipelines.find((item) => item.id === pipelineId);
      if (!p || !p.stages) return 'Desconocido';
      const s = p.stages.find((item) => item.id === stageId);
      return s ? s.name : 'Desconocido';
    },
    [pipelines]
  );

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      LEAD: 'Lead',
      POTENTIAL_CUSTOMER: 'Cliente Potencial',
      CUSTOMER: 'Cliente',
      CLIENT: 'Cliente',
      SUPPLIER: 'Proveedor',
      OTHER: 'Otro',
    };
    return types[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, any> = {
      LEAD: 'warning',
      POTENTIAL_CUSTOMER: 'primary',
      CUSTOMER: 'success',
      CLIENT: 'success',
      SUPPLIER: 'info',
      OTHER: 'secondary',
    };
    return colors[type] || 'secondary';
  };

  // Stats data: use enriched contacts for current page + total from server
  const totalElements = paginatedData?.totalElements ?? 0;
  const totalPages = paginatedData?.totalPages ?? 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* 4 Premium CRM Stats Cards — uses RTK Query data for total count */}
      <CRMStatsCards contactsData={enrichedContacts} totalContacts={totalElements} />

      <Card>
        {/* Header */}
        <Box
          sx={{
            p: 5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box>
            <Typography variant="h5">Gestión de Contactos</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Total: {totalElements} contactos
              {isFetching && !isLoading && (
                <Typography
                  component="span"
                  variant="caption"
                  color="primary"
                  sx={{ ml: 1, fontStyle: 'italic' }}
                >
                  (actualizando...)
                </Typography>
              )}
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={handleAdd}
            startIcon={<Icon icon="tabler:plus" />}
          >
            Nuevo Contacto
          </Button>
        </Box>

        {/* Server-side filters */}
        <TableFilters
          onFiltersChange={handleFiltersChange}
          pipelines={pipelines}
        />

        {isLoading && <LinearProgress />}

        {/* Error state */}
        {error && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="error">
              Error al cargar los contactos. Por favor intente nuevamente.
            </Typography>
          </Box>
        )}

        {/* Table */}
        <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell>Contacto</TableCell>
                <TableCell>Identificación</TableCell>
                <TableCell>Embudo / Etapa</TableCell>
                <TableCell>Etiquetas</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Última Actividad</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!isLoading && enrichedContacts.length === 0 && !error ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                    <Typography variant="body1" color="text.secondary">
                      No se encontraron contactos
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                enrichedContacts.map((contact: Contact) => (
                  <TableRow
                    key={contact.id}
                    hover
                    onClick={() => handleEdit(contact)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Avatar
                          src={contact.avatarUrl}
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: contact.isActive
                              ? 'primary.main'
                              : 'divider',
                          }}
                        >
                          {contact.name
                            ? contact.name.charAt(0).toUpperCase()
                            : 'C'}
                        </Avatar>
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {contact.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {contact.email ||
                              contact.phone ||
                              'Sin datos de contacto'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {contact.documentType || 'NIT'}:{' '}
                        {contact.documentNumber || contact.taxId || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography
                          variant="body2"
                          color="primary"
                          sx={{ fontWeight: 500 }}
                        >
                          {getPipelineName(contact.pipelineId)}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {getStageName(contact.pipelineId, contact.stageId)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 1,
                          maxWidth: 200,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contact.tags && contact.tags.length > 0 ? (
                          contact.tags.map((tag) => (
                            <Chip
                              key={tag.id}
                              label={tag.name}
                              size="small"
                              sx={{
                                backgroundColor: alpha(
                                  tag.color || '#7367F0',
                                  0.12
                                ),
                                color: tag.color || '#7367F0',
                                borderColor: alpha(
                                  tag.color || '#7367F0',
                                  0.25
                                ),
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                fontWeight: 500,
                              }}
                            />
                          ))
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            Sin etiquetas
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getTypeLabel(contact.type)}
                        size="small"
                        variant="tonal"
                        color={getTypeColor(contact.type)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={contact.isActive ? 'Activo' : 'Inactivo'}
                        color={contact.isActive ? 'success' : 'secondary'}
                        size="small"
                        variant="tonal"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {contact.updatedAt || contact.createdAt
                          ? format(
                              new Date(contact.updatedAt || contact.createdAt),
                              'dd/MM/yyyy',
                              { locale: es }
                            )
                          : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Editar">
                        <IconButton
                          onClick={() => handleEdit(contact)}
                          color="info"
                        >
                          <Icon icon="tabler:edit" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton
                          onClick={() => handleDelete(contact.id)}
                          color="error"
                        >
                          <Icon icon="tabler:trash" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Premium MUI Pagination — server-side */}
        <TablePagination
          rowsPerPageOptions={PAGE_SIZE_OPTIONS}
          component="div"
          count={totalElements}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
          labelRowsPerPage="Contactos por página:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
          }
        />
      </Card>
    </Box>
  );
}
