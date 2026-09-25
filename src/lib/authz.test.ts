import { describe, expect, test } from "vitest";
import { getPermissions } from "./authz";

describe("getPermissions", () => {
  test("never reports full access when there is no session", async () => {
    await expect(getPermissions(null)).resolves.toEqual([]);
    await expect(
      getPermissions({ user: { id: undefined } } as unknown as Parameters<
        typeof getPermissions
      >[0])
    ).resolves.toEqual([]);
  });
});
