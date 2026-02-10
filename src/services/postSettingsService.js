/** Сервис для управления настройками постов */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const settingsFile = path.join(projectRoot, 'data', 'post-settings.json');

const WORD_PREFIX = 'word:';
function wordKey(codeWord) {
  return WORD_PREFIX + (codeWord || '').toLowerCase().trim();
}
function isWordKey(key) {
  return typeof key === 'string' && key.startsWith(WORD_PREFIX);
}

// Создаем директорию для данных
const dataDir = path.dirname(settingsFile);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Дефолтные настройки ответов
const defaultSettings = {
  commentReply: 'напиши в директ!',
  directReply: 'Спасибо за интерес! Нажми на кнопку ниже, чтобы получить инструкцию.',
  redirectUrl: process.env.REDIRECT_URL || 'https://t.me/your_bot',
};

class PostSettingsService {
  constructor() {
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      if (fs.existsSync(settingsFile)) {
        const data = fs.readFileSync(settingsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.error('Ошибка загрузки настроек постов', error);
    }
    return {};
  }

  saveSettings() {
    try {
      fs.writeFileSync(settingsFile, JSON.stringify(this.settings, null, 2), 'utf8');
      return true;
    } catch (error) {
      logger.error('Ошибка сохранения настроек постов', error);
      return false;
    }
  }

  getPostSettings(postId) {
    return this.settings[postId] || null;
  }

  setPostSettings(postId, codeWord, settings = {}) {
    this.settings[postId] = {
      codeWord,
      commentReply: settings.commentReply || defaultSettings.commentReply,
      directReply: settings.directReply || defaultSettings.directReply,
      redirectUrl: settings.redirectUrl || defaultSettings.redirectUrl,
      telegramMessage: settings.telegramMessage || 'Привет! Вот инструкция для тебя.',
      telegramMedia: settings.telegramMedia || null,
      telegramButtons: Array.isArray(settings.telegramButtons) ? settings.telegramButtons : [],
      enabled: settings.enabled !== undefined ? settings.enabled : true,
      createdAt: this.settings[postId]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return this.saveSettings();
  }

  getSettingsByCodeWord(codeWord) {
    return this.findPostByCodeWord(codeWord);
  }

  deletePostSettings(postId) {
    if (this.settings[postId]) {
      delete this.settings[postId];
      return this.saveSettings();
    }
    return false;
  }

  getAllSettings() {
    return this.settings;
  }

  findPostByCodeWord(codeWord) {
    const normalized = (codeWord || '').toLowerCase().trim();
    if (!normalized) return null;
    for (const [key, settings] of Object.entries(this.settings)) {
      if (settings.codeWord && settings.codeWord.toLowerCase() === normalized && settings.enabled) {
        return { postId: key, settings };
      }
    }
    return null;
  }

  /** Настройки только по кодовому слову (без Instagram) — для ?start=слово */
  setWordSettings(codeWord, settings = {}) {
    const key = wordKey(codeWord);
    if (!key || key === WORD_PREFIX) return false;
    this.settings[key] = {
      codeWord: (codeWord || '').trim(),
      commentReply: '',
      directReply: '',
      redirectUrl: settings.redirectUrl || defaultSettings.redirectUrl,
      telegramMessage: settings.telegramMessage || 'Привет! Вот инструкция для тебя.',
      telegramMedia: settings.telegramMedia || null,
      telegramButtons: Array.isArray(settings.telegramButtons) ? settings.telegramButtons : [],
      enabled: settings.enabled !== undefined ? settings.enabled : true,
      createdAt: this.settings[key]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      wordOnly: true,
    };
    return this.saveSettings();
  }

  getWordSettings(codeWord) {
    const key = wordKey(codeWord);
    return key && key !== WORD_PREFIX ? this.settings[key] || null : null;
  }

  getAllWordSettings() {
    return Object.entries(this.settings)
      .filter(([key]) => isWordKey(key))
      .map(([id, settings]) => ({ id, ...settings }));
  }

  deleteWordSettings(id) {
    if (!id || !isWordKey(id)) return false;
    if (this.settings[id]) {
      delete this.settings[id];
      return this.saveSettings();
    }
    return false;
  }

  checkCodeWord(text, postId = null) {
    if (!text) return null;

    const lowerText = text.toLowerCase().trim();

    // Если указан конкретный пост, проверяем только его
    if (postId) {
      const postSettings = this.getPostSettings(postId);
      if (postSettings && postSettings.codeWord) {
        if (lowerText.includes(postSettings.codeWord.toLowerCase())) {
          return { codeWord: postSettings.codeWord, postId, settings: postSettings };
        }
      }
      return null;
    }

    // Иначе ищем по всем постам
    return this.findPostByCodeWord(lowerText);
  }
}

export default PostSettingsService;

