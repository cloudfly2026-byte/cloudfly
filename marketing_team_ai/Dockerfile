FROM python:3.11-slim

WORKDIR /app

# Dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    default-libmysqlclient-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements primero (cache Docker)
COPY marketing_team_ai/requirements.txt .

# Instalar dependencias
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar todos los módulos del proyecto desde marketing_team_ai/
COPY marketing_team_ai/*.py ./
COPY marketing_team_ai/agents/ ./agents/
COPY marketing_team_ai/crews/ ./crews/
COPY marketing_team_ai/flows/ ./flows/
COPY marketing_team_ai/kafka/ ./kafka/
COPY marketing_team_ai/services/ ./services/
COPY marketing_team_ai/tools/ ./tools/
COPY marketing_team_ai/sql/ ./sql/

# Puerto
EXPOSE 8000

# Ejecutar worker
CMD ["python", "main.py"]
