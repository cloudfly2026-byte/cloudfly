// CLOUD-336 - Componente de bienvenida para el módulo de Catálogo en Línea
// Muestra un banner con gradiente purple y el formulario de creación de tienda

'use client'

import React from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import SubdomainForm from './SubdomainForm'

const WelcomeCard = () => {
  return (
    <Card
      className='relative overflow-hidden'
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px'
      }}
    >
      <CardContent className='p-8'>
        <Box className='relative z-10'>
          <Typography variant='h3' className='text-white font-bold mb-2'>
            🛍️ Catálogo en Línea
          </Typography>
          <Typography variant='h6' className='text-white/90 mb-1'>
            Crea tu tienda online en minutos
          </Typography>
          <Typography variant='body1' className='text-white/70 mb-6 max-w-lg'>
            Configura tu catálogo en línea para que tus clientes puedan explorar tus productos
            y realizar pedidos desde cualquier dispositivo.
          </Typography>
        </Box>

        {/* Decorative elements */}
        <div
          className='absolute top-0 right-0 w-64 h-64 rounded-full opacity-10'
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }}
        />
        <div
          className='absolute bottom-0 right-20 w-32 h-32 rounded-full opacity-10'
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }}
        />
      </CardContent>

      {/* Subdomain creation form */}
      <Box className='px-8 pb-8'>
        <SubdomainForm />
      </Box>
    </Card>
  )
}

export default WelcomeCard
