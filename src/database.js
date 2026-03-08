// ============================================================
//   OUT TOWN - اوت تاون | Database (SQLite via better-sqlite3)
// ============================================================

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'outtown.db'));

// ── Schema ───────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id   TEXT NOT NULL UNIQUE,
    guild_id     TEXT NOT NULL,
    opener_id    TEXT NOT NULL,
    type         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'open',
    closer_id    TEXT,
    admin_id     TEXT,
    created_at   INTEGER NOT NULL,
    closed_at    INTEGER
  );

  CREATE TABLE IF NOT EXISTS ticket_counter (
    guild_id TEXT PRIMARY KEY,
    count    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id    INTEGER NOT NULL,
    channel_id   TEXT NOT NULL,
    opener_id    TEXT NOT NULL,
    admin_id     TEXT NOT NULL,
    stars        INTEGER NOT NULL,
    source       TEXT NOT NULL DEFAULT 'ticket',  -- 'ticket' or 'dm'
    rated_at     INTEGER NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
  );
`);

// ── Ticket Counter ────────────────────────────────────────────
function getNextTicketNumber(guildId) {
  const row = db.prepare('SELECT count FROM ticket_counter WHERE guild_id = ?').get(guildId);
  const next = (row ? row.count : 0) + 1;
  db.prepare(`
    INSERT INTO ticket_counter (guild_id, count) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET count = excluded.count
  `).run(guildId, next);
  return next;
}

// ── Ticket CRUD ───────────────────────────────────────────────
function createTicket({ channelId, guildId, openerId, type }) {
  const stmt = db.prepare(`
    INSERT INTO tickets (channel_id, guild_id, opener_id, type, status, created_at)
    VALUES (?, ?, ?, ?, 'open', ?)
  `);
  const info = stmt.run(channelId, guildId, openerId, type, Date.now());
  return info.lastInsertRowid;
}

function getTicketByChannel(channelId) {
  return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
}

function closeTicket({ channelId, closerId }) {
  db.prepare(`
    UPDATE tickets SET status = 'closed', closer_id = ?, closed_at = ?
    WHERE channel_id = ?
  `).run(closerId, Date.now(), channelId);
}

function setTicketAdmin(channelId, adminId) {
  db.prepare('UPDATE tickets SET admin_id = ? WHERE channel_id = ?').run(adminId, channelId);
}

// ── Rating CRUD ───────────────────────────────────────────────
function hasRated(openerId, ticketId) {
  return !!db.prepare('SELECT id FROM ratings WHERE opener_id = ? AND ticket_id = ?').get(openerId, ticketId);
}

function saveRating({ ticketId, channelId, openerId, adminId, stars, source }) {
  db.prepare(`
    INSERT INTO ratings (ticket_id, channel_id, opener_id, admin_id, stars, source, rated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(ticketId, channelId, openerId, adminId, stars, source, Date.now());
}

function getRatingsByAdmin(adminId) {
  return db.prepare('SELECT * FROM ratings WHERE admin_id = ?').all(adminId);
}

module.exports = {
  getNextTicketNumber,
  createTicket,
  getTicketByChannel,
  closeTicket,
  setTicketAdmin,
  hasRated,
  saveRating,
  getRatingsByAdmin,
};
