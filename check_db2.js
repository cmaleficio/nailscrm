const Database = require('better-sqlite3');
const db = new Database('dev.db');
const row = db.prepare("SELECT id FROM users WHERE email='clienta@email.com'").get();
console.log('client id:', row ? row.id : 'NONE');
if (!row) {
  const all = db.prepare('SELECT id, email FROM users').all();
  console.log('all users:', JSON.stringify(all));
  process.exit(0);
}
const items = db.prepare('SELECT * FROM service_purchases WHERE user_id = ?').all(row.id);
const pays = db.prepare('SELECT * FROM payments WHERE user_id = ?').all(row.id);
console.log('service_purchases count:', items.length);
console.log('payments count:', pays.length);
console.log('service_purchases:', JSON.stringify(items.map(i => ({ id: i.id, serviceName: i.serviceName, price: i.servicePrice, financialStatus: i.financialStatus, appointmentId: i.appointmentId })), null, 2));
console.log('payments:', JSON.stringify(pays.map(p => ({ id: p.id, amountUsd: p.amountUsd, userId: p.userId })), null, 2));
