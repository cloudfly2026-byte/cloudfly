import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  Contact,
  ContactCreateRequest,
  PaginatedResponse,
  ContactFilters,
} from '@/types/marketing/contactTypes';

/**
 * RTK Query API slice for contacts.
 * Connects to backend_new endpoints at /api/v2/contacts
 * with server-side pagination, filtering, and automatic cache invalidation.
 */
export const contactsApi = createApi({
  reducerPath: 'contactsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v2/contacts',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Contact'],
  endpoints: (builder) => ({
    /**
     * Get paginated contacts with optional server-side filters.
     */
    getContacts: builder.query<
      PaginatedResponse<Contact>,
      ContactFilters & { page: number; size: number }
    >({
      query: (params) => ({
        url: '/paginated',
        params: {
          page: params.page,
          size: params.size,
          name: params.name || undefined,
          email: params.email || undefined,
          phone: params.phone || undefined,
          identification: params.identification || undefined,
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'Contact' as const, id })),
              { type: 'Contact', id: 'LIST' },
            ]
          : [{ type: 'Contact', id: 'LIST' }],
    }),

    /**
     * Get a single contact by ID.
     */
    getContactById: builder.query<Contact, number>({
      query: (id) => `/${id}`,
      providesTags: (result, error, id) => [{ type: 'Contact', id }],
    }),

    /**
     * Create a new contact.
     * Invalidates the contact list cache to trigger a refetch.
     */
    createContact: builder.mutation<Contact, ContactCreateRequest>({
      query: (body) => ({
        url: '',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Contact', id: 'LIST' }],
    }),

    /**
     * Update an existing contact.
     * Invalidates both the specific contact and the list cache.
     */
    updateContact: builder.mutation<
      Contact,
      { id: number; data: ContactCreateRequest }
    >({
      query: ({ id, data }) => ({
        url: `/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Contact', id },
        { type: 'Contact', id: 'LIST' },
      ],
    }),

    /**
     * Delete a contact.
     * Invalidates the contact list cache.
     */
    deleteContact: builder.mutation<void, number>({
      query: (id) => ({
        url: `/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Contact', id: 'LIST' }],
    }),

    /**
     * Search contacts with a query string (predictive search).
     * Uses a debounced query on the frontend side.
     */
    searchContacts: builder.query<Contact[], string>({
      query: (q) => ({
        url: '/search',
        params: { q },
      }),
      providesTags: ['Contact'],
    }),

    /**
     * Check if a phone number is available.
     */
    checkPhoneAvailability: builder.query<boolean, string>({
      query: (phone) => ({
        url: '/check-phone',
        params: { phone },
      }),
    }),

    /**
     * Check if an email is available.
     */
    checkEmailAvailability: builder.query<boolean, string>({
      query: (email) => ({
        url: '/check-email',
        params: { email },
      }),
    }),

    /**
     * Check if a document number is available.
     */
    checkDocumentAvailability: builder.query<
      boolean,
      { documentNumber: string; excludeId?: number }
    >({
      query: ({ documentNumber, excludeId }) => ({
        url: '/check-document',
        params: {
          documentNumber,
          ...(excludeId ? { excludeId } : {}),
        },
      }),
    }),
  }),
});

export const {
  useGetContactsQuery,
  useGetContactByIdQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
  useSearchContactsQuery,
  useLazySearchContactsQuery,
  useCheckPhoneAvailabilityQuery,
  useCheckEmailAvailabilityQuery,
  useCheckDocumentAvailabilityQuery,
} = contactsApi;
