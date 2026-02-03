/** Настройка логирования */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем директорию для логов (относительно корня проекта)
const projectRoot = path.resolve(__dirname, '../..');
const logsDir = path.join(projectRoot, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const getLogFileName = () => {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return path.join(logsDir, `instabot_${date}.log`);
};

const logFile = getLogFileName();

const formatMessage = (level, message) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}\n`;
};

export const logger = {
  info: (message) => {
    const logMessage = formatMessage('INFO', message);
    fs.appendFileSync(logFile, logMessage, 'utf8');
    console.log(`[INFO] ${message}`);
  },

  error: (message, error) => {
    const errorMessage = error ? `${message}: ${error.stack || error}` : message;
    const logMessage = formatMessage('ERROR', errorMessage);
    fs.appendFileSync(logFile, logMessage, 'utf8');
    console.error(`[ERROR] ${errorMessage}`);
  },

  warn: (message) => {
    const logMessage = formatMessage('WARN', message);
    fs.appendFileSync(logFile, logMessage, 'utf8');
    console.warn(`[WARN] ${message}`);
  },
};

