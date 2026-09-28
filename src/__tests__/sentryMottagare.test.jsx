import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * #159: sentryMottagare mot en ATTRAPP, aldrig mot riktiga Sentry.
 *
 * ⛔ `@sentry/browser` ÄR INTE INSTALLERAT I DET HÄR REPOT, MED FLIT (se
 * `src/sentry.js` filhuvud och `tsconfig.json`s exclude-kommentar): det är en
 * peerDependency, optional, som bara den app som väljer Sentry installerar.
 * `vi.mock` fångar importspecen innan Vitest/Vite försöker slå upp paketet på
 * disk, så provet kräver INTE att paketet finns.
 */

const init = vi.fn();
const captureException = vi.fn();
const setUser = vi.fn();

vi.mock("@sentry/browser", () => ({ init, captureException, setUser }));

describe("sentryMottagare", () => {
  beforeEach(() => {
    init.mockClear();
    captureException.mockClear();
    setUser.mockClear();
  });

  it("kräver dsn och miljo, och namnger sig", async () => {
    const { sentryMottagare } = await import("../sentry.js");
    expect(() => sentryMottagare(/** @type {any} */ (undefined))).toThrow(/sentryMottagare: dsn krävs/);
    expect(() => sentryMottagare(/** @type {any} */ ({ dsn: "https://x" }))).toThrow(/sentryMottagare: miljo krävs/);
  });

  it("⛔ #159: fanga kallar captureException med felet och sammanhanget", async () => {
    const { sentryMottagare } = await import("../sentry.js");
    const mottagare = sentryMottagare({ dsn: "https://x", miljo: "produktion", version: "0.26.0" });
    const fel = new Error("kaboom");
    mottagare.fanga(fel, { id: "AB12CD" });
    expect(init).toHaveBeenCalledWith({ dsn: "https://x", environment: "produktion", release: "0.26.0" });
    expect(captureException).toHaveBeenCalledWith(fel, { extra: { id: "AB12CD" } });
  });

  it("satt kallar setUser med uid och groupId, ALDRIG e-post", async () => {
    const { sentryMottagare } = await import("../sentry.js");
    const mottagare = sentryMottagare({ dsn: "https://x", miljo: "produktion" });
    mottagare.satt({ uid: "uid-1", groupId: "bolaget" });
    expect(setUser).toHaveBeenCalledWith({ id: "uid-1", groupId: "bolaget" });
  });

  it("satt(null) loggar ut användaren i Sentry", async () => {
    const { sentryMottagare } = await import("../sentry.js");
    const mottagare = sentryMottagare({ dsn: "https://x", miljo: "produktion" });
    mottagare.satt(null);
    expect(setUser).toHaveBeenCalledWith(null);
  });

  it("init körs bara EN gång, oavsett hur många fel/inloggningar som följer", async () => {
    const { sentryMottagare } = await import("../sentry.js");
    const mottagare = sentryMottagare({ dsn: "https://x", miljo: "produktion" });
    mottagare.fanga(new Error("a"));
    mottagare.satt({ uid: "uid-1" });
    mottagare.fanga(new Error("b"));
    expect(init).toHaveBeenCalledTimes(1);
  });
});
