with open('src/app/api/balances/route.ts', 'r', encoding='utf-8') as f:
    content = f.read()

marker = '  for (const userId of ids) {'
insert = '''  // --- Asignación GLOBAL de seqId (DESCENDENTE por tipo) ---
  const allServiceGlobal = Array.from(serviceMovementsByUser.values()).flat();
  const allPaymentGlobal = Array.from(paymentMovementsByUser.values()).flat();
  const assignGlobal = (arr: any[], prefix: string) => {
    const sorted = [...arr].sort((a: any, b: any) => {
      const da = a.date === "—" ? 0 : new Date(a.date.split("/").reverse().join("-")).getTime();
      const db2 = b.date === "—" ? 0 : new Date(b.date.split("/").reverse().join("-")).getTime();
      return db2 - da;
    });
    sorted.forEach((m: any, i: number) => { m.seqId = prefix + String(i + 1).padStart(5, "0"); });
  };
  const svcOnly = allServiceGlobal.filter((m: any) => m.kind === "Servicio");
  const abonoOnly = allPaymentGlobal.filter((m: any) => m.kind === "abono");
  const pagoOnly = allPaymentGlobal.filter((m: any) => m.kind === "pago");
  assignGlobal(svcOnly, "S");
  assignGlobal(abonoOnly, "A");
  assignGlobal(pagoOnly, "P");
  const globalSeqId = new Map<string, string>();
  [...svcOnly, ...abonoOnly, ...pagoOnly].forEach((m: any) => globalSeqId.set(m.id, m.seqId));

'''
content = content.replace(marker, insert + marker)
with open('src/app/api/balances/route.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Insertado')
