// CLOUD-335 - Página principal de tienda
// Redirige a /dashboard/tienda para evitar contenido duplicado

import { redirect } from 'next/navigation'

const TiendaPrincipalPage = () => {
  redirect('/dashboard/tienda')
}

export default TiendaPrincipalPage
