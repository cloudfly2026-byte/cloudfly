import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contactsApi } from '@/redux/api/contactsApi';
import type {
  Contact,
  PaginatedResponse,
  ContactFilters,
  ContactCreateRequest,
} from '@/types/marketing/contactTypes';

// Mock the localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('contactsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-token');
  });

  describe('endpoints', () => {
    it('should define getContacts endpoint', () => {
      const endpoint = contactsApi.endpoints.getContacts;
      expect(endpoint).toBeDefined();
    });

    it('should define getContactById endpoint', () => {
      const endpoint = contactsApi.endpoints.getContactById;
      expect(endpoint).toBeDefined();
    });

    it('should define createContact mutation', () => {
      const endpoint = contactsApi.endpoints.createContact;
      expect(endpoint).toBeDefined();
    });

    it('should define updateContact mutation', () => {
      const endpoint = contactsApi.endpoints.updateContact;
      expect(endpoint).toBeDefined();
    });

    it('should define deleteContact mutation', () => {
      const endpoint = contactsApi.endpoints.deleteContact;
      expect(endpoint).toBeDefined();
    });

    it('should define searchContacts query', () => {
      const endpoint = contactsApi.endpoints.searchContacts;
      expect(endpoint).toBeDefined();
    });

    it('should define checkPhoneAvailability query', () => {
      const endpoint = contactsApi.endpoints.checkPhoneAvailability;
      expect(endpoint).toBeDefined();
    });

    it('should define checkEmailAvailability query', () => {
      const endpoint = contactsApi.endpoints.checkEmailAvailability;
      expect(endpoint).toBeDefined();
    });

    it('should define checkDocumentAvailability query', () => {
      const endpoint = contactsApi.endpoints.checkDocumentAvailability;
      expect(endpoint).toBeDefined();
    });
  });

  describe('tag types', () => {
    it('should include Contact tag type', () => {
      expect(contactsApi.tagTypes).toContain('Contact');
    });
  });

  describe('reducer path', () => {
    it('should have correct reducer path', () => {
      expect(contactsApi.reducerPath).toBe('contactsApi');
    });
  });

  describe('exported hooks', () => {
    it('should export useGetContactsQuery', () => {
      expect(contactsApi.useGetContactsQuery).toBeDefined();
    });

    it('should export useGetContactByIdQuery', () => {
      expect(contactsApi.useGetContactByIdQuery).toBeDefined();
    });

    it('should export useCreateContactMutation', () => {
      expect(contactsApi.useCreateContactMutation).toBeDefined();
    });

    it('should export useUpdateContactMutation', () => {
      expect(contactsApi.useUpdateContactMutation).toBeDefined();
    });

    it('should export useDeleteContactMutation', () => {
      expect(contactsApi.useDeleteContactMutation).toBeDefined();
    });

    it('should export useSearchContactsQuery', () => {
      expect(contactsApi.useSearchContactsQuery).toBeDefined();
    });

    it('should export useLazySearchContactsQuery', () => {
      expect(contactsApi.useLazySearchContactsQuery).toBeDefined();
    });
  });
});

describe('Contact types', () => {
  it('should create a valid Contact object', () => {
    const contact: Contact = {
      id: 1,
      uuid: 'test-uuid',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890',
      address: '123 Main St',
      taxId: '123456789',
      type: 'LEAD',
      stage: 'NEW',
      avatarUrl: 'https://example.com/avatar.png',
      tenantId: 1,
      companyId: 1,
      pipelineId: 1,
      stageId: 1,
      documentType: 'CC',
      documentNumber: '123456789',
      isActive: true,
      chatbotEnabled: false,
      assignedUserIds: '1,2,3',
      tags: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      createdBy: 'admin',
    };

    expect(contact.id).toBe(1);
    expect(contact.name).toBe('John Doe');
    expect(contact.email).toBe('john@example.com');
    expect(contact.tenantId).toBe(1);
    expect(contact.companyId).toBe(1);
  });

  it('should create a valid PaginatedResponse', () => {
    const response: PaginatedResponse<Contact> = {
      data: [],
      totalElements: 100,
      totalPages: 5,
      currentPage: 0,
      pageSize: 20,
    };

    expect(response.totalElements).toBe(100);
    expect(response.totalPages).toBe(5);
    expect(response.currentPage).toBe(0);
    expect(response.pageSize).toBe(20);
  });

  it('should create valid ContactFilters', () => {
    const filters: ContactFilters = {
      name: 'John',
      email: 'john@example.com',
      phone: '123',
      identification: '123456789',
    };

    expect(filters.name).toBe('John');
    expect(filters.email).toBe('john@example.com');
    expect(filters.phone).toBe('123');
    expect(filters.identification).toBe('123456789');
  });

  it('should allow empty ContactFilters', () => {
    const filters: ContactFilters = {};
    expect(Object.keys(filters).length).toBe(0);
  });

  it('should create valid ContactCreateRequest', () => {
    const request: ContactCreateRequest = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '0987654321',
      type: 'LEAD',
    };

    expect(request.name).toBe('Jane Doe');
    expect(request.email).toBe('jane@example.com');
    expect(request.type).toBe('LEAD');
  });

  it('should allow Contact with minimal fields', () => {
    const contact: Contact = {
      id: 1,
      name: 'Minimal',
      type: 'LEAD',
      stage: 'NEW',
      tenantId: 1,
      companyId: 1,
      isActive: true,
      chatbotEnabled: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    expect(contact.id).toBe(1);
    expect(contact.name).toBe('Minimal');
    expect(contact.email).toBeUndefined();
    expect(contact.phone).toBeUndefined();
  });
});

describe('useContactSearch hook', () => {
  it('should export useContactSearch hook', async () => {
    const { useContactSearch } = await import('@/hooks/useContactSearch');
    expect(useContactSearch).toBeDefined();
    expect(typeof useContactSearch).toBe('function');
  });
});
