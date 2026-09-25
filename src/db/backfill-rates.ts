import { backfillMissingRates } from "@/lib/bcv";

async function main() {
  console.log("Rellenando gaps de tasas BCV desde el historial…");
  const result = await backfillMissingRates();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});