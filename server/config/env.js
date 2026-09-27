import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Priority 1: server/.env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Priority 2: root .env
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

export default process.env;

