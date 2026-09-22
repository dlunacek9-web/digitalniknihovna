import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'library.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency performance
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'demo_user',
    isbn TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    authors TEXT,
    cover_url TEXT,
    publication_date TEXT,
    publisher TEXT,
    page_count INTEGER,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
  CREATE INDEX IF NOT EXISTS idx_books_user ON books(user_id);
`);

export default db;
