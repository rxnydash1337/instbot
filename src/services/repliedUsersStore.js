/** Хранилище ID пользователей, которым уже отправили ответ (1 раз навсегда) */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const storeFile = path.join(projectRoot, 'data', 'replied-users.json');

const dataDir = path.dirname(storeFile);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadIds() {
  try {
    if (fs.existsSync(storeFile)) {
      const data = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
      return new Set(data.ids || []);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveIds(ids) {
  fs.writeFileSync(storeFile, JSON.stringify({ ids: [...ids] }, null, 2), 'utf8');
}

let repliedIds = loadIds();

export function isReplied(senderId) {
  return repliedIds.has(String(senderId));
}

export function markReplied(senderId) {
  repliedIds.add(String(senderId));
  saveIds(repliedIds);
}
