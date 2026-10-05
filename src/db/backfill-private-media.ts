import { copyFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/index";
import {
  legacyUploadFilename,
  parsePrivateMediaFile,
  PRIVATE_MEDIA_KINDS,
  PRIVATE_MEDIA_RULES,
  PRIVATE_UPLOADS_DIRNAME,
  privateMediaUrl,
  type PrivateMediaKind,
} from "@/lib/private-media";

/**
 * One-off: mueve a `private-uploads/` las fotos sensibles que ya estaban en
 * `public/uploads` y reescribe la URL de la fila a `/api/media/<kind>/<file>`.
 *
 * Antes de esto las capturas de pago se servían como archivo estático, así que
 * con la URL cualquiera las descargaba. Es idempotente: lo que ya apunta a
 * `/api/media/` se salta, así que se puede volver a correr sin miedo.
 *
 * **Copia, no mueve, y borra al final.** El mismo archivo puede estar
 * referenciado por varias filas y de varios kinds a la vez (en los datos
 * demo una captura aparece a la vez como `receipt` y como `payment`), y cada
 * fila necesita su propia URL privada. Por eso se copia a un nombre UUID
 * distinto por fila y el original de `public/uploads` solo se borra cuando ya
 * no queda ninguna fila apuntándolo.
 */

const PUBLIC_UPLOADS_DIR = join(process.cwd(), "public", "uploads");
const PRIVATE_UPLOADS_DIR = join(process.cwd(), PRIVATE_UPLOADS_DIRNAME);

type Row = { id: string; photoUrl: string | null };

type Reference = {
  kind: PrivateMediaKind;
  id: string;
  photoUrl: string;
  legacy: string;
};

type Result = {
  kind: PrivateMediaKind;
  scanned: number;
  copied: number;
  rewrittenOnly: number;
  alreadyPrivate: number;
};

function selectRows(kind: PrivateMediaKind): Row[] {
  const urlColumn = schema[PRIVATE_MEDIA_RULES[kind].table].photoUrl;
  switch (kind) {
    case "receipt":
      return db
        .select({ id: schema.paymentReceipts.id, photoUrl: urlColumn })
        .from(schema.paymentReceipts)
        .all();
    case "payment":
      return db
        .select({ id: schema.payments.id, photoUrl: urlColumn })
        .from(schema.payments)
        .all();
    case "supplier-payment":
      return db
        .select({ id: schema.supplierPayments.id, photoUrl: urlColumn })
        .from(schema.supplierPayments)
        .all();
    case "inventory":
      return db
        .select({ id: schema.inventoryItems.id, photoUrl: urlColumn })
        .from(schema.inventoryItems)
        .all();
  }
}

function updatePhotoUrl({ kind, id }: Reference, url: string) {
  switch (kind) {
    case "receipt":
      db.update(schema.paymentReceipts)
        .set({ photoUrl: url })
        .where(eq(schema.paymentReceipts.id, id))
        .run();
      return;
    case "payment":
      db.update(schema.payments)
        .set({ photoUrl: url })
        .where(eq(schema.payments.id, id))
        .run();
      return;
    case "supplier-payment":
      db.update(schema.supplierPayments)
        .set({ photoUrl: url })
        .where(eq(schema.supplierPayments.id, id))
        .run();
      return;
    case "inventory":
      db.update(schema.inventoryItems)
        .set({ photoUrl: url })
        .where(eq(schema.inventoryItems.id, id))
        .run();
      return;
  }
}

async function main() {
  await mkdir(PRIVATE_UPLOADS_DIR, { recursive: true });

  // Índice de referencias legacy → filas, para saber cuándo un original ya no
  // lo reclama nadie y se puede borrar de `public/uploads`.
  const pendingByLegacy = new Map<string, Reference[]>();
  const results = new Map<PrivateMediaKind, Result>();

  for (const kind of PRIVATE_MEDIA_KINDS) {
    const rows = selectRows(kind);
    const result: Result = {
      kind,
      scanned: rows.length,
      copied: 0,
      rewrittenOnly: 0,
      alreadyPrivate: 0,
    };

    for (const row of rows) {
      const legacy = legacyUploadFilename(row.photoUrl);
      if (legacy === null) {
        if (row.photoUrl?.startsWith("/api/media/")) result.alreadyPrivate += 1;
        continue;
      }

      const ref: Reference = { kind, id: row.id, photoUrl: row.photoUrl ?? "", legacy };
      const list = pendingByLegacy.get(legacy) ?? [];
      list.push(ref);
      pendingByLegacy.set(legacy, list);

      // Conserva la extensión real del archivo. `parsePrivateMediaFile` solo
      // acepta nombres UUID, así que de un nombre legacy sacamos la extensión
      // a mano y el nombre nuevo siempre es un UUID.
      const parsed = parsePrivateMediaFile(legacy);
      const extension = parsed?.extension ?? legacy.split(".").pop()?.toLowerCase() ?? "jpg";
      const newUrl = privateMediaUrl(kind, `${crypto.randomUUID()}.${extension}`);

      const source = join(PUBLIC_UPLOADS_DIR, legacy);
      if (existsSync(source)) {
        await copyFile(source, join(PRIVATE_UPLOADS_DIR, newUrl.split("/").pop()!));
        result.copied += 1;
      } else {
        // Los seeds apuntan a `/uploads/demo-captura.jpg`, que no existe en
        // disco. La URL se reescribe igual para que la fila quede consistente.
        result.rewrittenOnly += 1;
      }
      updatePhotoUrl(ref, newUrl);
    }

    results.set(kind, result);
  }

  // Segunda pasada: se actualiza el original cuando todas sus filas ya tienen
  // URL privada. Si un archivo faltaba en disco, no hay nada que borrar.
  let removed = 0;
  let missing = 0;
  for (const [legacy, refs] of pendingByLegacy) {
    const source = join(PUBLIC_UPLOADS_DIR, legacy);
    if (!existsSync(source)) {
      missing += refs.length;
      continue;
    }
    await unlink(source);
    removed += 1;
  }

  console.log("Moviendo media sensible fuera de public/uploads…\n");
  console.log(JSON.stringify([...results.values()], null, 2));
  const copied = [...results.values()].reduce((a, r) => a + r.copied, 0);
  const rewritten = [...results.values()].reduce((a, r) => a + r.rewrittenOnly, 0);
  console.log(
    `\n${copied} copia(s) escritas en ${PRIVATE_UPLOADS_DIRNAME}/, ` +
      `${rewritten} fila(s) reescritas sin archivo en disco, ` +
      `${removed} original(es) borrados de public/uploads/ ` +
      `(${missing} fila(s) con placeholder inexistente).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
