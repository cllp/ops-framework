import { describe, it, expect } from "vitest";
import { rensaBrodsmula, rensaHandelse, sentryInitAlternativ, utanFraga } from "../lib/sentryRensning.js";

/**
 * Granskningen av lifehub.app PR 845: Sentry med SDK:ns förval hade skickat adresser med inloggningskoder och konsolrader.
 * Rött utan ändringen: `sentryRensning.js` fanns inte, och `Sentry.init` fick bara dsn, miljö och version.
 */
describe("vad Sentry får se", () => {
  it("en adress skickas utan fråga och ankare", () => {
    expect(utanFraga("https://my.life-hub.app/inloggning?lh_kod=hemlig#x")).toBe("https://my.life-hub.app/inloggning");
    expect(utanFraga("/grupp/a#b")).toBe("/grupp/a");
    expect(utanFraga("https://my.life-hub.app/")).toBe("https://my.life-hub.app/");
    expect(utanFraga(undefined)).toBe(undefined);
  });

  it("ett fel från en sida med en kod i adressen når inte Sentry med koden, och cookies, huvuden och frågesträng följer inte med", () => {
    const ut = rensaHandelse({
      message: "fel",
      request: { url: "https://my.life-hub.app/x?lh_kod=hemlig", query_string: "lh_kod=hemlig", cookies: { s: "1" }, headers: { Referer: "a?lh_kod=hemlig" } },
      breadcrumbs: [
        { category: "console", message: "sagd text: mitt personnummer" },
        { category: "navigation", data: { from: "/a?lh_kod=hemlig", to: "/b#t" } },
        { category: "fetch", data: { url: "https://api.example/x?token=hemlig", method: "GET" } },
      ],
    });
    expect(JSON.stringify(ut)).not.toMatch(/hemlig|personnummer/);
    expect(ut.request).toEqual({ url: "https://my.life-hub.app/x" });
    expect(ut.breadcrumbs).toEqual([
      { category: "navigation", data: { from: "/a", to: "/b" } },
      { category: "fetch", data: { url: "https://api.example/x", method: "GET" } },
    ]);
  });

  it("konsolbrödsmulor släpps aldrig, andra står kvar", () => {
    expect(rensaBrodsmula({ category: "console", message: "x" })).toBe(null);
    expect(rensaBrodsmula({ category: "ui.click", message: "button" })).toEqual({ category: "ui.click", message: "button" });
  });

  it("Sentry.init får rensningen och sendDefaultPii av, med instansen som miljö", () => {
    const a = sentryInitAlternativ({ dsn: "https://k@o.ingest.sentry.io/1", miljo: "my", version: "1.0.1" });
    expect(a).toMatchObject({ dsn: "https://k@o.ingest.sentry.io/1", environment: "my", release: "1.0.1", sendDefaultPii: false });
    expect(a.beforeSend).toBe(rensaHandelse);
    expect(a.beforeBreadcrumb).toBe(rensaBrodsmula);
  });
});
