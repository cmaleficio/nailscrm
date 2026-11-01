with open('src/app/api/balances/route.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Insertar tipo Movement después de la línea 32 (0-based índice 32, que es el cierre de BalanceRow)
# Línea 33 en 1-based será el nuevo tipo
insert_at = 32  # después de lines[31] que es el cierre }

new_type_lines = [
    '',
    'type Movement = {',
    '  id: string;',
    '  type: "service" | "payment";',
    '  clientId: string;',
    '  name: string;',
    '  phone: string | null;',
    '  date: string;',
    '  serviceName?: string;',
    '  amountUsd: number;',
    '  amountVes?: number | null;',
    '  currency: "USD" | "VES";',
    '  rate: number | null;',
    '  status: "pending" | "partial" | "paid";',
    '  ref: string;',
    '  kind: "Servicio" | "pago" | "abono";',
    '  notes?: string;',
    '  seqId?: string;',
    '  clientName?: string;',
    '  clientPhone?: string;',
    '};'
]

new_lines = lines[:insert_at+1] + new_type_lines + lines[insert_at+1:]

with open('src/app/api/balances/route.ts', 'w', encoding='utf-8') as f:
    for ln in new_lines:
        f.write(ln + '\n')
print('Tipo Movement insertado')