with open('src/app/api/balances/route.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Bloque viejo: desde "// --- Asignación GLOBAL de seqId" hasta el final del mapa movements + clientes push
old_block = """  // --- Asignación GLOBAL de seqId (DESCENDENTE por tipo) ---
  const allServiceGlobal = Array.from(serviceMovementsByUser.values()).flat();
  const allPaymentGlobal = Array.from(paymentMovementsByUser.values()).flat();
  const assignGlobal = (arr: any[], prefix: string) => {
    [...arr].sort((a: any, b: any) => {
      const da = a.date === "—" ? 0 : new Date(a.date.split("/").reverse().join("-")).getTime();
      const db2 = b.date === "—" ? 0 : new Date(b.date.split("/").reverse().join("-")).getTime();
      return db2 - da;
    }).forEach((m: any, i: number) => { m.seqId = prefix + String(i + 1).padStart(5, "0"); });
  };
  const svcOnly = allServiceGlobal.filter((m: any) => m.kind === "Servicio");
  const abonoOnly = allPaymentGlobal.filter((m: any) => m.kind === "abono");
  const pagoOnly = allPaymentGlobal.filter((m: any) => m.kind === "pago");
  assignGlobal(svcOnly, "S");
  assignGlobal(abonoOnly, "A");
  assignGlobal(pagoOnly, "P");
  const globalSeqId = new Map<string, string>();
  [...svcOnly, ...abonoOnly, ...pagoOnly].forEach((m: any) => globalSeqId.set(m.id, m.seqId));

  for (const userId of ids) {
    const { name, phone } = clientInfo.get(userId) ?? { name: "Desconocido", phone: null };
    const due = round2(dueMap.get(userId) ?? 0);
    const paid = round2(paidMap.get(userId) ?? 0);
    const balanceUsd = round2(due - paid);
    const creditUsd = round2(Math.max(0, paid - due));
    if (due === 0 && paid === 0) continue;

    if (balanceUsd > 0.004) totalUsd = round2(totalUsd + balanceUsd);
    if (creditUsd > 0.004) totalCreditUsd = round2(totalCreditUsd + creditUsd);

    const serviceMovs = serviceMovementsByUser.get(userId) ?? [];
    const paymentMovs = paymentMovementsByUser.get(userId) ?? [];

    const movements = [...serviceMovs, ...paymentMovs].sort((a: any, b: any) => {
      const da = a.date === "—" ? 0 : new Date(a.date.split("/").reverse().join("-")).getTime();
      const db2 = b.date === "—" ? 0 : new Date(b.date.split("/").reverse().join("-")).getTime();
      return db2 - da;
    }).map((m: any) => ({
      ...m,
      name,
      phone,
      clientName: name,
      clientPhone: phone,
      seqId: globalSeqId.get(m.id) || m.seqId || "",
    }));

    clients.push({
      clientId: userId,
      name,
      phone,
      dueUsd: due,
      paidUsd: paid,
      balanceUsd,
      creditUsd,
      movements,
    });
  }"""

new_block = """  for (const userId of ids) {
    const { name, phone } = clientInfo.get(userId) ?? { name: "Desconocido", phone: null };
    const due = round2(dueMap.get(userId) ?? 0);
    const paid = round2(paidMap.get(userId) ?? 0);
    const balanceUsd = round2(due - paid);
    const creditUsd = round2(Math.max(0, paid - due));
    if (due === 0 && paid === 0) continue;

    if (balanceUsd > 0.004) totalUsd = round2(totalUsd + balanceUsd);
    if (creditUsd > 0.004) totalCreditUsd = round2(totalCreditUsd + creditUsd);

    const serviceMovs = serviceMovementsByUser.get(userId) ?? [];
    const paymentMovs = paymentMovementsByUser.get(userId) ?? [];

    // --- Orden global por fecha descendente y seqId S/A/P ---
    const allMov = [...serviceMovs, ...paymentMovs];
    // Sort descendente por fecha (DD/MM/AA -> reverse a AA-MM-DD para comparar)
    allMov.sort((a: any, b: any) => {
      const da = a.date === "—" ? 0 : new Date(a.date.split("/").reverse().join("-")).getTime();
      const db2 = b.date === "—" ? 0 : new Date(b.date.split("/").reverse().join("-")).getTime();
      return db2 - da;
    });
    // Asignar seqId global: S para servicios, luego A para abonos, luego P para pagos,
    // respetando el orden descendente de fecha dentro de cada tipo.
    let seqCounter: Record<string, number> = { S: 0, A: 0, P: 0 };
    allMov.forEach((m: any) => {
      if (m.kind === "Servicio") {
        seqCounter.S += 1;
        m.seqId = `S${String(seqCounter.S).padStart(5, "0")}`;
      } else if (m.kind === "abono") {
        seqCounter.A += 1;
        m.seqId = `A${String(seqCounter.A).padStart(5, "0")}`;
      } else if (m.kind === "pago") {
        seqCounter.P += 1;
        m.seqId = `P${String(seqCounter.P).padStart(5, "0")}`;
      }
    });

    const movements = allMov.sort((a: any, b: any) => {
      const da = a.date === "—" ? 0 : new Date(a.date.split("/").reverse().join("-")).getTime();
      const db2 = b.date === "—" ? 0 : new Date(b.date.split("/").reverse().join("-")).getTime();
      return db2 - da;
    }).map((m: any) => ({
      ...m,
      name,
      phone,
      clientName: name,
      clientPhone: phone,
    }));

    clients.push({
      clientId: userId,
      name,
      phone,
      dueUsd: due,
      paidUsd: paid,
      balanceUsd,
      creditUsd,
      movements,
    });
  }"""

content = content.replace(old_block, new_block)
with open('src/app/api/balances/route.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Reemplazado bloque seqId')