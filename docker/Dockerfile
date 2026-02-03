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

# Директории для логов и данных (volumes при монтировании перезаписывают права)
RUN mkdir -p /app/logs /app/data

# su-exec для переключения пользователя в entrypoint
RUN apk add --no-cache su-exec

# Entrypoint фиксирует права на mounted volumes перед запуском
COPY docker/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENV NODE_ENV=production

# Пользователь nodejs (uid 1001) — приложение запускается через entrypoint
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/index.js"]

