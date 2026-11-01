with open('src/app/api/balances/route.ts', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('currency: "USD",', 'currency: "USD" as const,')
content = content.replace(
    '        serviceName: r.serviceName,\n        priceUsd: r.price,',
    '        clientName: "",\n        clientPhone: null,\n        serviceName: r.serviceName,\n        priceUsd: r.price,'
)
with open('src/app/api/balances/route.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('OK')