#!/bin/sh
# Исправление прав на mounted volumes (logs, data) перед запуском от пользователя nodejs
chown -R nodejs:nodejs /app/logs /app/data 2>/dev/null || true
exec su-exec nodejs "$@"
