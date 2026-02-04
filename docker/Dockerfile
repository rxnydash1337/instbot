FROM node:18-alpine

# Установка рабочей директории
WORKDIR /app

# Копирование package файлов
COPY package*.json ./

# Установка зависимостей
RUN npm ci --omit=dev && npm cache clean --force

# Копирование исходного кода
COPY src/ ./src/
COPY config/ ./config/
COPY public/ ./public/

RUN mkdir -p /app/logs /app/data

ENV NODE_ENV=production

CMD ["node", "src/index.js"]

