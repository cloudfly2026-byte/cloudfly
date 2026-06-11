import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tienda en Línea | CloudFly Dashboard',
  description: 'Módulo de catálogo en línea de CloudFly',
};

export default function TiendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main style={{ minHeight: 'calc(100vh - 64px)' }}>
      {children}
    </main>
  );
}
