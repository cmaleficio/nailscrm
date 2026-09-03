import { readFileSync, existsSync } from "fs";
import { JWT } from "google-auth-library";

const RISC_API_BASE = "https://risc.googleapis.com/v1beta";

const SA_PATH = process.env.RISC_SERVICE_ACCOUNT_JSON_PATH ?? "";
if (!SA_PATH) {
  console.error("Set RISC_SERVICE_ACCOUNT_JSON_PATH to the path of the RISC service account JSON key.");
  process.exit(1);
}
if (!existsSync(SA_PATH)) {
  console.error(`File not found: ${SA_PATH}`);
  process.exit(1);
}

const RECEIVER_URL = process.env.RISC_RECEIVER_URL;
if (!RECEIVER_URL) {
  console.error("Set RISC_RECEIVER_URL (e.g. https://studiodreamnails.com/api/risc/events).");
  process.exit(1);
}

const EVENTS = [
  "https://schemas.openid.net/secevent/risc/event-type/verification",
  "https://schemas.openid.net/secevent/risc/event-type/sessions-revoked",
  "https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked",
  "https://schemas.openid.net/secevent/oauth/event-type/token-revoked",
  "https://schemas.openid.net/secevent/risc/event-type/account-disabled",
  "https://schemas.openid.net/secevent/risc/event-type/account-enabled",
  "https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required",
];

async function main() {
  const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));
  const client = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const tokens = await client.authorize();

  const streamBody = {
    delivery: {
      delivery_method: "https://schemas.openid.net/secevent/risc/delivery-method/push",
      url: RECEIVER_URL,
    },
    events_requested: EVENTS,
  };

  const updateRes = await fetch(`${RISC_API_BASE}/stream:update`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(streamBody),
  });

  if (!updateRes.ok) {
    console.error(`stream:update failed: ${updateRes.status} ${await updateRes.text()}`);
    process.exit(1);
  }
  console.log("stream:update OK ->", await updateRes.text());

  const verifyRes = await fetch(`${RISC_API_BASE}/stream:verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ state: "nonce-" + Date.now() }),
  });

  if (!verifyRes.ok) {
    console.error(`stream:verify failed: ${verifyRes.status} ${await verifyRes.text()}`);
    process.exit(1);
  }
  console.log("stream:verify OK (check /api/risc/events for verification event)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});