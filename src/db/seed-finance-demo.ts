import { db, schema } from "./index";
import { eq } from "drizzle-orm";
import { createInventoryIn } from "@/lib/inventory";

const now = Math.floor(Date.now() / 1000);
const DAY = 86400;

const ADMIN_ID = (() => {
  const existing = db.select().from(schema.users).where(eq(schema.users.role, "admin")).all();
  return (
    existing[0]?.id ??
    (() => {
      throw new Error("Crea un admin antes de sembrar finanzas");
    })()
  );
})();

function serviceId(name: string): string | undefined {
  return db.select({ id: schema.services.id }).from(schema.services).where(eq(schema.services.name, name)).get()?.id;
}

function categoryId(name: string): string | undefined {
  return db
    .select({ id: schema.expenseCategories.id })
    .from(schema.expenseCategories)
    .where(eq(schema.expenseCategories.name, name))
    .get()?.id;
}

function wipe() {
  db.delete(schema.paymentReceipts).run();
  db.delete(schema.supplierPayments).run();
  db.delete(schema.billItems).run();
  db.delete(schema.bills).run();
  db.delete(schema.inventoryMovements).run();
  db.delete(schema.serviceProducts).run();
  db.delete(schema.inventoryItems).run();
  db.delete(schema.suppliers).run();
  db.delete(schema.bankAccounts).run();
}

wipe();

const supplier1 = {
  id: crypto.randomUUID(),
  name: "Distribuidora BellaUnas",
  phone: "+582123456789",
  email: "ventas@bellaunas.com",
  address: "CC Los Mejores, Local 15",
  notes: null,
  createdAt: now - 30 * DAY,
};
const supplier2 = {
  id: crypto.randomUUID(),
  name: "Insumos Pro Nails",
  phone: "+582121234567",
  email: null,
  address: null,
  notes: "Pagos a 30 días",
  createdAt: now - 20 * DAY,
};
db.insert(schema.suppliers).values([supplier1, supplier2]).run();

const bankUsd = {
  id: crypto.randomUUID(),
  bankName: "Banesco USD",
  accountType: "savings" as const,
  accountNumber: "01340000000000001234",
  currency: "USD" as const,
  isActive: 1,
  notes: null,
  createdAt: now,
};
const bankVes = {
  id: crypto.randomUUID(),
  bankName: "Banesco VES",
  accountType: "checking" as const,
  accountNumber: "01340000000000005678",
  currency: "VES" as const,
  isActive: 1,
  notes: null,
  createdAt: now,
};
db.insert(schema.bankAccounts).values([bankUsd, bankVes]).run();

const itemMon = { id: "ACR-001", name: "Monómero acrílico", unit: "ml", stock: 0, avgCost: 0, minStock: 200, isActive: 1, notes: null, barcode: "7701000000001", photoUrl: null, createdAt: now };
const itemPow = { id: "ACR-002", name: "Polvo acrílico", unit: "g", stock: 0, avgCost: 0, minStock: 150, isActive: 1, notes: null, barcode: "7701000000002", photoUrl: null, createdAt: now };
const itemGel = { id: "GEL-001", name: "Esmalte semipermanente", unit: "ml", stock: 0, avgCost: 0, minStock: 100, isActive: 1, notes: null, barcode: "7701000000003", photoUrl: null, createdAt: now };
const itemTips = { id: "TIP-001", name: "Tips pack", unit: "pack", stock: 0, avgCost: 0, minStock: 10, isActive: 1, notes: null, barcode: "7701000000004", photoUrl: null, createdAt: now };
db.insert(schema.inventoryItems).values([itemMon, itemPow, itemGel, itemTips]).run();

const invCat = categoryId("Insumos y materiales");
const rentCat = categoryId("Alquiler");

const bill1 = {
  id: crypto.randomUUID(),
  supplierId: supplier1.id,
  categoryId: invCat,
  invoiceNumber: "F-1001",
  type: "inventory" as const,
  billDate: now - 10 * DAY,
  dueDate: now + 20 * DAY,
  currency: "USD" as const,
  amountVes: null,
  rate: null,
  totalUsd: 0,
  status: "partial" as const,
  notes: "Compra mensual de insumos",
  createdBy: ADMIN_ID,
  createdAt: now - 10 * DAY,
};
const bill1Items = [
  { item: itemMon, qty: 500, unit: 2.2 },
  { item: itemPow, qty: 400, unit: 3.1 },
  { item: itemGel, qty: 300, unit: 4.0 },
  { item: itemTips, qty: 20, unit: 5.0 },
];
const bill1Total = bill1Items.reduce((s, it) => s + it.qty * it.unit, 0);
bill1.totalUsd = Math.round(bill1Total * 100) / 100;
db.insert(schema.bills).values(bill1).run();
for (const it of bill1Items) {
  db.insert(schema.billItems)
    .values({
      id: crypto.randomUUID(),
      billId: bill1.id,
      inventoryItemId: it.item.id,
      description: null,
      quantity: it.qty,
      unitCostUsd: it.unit,
      totalUsd: Math.round(it.qty * it.unit * 100) / 100,
    })
    .run();
  createInventoryIn(it.item.id, it.qty, it.unit, "bill", bill1.id, bill1.notes, ADMIN_ID);
}

const bill2 = {
  id: crypto.randomUUID(),
  supplierId: supplier2.id,
  categoryId: rentCat,
  invoiceNumber: "ALQ-08",
  type: "fixed" as const,
  billDate: now - 3 * DAY,
  dueDate: now + 2 * DAY,
  currency: "VES" as const,
  amountVes: 180000,
  rate: 60,
  totalUsd: 3000,
  status: "pending" as const,
  notes: "Alquiler del local",
  createdBy: ADMIN_ID,
  createdAt: now - 3 * DAY,
};
db.insert(schema.bills).values(bill2).run();

db.insert(schema.supplierPayments)
  .values({
    id: crypto.randomUUID(),
    billId: bill1.id,
    bankAccountId: bankUsd.id,
    amountUsd: 200,
    currency: "USD",
    amountVes: null,
    rate: null,
    paymentDate: now - 8 * DAY,
    reference: "TRF-0001",
    notes: "Abono",
    createdBy: ADMIN_ID,
    createdAt: now - 8 * DAY,
  })
  .run();
db.update(schema.bills).set({ status: "partial" }).where(eq(schema.bills.id, bill1.id)).run();

const demoClient = db.select().from(schema.users).where(eq(schema.users.role, "client")).all()[0];
if (demoClient) {
  const rateDemo = 60;
  db.insert(schema.paymentReceipts)
    .values({
      id: crypto.randomUUID(),
      clientId: demoClient.id,
      appointmentId: null,
      amountVes: 500,
      rate: rateDemo,
      amountUsd: Math.round((500 / rateDemo) * 100) / 100,
      photoUrl: "/uploads/demo-captura.jpg",
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      paymentId: null,
      createdAt: now - 1 * DAY,
    })
    .run();
}

const acrylicId = serviceId("Acrílicas Full");
const gelId = serviceId("Gel Semipermanente");
if (acrylicId && gelId) {
  db.insert(schema.serviceProducts)
    .values([
      { id: crypto.randomUUID(), serviceId: acrylicId, inventoryItemId: itemMon.id, quantityPerService: 10 },
      { id: crypto.randomUUID(), serviceId: acrylicId, inventoryItemId: itemPow.id, quantityPerService: 10 },
      { id: crypto.randomUUID(), serviceId: gelId, inventoryItemId: itemGel.id, quantityPerService: 5 },
    ])
    .run();
}

console.log("✨ Finance demo seed complete!");
