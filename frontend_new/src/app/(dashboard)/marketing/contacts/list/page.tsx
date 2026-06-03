import ContactListTable from '@/views/marketing/contacts/List/ContactListTable';

export const metadata = {
  title: 'Contactos CRM | CloudFly AI',
  description: 'Gestiona tus contactos del CRM con paginación del lado del servidor y filtrado en tiempo real.',
};

export default function ContactsListPage() {
  return <ContactListTable />;
}
