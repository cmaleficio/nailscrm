const Database = require('better-sqlite3');
const db = new Database('dev.db');
db.exec(`ALTER TABLE payments ADD COLUMN covered_purchase_ids TEXT DEFAULT NULL;`);
db.exec(`CREATE INDEX IF NOT EXISTS payments_covered_purchase_ids_idx ON payments(covered_purchase_ids);`);
console.log('Migration applied to dev.db');
const cols = db.prepare("PRAGMA table_info(payments)").all();
console.log('payments columns:', cols.map(c => c.name).join(', '));
const hasCol = cols.some(c => c.name === 'covered_purchase_ids');
console.log('covered_purchase_ids exists:', hasCol);
