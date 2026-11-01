with open('src/app/api/balances/route.ts', 'r', encoding='utf-8') as f:
    content = f.read()
old = '    const movements = [...seqServiceArr, ...seqAbonoArr, ...seqPagoArr].sort((a, b) => {'
new = '    const movements = [...serviceMovs, ...paymentMovs].sort((a: any, b: any) => {'
content = content.replace(old, new)
# Reemplazar el bloque map
old_map = '.map((m) => ({\n      ...m,\n      name,\n      phone,\n      clientName: name,\n      clientPhone: phone,\n    })'
new_map = '.map((m: any) => ({\n      ...m,\n      name,\n      phone,\n      clientName: name,\n      clientPhone: phone,\n      seqId: globalSeqId.get(m.id) || m.seqId || "",\n    })'
content = content.replace(old_map, new_map)
with open('src/app/api/balances/route.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Hecho')
