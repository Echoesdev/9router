/**
 * [veille-a9] Xiaomi MiMo V2.6 (PAS V2.5) pour 9router.
 * Reseau simule / aucun appel reel : on verifie uniquement le
 * referencement catalogue et le routage d URL des executors existants.
 */
import { describe, it, expect } from "vitest";
import tokenplan from "../../open-sse/providers/registry/xiaomi-tokenplan.js";
import xiaomiMimo from "../../open-sse/providers/registry/xiaomi-mimo.js";
import { XiaomiTokenplanExecutor } from "../../open-sse/executors/xiaomi-tokenplan.js";
import { getProviderModels, isValidModel, getModelTargetFormat } from "../../open-sse/config/providerModels.js";
import { FREE_TIER_PROVIDERS } from "../../open-sse/services/freeTierHealthCheck.js";

describe("[veille-a9] MiMo V2.6 catalog", () => {
  it("references V2.6 Pro/Flash dans xiaomi-mimo (cloud + compte)", () => {
    const ids = xiaomiMimo.models.map((m) => m.id);
    expect(ids).toContain("mimo-v2.6-pro");
    expect(ids).toContain("mimo-v2.6-flash");
  });

  it("references V2.6 Pro/Flash dans xiaomi-tokenplan (nouveau)", () => {
    const ids = tokenplan.models.map((m) => m.id);
    expect(ids).toContain("mimo-v2.6-pro");
    expect(ids).toContain("mimo-v2.6-flash");
    expect(ids.indexOf("mimo-v2.6-pro")).toBeLessThan(ids.indexOf("mimo-v2.5-pro"));
  });

  it("expose la variante Claude native V2.6 Pro via le catalogue resolu", () => {
    expect(isValidModel("xiaomi-tokenplan", "mimo-v2.6-pro")).toBe(true);
    expect(isValidModel("xiaomi-tokenplan", "mimo-v2.6-flash")).toBe(true);
    expect(getModelTargetFormat("xiaomi-tokenplan", "mimo-v2.6-pro-claude")).toBe("claude");
    expect(getProviderModels("xiaomi-tokenplan").map((m) => m.id)).toContain("mimo-v2.6-pro");
  });

  it("ne fait pas de MiMo un fournisseur gratuit (PAYG / abonnement payant)", () => {
    expect(FREE_TIER_PROVIDERS.map((p) => p.id)).not.toContain("xiaomi-mimo");
    expect(FREE_TIER_PROVIDERS.map((p) => p.registryId)).not.toContain("xiaomi-mimo");
    expect(FREE_TIER_PROVIDERS.map((p) => p.registryId)).not.toContain("xiaomi-tokenplan");
  });
});

describe("[veille-a9] MiMo V2.6 tokenplan routing (no network)", () => {
  const ex = new XiaomiTokenplanExecutor();

  it("route V2.6 vers /chat/completions du cluster par defaut (SGP)", () => {
    expect(ex.buildUrl("mimo-v2.6-pro", false, 0, {})).toBe(
      "https://token-plan-sgp.xiaomimimo.com/v1/chat/completions"
    );
    expect(ex.buildUrl("mimo-v2.6-flash", false, 0, { providerSpecificData: { region: "ams" } })).toBe(
      "https://token-plan-ams.xiaomimimo.com/v1/chat/completions"
    );
  });

  it("route V2.6 format Claude vers /anthropic/v1/messages", () => {
    const creds = { runtimeTransport: { format: "claude" }, providerSpecificData: { region: "sgp" } };
    expect(ex.buildUrl("mimo-v2.6-pro", false, 0, creds)).toBe(
      "https://token-plan-sgp.xiaomimimo.com/anthropic/v1/messages"
    );
  });
});
