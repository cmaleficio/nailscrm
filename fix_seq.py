with open('src/app/api/balances/route.ts', 'r', encoding='utf-8') as f:
    content = f.read()
old = '    const seqService = assignSeq(serviceMovs, "S");\n    const seqPayment = assignSeq(paymentMovs.filter((m) => m.kind === "abono"), "A").concat(\n      assignSeq(paymentMovs.filter((m) => m.kind === "pago"), "P")\n    );'
new = '    const seqServiceArr = assignSeq([...serviceMovs], "S") || serviceMovs;\n    const seqAbonoArr = assignSeq([...paymentMovs.filter((m) => m.kind === "abono")], "A") || paymentMovs.filter((m) => m.kind === "abono");\n    const seqPagoArr = assignSeq([...paymentMovs.filter((m) => m.kind === "pago")], "P") || paymentMovs.filter((m) => m.kind === "pago");'
content = content.replace(old, new)
with open('src/app/api/balances/route.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Reemplazado')
