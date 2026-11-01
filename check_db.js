const Database = require('better-sqlite3');
const db = new Database('dev.db');
const row = db.prepare("SELECT id FROM users WHERE email='clienta@email.com'").get();
console.log('client id:', row ? row.id : 'NONE');
if (row) {
  const items = db.prepare('SELECT * FROM service_purchases WHERE user_id = ?').all(row.id);
  console.log('service_purchases count:', items.length);
  const pays = db.prepare('SELECT * FROM payments WHERE user_id = ?').all(row.id);
  console.log('payments count:', pays.length);
}
