import sqlite3
conn = sqlite3.connect('dev.db')
cur = conn.cursor()

# Ver si hay compras de servicio no void
cur.execute('SELECT COUNT(*) FROM service_purchases WHERE financial_status != "void"')
print('Compras no void:', cur.fetchone()[0])

# Ver pagos
cur.execute('SELECT COUNT(*) FROM payments')
print('Pagos totales:', cur.fetchone()[0])

# Ver clientes
cur.execute('SELECT id, name, email FROM users WHERE role="client" LIMIT 5')
for row in cur.fetchall():
    print('Cliente:', row)

conn.close()