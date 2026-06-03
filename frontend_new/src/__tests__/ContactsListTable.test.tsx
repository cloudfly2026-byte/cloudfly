import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ContactsListTable from '@/views/marketing/contacts/List/ContactsListTable';
import { contactsApi } from '@/redux/api/contactsApi';

// Mock the RTK Query hooks
vi.mock('@/redux/api/contactsApi', () => ({
  contactsApi: {
    reducerPath: 'contactsApi',
    reducer: (state = {}) => state,
    middleware: () => (next: any) => (action: any) => next(action),
    endpoints: {},
  },
  useGetContactsQuery: vi.fn(),
  useDeleteContactMutation: vi.fn(),
}));

const mockUseGetContactsQuery = vi.mocked(
  require('@/redux/api/contactsApi').useGetContactsQuery
);
const mockUseDeleteContactMutation = vi.mocked(
  require('@/redux/api/contactsApi').useDeleteContactMutation
);

function createMockStore() {
  return configureStore({
    reducer: {
      [contactsApi.reducerPath]: contactsApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(contactsApi.middleware),
  });
}

function renderWithStore(ui: React.ReactElement) {
  const store = createMockStore();
  return render(<Provider store={store}>{ui}</Provider>);
}

describe('ContactsListTable', () => {
  const mockDeleteContact = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteContact.mockResolvedValue({});

    mockUseGetContactsQuery.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            phone: '1234567890',
            type: 'LEAD',
            stage: 'NEW',
            tenantId: 1,
            companyId: 1,
            isActive: true,
            chatbotEnabled: false,
            tags: [{ id: 1, name: 'VIP', color: '#ff0000' }],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            name: 'Jane Smith',
            email: 'jane@example.com',
            phone: '0987654321',
            type: 'CUSTOMER',
            stage: 'CONVERTED',
            tenantId: 1,
            companyId: 1,
            isActive: true,
            chatbotEnabled: false,
            tags: [],
            createdAt: '2024-01-02T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
        ],
        totalElements: 2,
        totalPages: 1,
        currentPage: 0,
        pageSize: 20,
      },
      isLoading: false,
      isFetching: false,
      error: null,
    });

    mockUseDeleteContactMutation.mockReturnValue([mockDeleteContact, { isLoading: false }]);
  });

  it('should render the contacts table with data', () => {
    renderWithStore(<ContactsListTable />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('should render filter inputs', () => {
    renderWithStore(<ContactsListTable />);

    expect(screen.getByPlaceholderText('Buscar por nombre...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar por email...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar por teléfono...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar por identificación...')).toBeInTheDocument();
  });

  it('should render pagination controls', () => {
    renderWithStore(<ContactsListTable />);

    expect(screen.getByText('← Anterior')).toBeInTheDocument();
    expect(screen.getByText('Siguiente →')).toBeInTheDocument();
    expect(screen.getByText(/Página 1 de 1/)).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockUseGetContactsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: false,
      error: null,
    });

    renderWithStore(<ContactsListTable />);

    expect(screen.getByText('Cargando contactos...')).toBeInTheDocument();
  });

  it('should show empty state when no contacts', () => {
    mockUseGetContactsQuery.mockReturnValue({
      data: {
        data: [],
        totalElements: 0,
        totalPages: 0,
        currentPage: 0,
        pageSize: 20,
      },
      isLoading: false,
      isFetching: false,
      error: null,
    });

    renderWithStore(<ContactsListTable />);

    expect(screen.getByText('No se encontraron contactos')).toBeInTheDocument();
  });

  it('should show error state', () => {
    mockUseGetContactsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: { status: 500 },
    });

    renderWithStore(<ContactsListTable />);

    expect(screen.getByText(/Error al cargar los contactos/)).toBeInTheDocument();
  });

  it('should call deleteContact when delete button is clicked and confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithStore(<ContactsListTable />);

    const deleteButtons = screen.getAllByText('Eliminar');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDeleteContact).toHaveBeenCalledWith(1);
    });
  });

  it('should not call deleteContact when delete is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithStore(<ContactsListTable />);

    const deleteButtons = screen.getAllByText('Eliminar');
    fireEvent.click(deleteButtons[0]);

    expect(mockDeleteContact).not.toHaveBeenCalled();
  });

  it('should display contact tags', () => {
    renderWithStore(<ContactsListTable />);

    expect(screen.getByText('VIP')).toBeInTheDocument();
  });

  it('should display total elements count', () => {
    renderWithStore(<ContactsListTable />);

    expect(screen.getByText(/2 contactos/)).toBeInTheDocument();
  });

  it('should display contact type badges', () => {
    renderWithStore(<ContactsListTable />);

    expect(screen.getByText('LEAD')).toBeInTheDocument();
    expect(screen.getByText('CUSTOMER')).toBeInTheDocument();
  });

  it('should display formatted creation dates', () => {
    renderWithStore(<ContactsListTable />);

    // Dates are formatted as es-CO locale
    const dateElements = screen.getAllByText(/\d{2}\/\d{2}\/\d{4}/);
    expect(dateElements.length).toBeGreaterThanOrEqual(2);
  });
});
