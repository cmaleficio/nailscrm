const Database = require('better-sqlite3');
const db = new Database('dev.db');
const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='payments'").get();
console.log(row ? row.sql : 'no table');
const colInfo = db.prepare("PRAGMA table_info(payments)").all();
const hasCol = colInfo.some(c => c.name === 'covered_purchase_ids');
console.log('covered_purchase_ids exists:', hasCol);
console.log('columns:', colInfo.map(c => c.name).join(', '));
