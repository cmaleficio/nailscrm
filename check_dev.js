const Database = require('better-sqlite3');
const db = new Database('dev.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));
const cols = db.prepare("PRAGMA table_info(payments)").all();
console.log('payments columns:', cols.map(c => c.name).join(', '));
const hasCol = cols.some(c => c.name === 'covered_purchase_ids');
console.log('covered_purchase_ids:', hasCol);
