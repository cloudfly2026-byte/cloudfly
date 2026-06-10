// CLOUD-336 - Vista de "En Construcción" para el módulo de Catálogo en Línea
// Muestra un mensaje de que la tienda está siendo configurada

'use client'

import React from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'

interface ConstructionViewProps {
  onRefresh?: () => void
}

const ConstructionView = ({ onRefresh }: ConstructionViewProps) => {
  return (
    <Card className='max-w-2xl mx-auto'>
      <CardContent className='flex flex-col items-center text-center gap-4 p-8'>
        <div className='text-6xl mb-2'>🚧</div>

        <Typography variant='h4' className='font-bold'>
          Tienda en Construcción
        </Typography>

        <Typography variant='body1' className='text-gray-500 max-w-md'>
          Tu tienda online está siendo configurada. Este proceso puede tomar algunos minutos.
          Te notificaremos cuando esté lista.
        </Typography>

        <Box className='flex gap-3 mt-4'>
          <Button
            variant='outlined'
            onClick={onRefresh}
            startIcon={<i className='tabler-refresh' />}
          >
            Verificar estado
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

export default ConstructionView
