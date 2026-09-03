import Database from "better-sqlite3";

const sqlite = new Database("dev.db");

const now = Math.floor(Date.now() / 1000);
const startOfDay = now - ((new Date().getHours() * 3600) + (new Date().getMinutes() * 60) + new Date().getSeconds());
const endOfDay = startOfDay + 86400;

const rows = sqlite.prepare(`
  SELECT
    a.id              AS id,
    a.client_id       AS client_id,
    COALESCE(u.name, '(walk-in)') AS client_name,
    s.name            AS service_name,
    s.duration_mins   AS duration_mins,
    s.price           AS price,
    a.start_time      AS start_time,
    a.end_time        AS end_time,
    a.status          AS status,
    a.reference_photo_url AS reference_photo_url,
    a.final_photo_url     AS final_photo_url
  FROM appointments a
  LEFT JOIN users u ON u.id = a.client_id
  LEFT JOIN services s ON s.id = a.service_id
  WHERE a.start_time >= ? AND a.start_time < ?
  ORDER BY a.start_time ASC
`).all(startOfDay, endOfDay);

function fmt(ts) {
  return new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function localFmt(ts) {
  const d = new Date(ts * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

console.log("Server now (UTC):", fmt(now));
console.log("Server now (local):", localFmt(now));
console.log("Start of day (UTC ts):", startOfDay);
console.log("End of day   (UTC ts):", endOfDay);
console.log("");

if (rows.length === 0) {
  console.log("No hay citas para hoy.");
} else {
  console.table(rows.map((r) => ({
    id: r.id.slice(0, 8),
    client: r.client_name,
    service: r.service_name,
    duration: r.duration_mins + " min",
    price: "$" + r.price,
    start_local: localFmt(r.start_time),
    end_local: localFmt(r.end_time),
    start_utc: fmt(r.start_time),
    end_utc: fmt(r.end_time),
    status: r.status,
    ref_photo: r.reference_photo_url ? "yes" : "-",
    final_photo: r.final_photo_url ? "yes" : "-",
  })));
  console.log("Total:", rows.length);
}

sqlite.close();