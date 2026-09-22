import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db.js';
import { lookupBookByIsbn, validateIsbn, cleanIsbn } from './isbnService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const DEMO_USER_ID = 'demo_user';

// Helper: generate unique id
function generateId() {
  return 'b_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

/**
 * GET /api/books
 * Retrieves saved books for user with optional query filter (search)
 */
app.get('/api/books', (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    let rows;
    if (q) {
      const stmt = db.prepare(`
        SELECT * FROM books
        WHERE user_id = ?
        AND (
          LOWER(title) LIKE ?
          OR LOWER(authors) LIKE ?
          OR LOWER(isbn) LIKE ?
          OR LOWER(publisher) LIKE ?
        )
        ORDER BY created_at DESC
      `);
      const searchParam = `%${q}%`;
      rows = stmt.all(DEMO_USER_ID, searchParam, searchParam, searchParam, searchParam);
    } else {
      const stmt = db.prepare('SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC');
      rows = stmt.all(DEMO_USER_ID);
    }

    return res.json({
      success: true,
      count: rows.length,
      books: rows
    });
  } catch (err) {
    console.error('Error fetching books:', err);
    return res.status(500).json({ success: false, error: 'Nepodařilo se načíst knihy z databáze.' });
  }
});

/**
 * GET /api/books/:id
 * Retrieves single book details
 */
app.get('/api/books/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM books WHERE id = ? AND user_id = ?');
    const book = stmt.get(req.params.id, DEMO_USER_ID);
    if (!book) {
      return res.status(404).json({ success: false, error: 'Kniha nebyla nalezena.' });
    }
    return res.json({ success: true, book });
  } catch (err) {
    console.error('Error fetching book:', err);
    return res.status(500).json({ success: false, error: 'Chyba při načítání knihy.' });
  }
});

/**
 * POST /api/books
 * Saves new book with duplicate check
 */
app.post('/api/books', (req, res) => {
  try {
    const {
      isbn,
      title,
      authors,
      cover_url,
      publication_date,
      publisher,
      page_count,
      description
    } = req.body;

    if (!isbn || !title) {
      return res.status(400).json({
        success: false,
        error: 'Chybí povinné údaje knihy (ISBN nebo název).'
      });
    }

    const cleanedIsbn = cleanIsbn(isbn);

    // Check if book with this ISBN already exists for user
    const checkStmt = db.prepare('SELECT * FROM books WHERE isbn = ? AND user_id = ?');
    const existing = checkStmt.get(cleanedIsbn, DEMO_USER_ID);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Tuto knihu už v knihovně máš.',
        existingBook: existing
      });
    }

    const id = generateId();
    const insertStmt = db.prepare(`
      INSERT INTO books (
        id, user_id, isbn, title, authors, cover_url, publication_date, publisher, page_count, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      id,
      DEMO_USER_ID,
      cleanedIsbn,
      title.trim(),
      authors ? authors.trim() : 'Neznámý autor',
      cover_url || null,
      publication_date || null,
      publisher || null,
      page_count ? parseInt(page_count, 10) : null,
      description || null
    );

    const newBook = db.prepare('SELECT * FROM books WHERE id = ?').get(id);

    return res.status(201).json({
      success: true,
      message: 'Kniha byla úspěšně přidána do knihovny.',
      book: newBook
    });
  } catch (err) {
    console.error('Error saving book:', err);
    return res.status(500).json({
      success: false,
      error: 'Při ukládání knihy došlo k chybě.'
    });
  }
});

/**
 * DELETE /api/books/:id
 * Removes book from library
 */
app.delete('/api/books/:id', (req, res) => {
  try {
    const { id } = req.params;
    const checkStmt = db.prepare('SELECT * FROM books WHERE id = ? AND user_id = ?');
    const existing = checkStmt.get(id, DEMO_USER_ID);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Kniha k odstranění nebyla nalezena.'
      });
    }

    const deleteStmt = db.prepare('DELETE FROM books WHERE id = ? AND user_id = ?');
    deleteStmt.run(id, DEMO_USER_ID);

    return res.json({
      success: true,
      message: 'Kniha byla odstraněna z knihovny.',
      deletedId: id
    });
  } catch (err) {
    console.error('Error deleting book:', err);
    return res.status(500).json({
      success: false,
      error: 'Při odstraňování knihy došlo k chybě.'
    });
  }
});

/**
 * GET /api/lookup-isbn/:isbn
 * Scans / looks up book metadata from ISBN
 */
app.get('/api/lookup-isbn/:isbn', async (req, res) => {
  try {
    const { isbn } = req.params;
    const result = await lookupBookByIsbn(isbn);

    if (!result.success) {
      return res.status(404).json(result);
    }

    // Check if already in library
    const checkStmt = db.prepare('SELECT * FROM books WHERE isbn = ? AND user_id = ?');
    const existing = checkStmt.get(result.isbn, DEMO_USER_ID);

    return res.json({
      ...result,
      alreadyInLibrary: Boolean(existing),
      existingBook: existing || null
    });
  } catch (err) {
    console.error('Error looking up ISBN:', err);
    return res.status(500).json({
      success: false,
      error: 'Nepodařilo se vyhledat informace o knize. Zkontrolujte připojení k internetu.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
