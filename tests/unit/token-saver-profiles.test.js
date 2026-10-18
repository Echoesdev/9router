import { describe, it, expect } from "vitest";
import {
  TOKEN_SAVER_PROFILES,
  TOKEN_SAVER_VALIDATED_PROVIDERS,
  getTokenSaverProfile,
} from "../../open-sse/config/tokenSaverProfiles.js";
import { FREE_TIER_PROVIDERS } from "../../open-sse/config/freeTierProviders.js";

describe("token saver profiles (veille-economie-tokens)", () => {
  it("only references providers validated by the 2026-10-18 health-check", () => {
    expect(TOKEN_SAVER_VALIDATED_PROVIDERS).toEqual([
      "ovhcloud-ai-endpoints",
      "mistral",
      "gemini",
      "openrouter",
    ]);
    const known = new Set(FREE_TIER_PROVIDERS.map((p) => p.registryId || p.id));
    for (const profile of Object.values(TOKEN_SAVER_PROFILES)) {
      for (const ex of profile.exampleModels) {
        expect(TOKEN_SAVER_VALIDATED_PROVIDERS).toContain(
          ex.provider === "openrouter" ? "openrouter" : ex.provider,
        );
        expect(known.has(ex.provider) || ex.provider === "ovhcloud-ai-endpoints").toBe(true);
      }
    }
  });

  it("never references untested providers (groq, cloudflare)", () => {
    const blob = JSON.stringify(TOKEN_SAVER_PROFILES);
    expect(blob).not.toContain("groq");
    expect(blob).not.toContain("cloudflare");
  });

  it("every profile keeps RTK on and is opt-in documentation only", () => {
    for (const profile of Object.values(TOKEN_SAVER_PROFILES)) {
      expect(profile.settings.rtkEnabled).toBe(true);
      expect(profile.guidance.suggestedMaxOutputTokens).toBeGreaterThan(0);
    }
    expect(getTokenSaverProfile("eco")).not.toBeNull();
    expect(getTokenSaverProfile("does-not-exist")).toBeNull();
  });

  it("eco profile is strictly more sober than qualite on output budget", () => {
    expect(
      TOKEN_SAVER_PROFILES.eco.guidance.suggestedMaxOutputTokens,
    ).toBeLessThan(TOKEN_SAVER_PROFILES.qualite.guidance.suggestedMaxOutputTokens);
  });
});
