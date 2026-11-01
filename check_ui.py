with open(r'src/app/(admin)/dashboard/balances/BalancesContent.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
print('Unicode OK:', '\ufffd' not in content)
print('| kind:', 'm.kind ??' in content)  
print('| Monto VES:', 'm.currency === "VES"' in content)