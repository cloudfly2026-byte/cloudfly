'use client';

import React, { useState, useCallback } from 'react';
import {
  useGetContactsQuery,
  useDeleteContactMutation,
} from '@/redux/api/contactsApi';
import type { Contact, ContactFilters } from '@/types/marketing/contactTypes';

const PAGE_SIZE = 20;

/**
 * Lightweight contacts list table for quick views and embedded contexts.
 * Uses RTK Query for data fetching and automatic cache invalidation.
 * For the full CRM experience, use ContactListTable instead.
 */
export default function ContactsListTable() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<ContactFilters>({});
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading, isFetching, error } = useGetContactsQuery({
    page,
    size: PAGE_SIZE,
    ...filters,
  });

  const [deleteContact] = useDeleteContactMutation();

  const handleSearch = useCallback(
    (field: string, value: string) => {
      setSearchInput(value);
      setFilters((prev) => ({ ...prev, [field]: value || undefined }));
      setPage(0);
    },
    []
  );

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de eliminar este contacto?')) {
      try {
        await deleteContact(id).unwrap();
      } catch (err) {
        console.error('Error deleting contact:', err);
        alert('Error al eliminar el contacto');
      }
    }
  };

  const contacts = data?.data ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  return (
    <div className="w-full">
      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={searchInput}
          onChange={(e) => handleSearch('name', e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
        />
        <input
          type="text"
          placeholder="Buscar por email..."
          onChange={(e) => handleSearch('email', e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
        />
        <input
          type="text"
          placeholder="Buscar por teléfono..."
          onChange={(e) => handleSearch('phone', e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
        />
        <input
          type="text"
          placeholder="Buscar por identificación..."
          onChange={(e) => handleSearch('identification', e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
        />
      </div>

      {/* Loading / Refreshing indicators */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Cargando contactos...
          </span>
        </div>
      )}
      {isFetching && !isLoading && (
        <div className="text-sm text-primary mb-2 italic">
          Actualizando...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-700 dark:text-red-400">
            Error al cargar los contactos. Por favor intente nuevamente.
          </p>
        </div>
      )}

      {/* Contacts Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                Nombre
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                Email
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                Teléfono
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                Tipo
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                Etapa
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                Tags
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                Fecha Creación
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {contacts.length === 0 && !isLoading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  No se encontraron contactos
                </td>
              </tr>
            ) : (
              contacts.map((contact: Contact) => (
                <tr
                  key={contact.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {contact.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {contact.email ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {contact.phone ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {contact.type ?? '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {contact.stage ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {contact.tags && contact.tags.length > 0
                      ? contact.tags.map((t: any) => t.name).join(', ')
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {contact.createdAt
                      ? new Date(contact.createdAt).toLocaleDateString('es-CO')
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                      aria-label={`Eliminar ${contact.name}`}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ← Anterior
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Página {page + 1} de {totalPages || 1} ({totalElements} contactos)
        </span>
        <button
          disabled={page >= totalPages - 1}
          onClick={() => setPage((p) => p + 1)}
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Siguiente →
        </button>
      </div>

      {/* Page size info */}
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        Mostrando {contacts.length} de {totalElements} contactos por página
      </div>
    </div>
  );
}
