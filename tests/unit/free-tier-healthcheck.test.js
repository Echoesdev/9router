/**
 * [veille-a5] Unit tests for the free-tier provider health-check.
 * All network calls are mocked: success, HTTP failure, missing key,
 * missing account id, timeout and network error (with secret redaction).
 */
import { describe, it, expect, vi } from "vitest";
import {
  checkFreeTierProvider,
  checkAllFreeTierProviders,
  buildStoredProviderCandidates,
  FREE_TIER_PROVIDERS,
} from "../../open-sse/services/freeTierHealthCheck.js";

const specById = (id) => FREE_TIER_PROVIDERS.find((p) => p.id === id);
const fixedNow = () => new Date("2026-10-17T12:00:00.000Z");
const FAKE_KEY = "fake-test-key-must-never-leak";

function okFetch(capture) {
  return vi.fn(async (url, init) => {
    if (capture) capture.push({ url, init });
    return { ok: true, status: 200 };
  });
}

describe("free-tier health-check config", () => {
  it("covers the six providers documented in veille-a5", () => {
    expect(FREE_TIER_PROVIDERS.map((p) => p.id)).toEqual([
      "ovhcloud-ai-endpoints",
      "mistral",
      "gemini",
      "cloudflare-workers-ai",
      "groq",
      "openrouter-free",
    ]);
  });

  it("uses only frozen https probe URLs and never puts a key in a URL", () => {
    for (const spec of FREE_TIER_PROVIDERS) {
      expect(spec.probe.url.startsWith("https://")).toBe(true);
      expect(spec.probe.url).not.toMatch(/key=|token=|api_key/i);
      for (const envName of spec.envKeys) expect(envName).toMatch(/^[A-Z0-9_]+$/);
    }
  });
});

describe("checkFreeTierProvider", () => {
  it("validates the keyless OVHcloud probe without any key", async () => {
    const capture = [];
    const result = await checkFreeTierProvider(specById("ovhcloud-ai-endpoints"), {
      fetchFn: okFetch(capture),
      env: {},
      now: fixedNow,
    });
    expect(result.status).toBe("valid");
    expect(result.usableForFreeRouting).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.checkedAt).toBe("2026-10-17T12:00:00.000Z");
    expect(capture[0].url).toBe("https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models");
    expect(capture[0].init.headers.Authorization).toBeUndefined();
  });

  it("marks a provider untested (not failed) when its key is missing", async () => {
    const fetchFn = vi.fn();
    const result = await checkFreeTierProvider(specById("mistral"), {
      fetchFn,
      env: {},
      now: fixedNow,
    });
    expect(result.status).toBe("untested");
    expect(result.usableForFreeRouting).toBe(false);
    expect(result.reason).toContain("MISTRAL_API_KEY");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("sends the key only as a header and marks HTTP 200 as valid", async () => {
    const capture = [];
    const result = await checkFreeTierProvider(specById("groq"), {
      fetchFn: okFetch(capture),
      env: { GROQ_API_KEY: FAKE_KEY },
      now: fixedNow,
    });
    expect(result.status).toBe("valid");
    expect(capture[0].init.headers.Authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(capture[0].url).not.toContain(FAKE_KEY);
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
  });

  it("uses the x-goog-api-key header for Gemini", async () => {
    const capture = [];
    await checkFreeTierProvider(specById("gemini"), {
      fetchFn: okFetch(capture),
      env: { GEMINI_API_KEY: FAKE_KEY },
      now: fixedNow,
    });
    expect(capture[0].init.headers["x-goog-api-key"]).toBe(FAKE_KEY);
    expect(capture[0].init.headers.Authorization).toBeUndefined();
  });

  it("marks an HTTP error as failed without leaking the key", async () => {
    const result = await checkFreeTierProvider(specById("openrouter-free"), {
      fetchFn: vi.fn(async () => ({ ok: false, status: 401 })),
      env: { OPENROUTER_API_KEY: FAKE_KEY },
      now: fixedNow,
    });
    expect(result.status).toBe("failed");
    expect(result.usableForFreeRouting).toBe(false);
    expect(result.reason).toContain("401");
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
  });

  it("requires the Cloudflare account id before probing", async () => {
    const fetchFn = vi.fn();
    const result = await checkFreeTierProvider(specById("cloudflare-workers-ai"), {
      fetchFn,
      env: { CLOUDFLARE_API_TOKEN: FAKE_KEY },
      now: fixedNow,
    });
    expect(result.status).toBe("untested");
    expect(result.reason).toContain("CLOUDFLARE_ACCOUNT_ID");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("classifies a timeout as failed", async () => {
    const hangingFetch = vi.fn(
      (url, init) =>
        new Promise((_, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        })
    );
    const result = await checkFreeTierProvider(specById("ovhcloud-ai-endpoints"), {
      fetchFn: hangingFetch,
      env: {},
      timeoutMs: 10,
      now: fixedNow,
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("timeout");
  });

  it("never copies a network error message (possible secret) into the reason", async () => {
    const result = await checkFreeTierProvider(specById("groq"), {
      fetchFn: vi.fn(async () => {
        throw new Error(`boom with ${FAKE_KEY} inside`);
      }),
      env: { GROQ_API_KEY: FAKE_KEY },
      now: fixedNow,
    });
    expect(result.status).toBe("failed");
    expect(result.reason).not.toContain(FAKE_KEY);
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
  });
});

describe("checkAllFreeTierProviders", () => {
  it("only marks valid providers as usable for free routing", async () => {
    const report = await checkAllFreeTierProviders({
      fetchFn: vi.fn(async (url) =>
        url.includes("groq") ? { ok: false, status: 500 } : { ok: true, status: 200 }
      ),
      env: { GROQ_API_KEY: FAKE_KEY },
      now: fixedNow,
    });
    // OVHcloud (keyless) valid, Groq failed, the other four untested.
    expect(report.summary).toEqual({
      total: 6,
      valid: 1,
      failed: 1,
      untested: 4,
      usableForFreeRouting: ["ovhcloud-ai-endpoints"],
    });
    expect(report.checkedAt).toBe("2026-10-17T12:00:00.000Z");
    expect(JSON.stringify(report)).not.toContain(FAKE_KEY);
  });

  it("supports the --only style filter", async () => {
    const report = await checkAllFreeTierProviders({
      fetchFn: okFetch(),
      env: {},
      only: ["ovhcloud-ai-endpoints"],
      now: fixedNow,
    });
    expect(report.providers.map((p) => p.id)).toEqual(["ovhcloud-ai-endpoints"]);
  });
});

describe("stored 9Router connections source", () => {
  const storedConn = (overrides = {}) => ({
    provider: "mistral",
    authType: "apikey",
    isActive: true,
    apiKey: FAKE_KEY,
    providerSpecificData: {},
    ...overrides,
  });

  it("uses a stored connection when the env key is absent", async () => {
    const capture = [];
    const result = await checkFreeTierProvider(specById("mistral"), {
      fetchFn: okFetch(capture),
      env: {},
      connections: [storedConn()],
      now: fixedNow,
    });
    expect(result.status).toBe("valid");
    expect(result.source).toBe("stored");
    expect(capture[0].init.headers.Authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
  });

  it("ignores inactive stored connections", async () => {
    const fetchFn = vi.fn();
    const result = await checkFreeTierProvider(specById("mistral"), {
      fetchFn,
      env: {},
      connections: [storedConn({ isActive: false })],
      now: fixedNow,
    });
    expect(result.status).toBe("untested");
    expect(result.source).toBe("none");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("ignores non-apikey and keyless stored connections", async () => {
    const candidates = buildStoredProviderCandidates([
      storedConn({ authType: "oauth", apiKey: null }),
      storedConn({ apiKey: "   " }),
      storedConn({ provider: "groq", apiKey: FAKE_KEY }),
    ]);
    expect(candidates.mistral).toBeUndefined();
    expect(candidates.groq).toHaveLength(1);
    expect(JSON.stringify(Object.keys(candidates))).not.toContain(FAKE_KEY);
  });

  it("prefers the env key over a stored connection", async () => {
    const capture = [];
    const result = await checkFreeTierProvider(specById("groq"), {
      fetchFn: okFetch(capture),
      env: { GROQ_API_KEY: "env-key-first" },
      connections: [storedConn({ provider: "groq" })],
      now: fixedNow,
    });
    expect(result.source).toBe("env");
    expect(capture[0].init.headers.Authorization).toBe("Bearer env-key-first");
  });

  it("tries the next stored connection when the first one fails", async () => {
    let call = 0;
    const result = await checkFreeTierProvider(specById("gemini"), {
      fetchFn: vi.fn(async () => (++call === 1 ? { ok: false, status: 401 } : { ok: true, status: 200 })),
      env: {},
      connections: [
        storedConn({ provider: "gemini", apiKey: "first-bad-key" }),
        storedConn({ provider: "gemini", apiKey: FAKE_KEY }),
      ],
      now: fixedNow,
    });
    expect(result.status).toBe("valid");
    expect(result.attempts).toBe(2);
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
    expect(JSON.stringify(result)).not.toContain("first-bad-key");
  });

  it("maps the custom OVHcloud node to a validated probe URL, never displayed", async () => {
    const capture = [];
    const result = await checkFreeTierProvider(specById("ovhcloud-ai-endpoints"), {
      fetchFn: okFetch(capture),
      env: {},
      connections: [
        storedConn({
          provider: "openai-compatible-chat-00000000-0000-0000-0000-000000000000",
          name: "OVHcloud 9router",
          providerSpecificData: {
            nodeName: "OVHcloud",
            baseUrl: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
          },
        }),
      ],
      now: fixedNow,
    });
    expect(result.status).toBe("valid");
    expect(result.source).toBe("stored");
    expect(capture[0].url).toBe("https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models");
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
  });

  it("rejects a stored OVHcloud probe URL that is not clean https", async () => {
    const candidates = buildStoredProviderCandidates([
      storedConn({
        provider: "openai-compatible-chat-00000000-0000-0000-0000-000000000000",
        providerSpecificData: {
          nodeName: "OVHcloud",
          baseUrl: "http://user:pass@example.invalid/v1",
        },
      }),
    ]);
    expect(candidates["ovhcloud-ai-endpoints"][0].probeUrl).toBeNull();
  });
});

