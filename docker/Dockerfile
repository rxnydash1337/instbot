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

# Создание директории для логов
RUN mkdir -p /app/logs && chmod 777 /app/logs

# Переменные окружения
ENV NODE_ENV=production

# Пользователь для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

# Запуск приложения
CMD ["node", "src/index.js"]

