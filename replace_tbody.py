with open('src/app/(admin)/dashboard/balances/BalancesContent.tsx', 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()

# Encontrar la línea que comienza el tbody
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if '<tbody>' in line:
        start_idx = i
    if start_idx is not None and '</tbody>' in line:
        end_idx = i
        break

if start_idx is None or end_idx is None:
    print("No encontrado tbody")
else:
    new_block = [
        '                <tbody>',
        '                  {(() => {',
        '                    const allMovements = (balanceData as any).clients',
        '                      ? (balanceData as any).clients.flatMap((c: any) => (c.movements || []).map((m: any) => ({ ...m, clientName: m.clientName ?? c.name ?? "—", clientPhone: c.phone ?? m.clientPhone ?? "—" })))',
        '                      : [];',
        '                    return allMovements',
        '                      .sort((a: any, b: any) => {',
        '                        const da = a.date === "—" ? 0 : new Date(a.date.split("/").reverse().join("-")).getTime();',
        '                        const db2 = b.date === "—" ? 0 : new Date(b.date.split("/").reverse().join("-")).getTime();',
        '                        return db2 - da;',
        '                      })',
        '                      .map((m: any) => (',
        '                        <tr key={m.id ?? m.serviceName + m.date + Math.random()} className="border-t border-gray-100 hover:bg-pink-50/40">',
        '                          <td className="px-3 py-2 font-mono text-xs text-gray-500">{m.seqId ? m.seqId : (m.id ? String(m.id).slice(0, 8) : "—")}</td>',
        '                          <td className="px-3 py-2 text-gray-700">{m.date ?? "—"}</td>',
        '                          <td className="px-3 py-2 font-medium text-gray-900">{m.clientName ?? "—"}</td>',
        '                          <td className="px-3 py-2 text-gray-800">{m.serviceName ?? "—"}</td>',
        '                          <td className="px-3 py-2 text-right text-gray-900">',
        '                            {m.currency === "VES" && m.amountVes != null',
        '                              ? `${Number(m.amountVes).toFixed(2)} Bs`',
        '                              : `$${Number(m.priceUsd).toFixed(2)}`}',
        '                          </td>',
        '                          <td className="px-3 py-2 text-right text-gray-600">{m.rate != null ? `${Number(m.rate).toFixed(2)}` : "—"}</td>',
        '                          <td className="px-3 py-2 text-right font-semibold text-gray-900">{m.amountUsd != null ? `$${Number(m.amountUsd).toFixed(2)}` : "—"}</td>',
        '                          <td className="px-3 py-2">',
        '                            <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${m.status === "paid" ? "bg-green-100 text-green-700" : m.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>',
        '                              {m.status === "paid" ? "Pagado" : m.status === "partial" ? "Abonado" : m.status ?? "Pendiente"}',
        '                            </span>',
        '                          </td>',
        '                          <td className="px-3 py-2 text-xs text-gray-500">{m.ref ?? "—"}</td>',
        '                          <td className="px-3 py-2 text-xs text-gray-600">{m.clientPhone ?? "—"}</td>',
        '                          <td className="px-3 py-2 text-xs text-gray-600">{m.kind ?? "—"}</td>',
        '                        </tr>',
        '                      ));',
        '                  })()}',
        '                </tbody>',
    ]
    # Reemplazar líneas del start al end (inclusive)
    new_lines = lines[:start_idx] + new_block + lines[end_idx+1:]
    with open('src/app/(admin)/dashboard/balances/BalancesContent.tsx', 'w', encoding='utf-8') as f:
        for ln in new_lines:
            f.write(ln + '\n')
    print('Reemplazado tbody con flatMap ordenado por fecha desc')
