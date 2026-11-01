with open('src/app/api/balances/route.ts', 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()
start_first = 149  # línea 150 en 0-based
end_first = 168    # línea 169
new_lines = lines[:start_first] + lines[end_first+1:]
with open('src/app/api/balances/route.ts', 'w', encoding='utf-8') as f:
    for ln in new_lines:
        f.write(ln + '\n')
print('Eliminado bloque duplicado, líneas restantes:', len(new_lines))
