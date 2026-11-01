import Database from "better-sqlite3";

const db = new Database("C:\\Users\\Cmarffisis\\CODE\\nails\\dev.db", { readonly: true });
const CLAUDIA = "64221957-941a-4b69-9cec-8158fcb41899";
const COCINA = "cab535f3-f59d-49dc-b3bc-7124ce8c553b";

function dump(title, sql) {
  console.log(`\n### ${title}`);
  const rows = db.prepare(sql).all();
  for (const r of rows) {
    const keys = Object.keys(r);
    const vals = keys.map((k) => `${k}=${typeof r[k] === "object" ? JSON.stringify(r[k]) : String(r[k])}`).join(" | ");
    console.log(vals);
  }
}

dump("USUARIOS", `SELECT * FROM users WHERE id = '${CLAUDIA}' OR name LIKE '%Claudia%' OR name LIKE '%claudia%'`);
dump("APPOINTMENTS de Claudia", `SELECT * FROM appointments WHERE client_id = '${CLAUDIA}' ORDER BY start_time`);
dump("APPOINTMENTS del curso (servicio group)", `SELECT * FROM appointments WHERE service_id = '${COCINA}' ORDER BY start_time`);
dump("SERVICE PURCHASES de Claudia", `SELECT * FROM service_purchases WHERE user_id = '${CLAUDIA}' ORDER BY created_at`);
dump("SERVICE PURCHASES del curso", `SELECT * FROM service_purchases WHERE service_id = '${COCINA}' ORDER BY created_at`);
dump("PAYMENTS de Claudia", `SELECT * FROM payments WHERE user_id = '${CLAUDIA}' ORDER BY paid_at`);
dump("PAYMENT ALLOCATIONS (los joins completos)", `SELECT pa.*, sp.user_id AS sp_user_id, sp.service_name, sp.service_price, sp.financial_status, sp.appointment_id AS sp_appointment_id FROM payment_allocations pa LEFT JOIN service_purchases sp ON sp.id = pa.purchase_id ORDER BY pa.created_at`);
dump("COURSE ENROLLMENTS", `SELECT * FROM course_enrollments ORDER BY created_at`);
dump("CANCELADAS (snapshot)", `SELECT * FROM cancelled_appointments ORDER BY cancelled_at`);
dump("APPOINTMENTS de TODOS los que tienen compras de curso", `SELECT a.*, s.name AS sname, s.is_group FROM appointments a JOIN services s ON s.id = a.service_id WHERE a.id IN (SELECT DISTINCT appointment_id FROM service_purchases) ORDER BY a.start_time`);

db.close();
