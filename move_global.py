with open('src/app/api/balances/route.ts', 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()

# Encontrar bloque global (líneas que empiezan con "  // --- GLOBAL")
start = None
end = None
for i, line in enumerate(lines):
    if 'GLOBAL seqId' in line:
        start = i
    if start is not None and 'globalSeqId.set' in line:
        # Encontrar la línea que cierra esta asignación (la que termina con );
        pass
# El bloque va de start a la línea que contiene "forEach((m: any) => globalSeqId.set(m.id, m.seqId))"
# Encontrar la última línea del bloque
block_end = None
for i in range(start, len(lines)):
    if 'globalSeqId.set(m.id, m.seqId)' in lines[i] and ');' in lines[i]:
        block_end = i
        break

if start is None or block_end is None:
    print('No encontrado bloque global')
else:
    print('Bloque global en líneas', start+1, '-', block_end+1)
    # Extraer el bloque
    block_lines = lines[start:block_end+1]
    # Eliminar del lugar original
    new_lines = lines[:start] + lines[block_end+1:]
    # Encontrar la línea 265 (donde termina el loop de pagos) en new_lines
    insert_idx = None
    for i in range(len(new_lines)):
        if 'paymentMovementsByUser.set(r.userId, movements);' in new_lines[i]:
            insert_idx = i + 1  # insertar justo después
            break
    if insert_idx is not None:
        # Insertar con un salto
        new_lines = new_lines[:insert_idx] + [''] + block_lines + new_lines[insert_idx:]
        with open('src/app/api/balances/route.ts', 'w', encoding='utf-8') as f:
            for ln in new_lines:
                f.write(ln + '\n')
        print('Movido después del loop de pagos')
    else:
        print('No encontrado punto de inserción')
