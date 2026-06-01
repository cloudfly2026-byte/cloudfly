FROM node:18-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias (use npm install for compatibility)
RUN npm install --only=production

# Copiar código fuente
COPY src ./src

# Crear directorio para logs
RUN mkdir -p logs

# Exponer puerto
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Iniciar servidor
CMD ["node", "src/index.js"]
