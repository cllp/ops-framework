// ⛔ TIDSSTÄMPEL PÅ ALLT SOM HAR HÄNT (0.194.0). CP 2026-11-06: "Alla uppdateringar av projektinformation i modulen projekt behöver
// datum/tidsstämpel. Även dokument finns bara datum på. Det räcker inte. Jag vill ha tidsstämpel på allt."
//
// Provet mäter formen exakt ("2026-11-06 13:42"), inte att den "innehåller 2026": det gamla provet för `formatDateTime` var grönt
// för varje form med årtalet i, också den som visade fel klockslag. Alla tider skrivs med `Date.UTC` så att provet säger samma sak
// oavsett vilken zon maskinen kör i (CI kör `TZ=UTC`, en Mac i Stockholm gör det inte).
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsKatalogInstallning } from "../components/OpsKatalogInstallning.jsx";
import { byggPost } from "../lib/bibliotek.js";
import { formatDateTime, MISSING, STANDARD_TIDSZON } from "../lib/format.js";
import { STANDARD_TIDSZON as KALENDERNS_TIDSZON } from "../lib/kalendrar.js";

describe("formatDateTime: ramverkets enda tidsstämpel", () => {
  it("ÅÅÅÅ-MM-DD och klockslaget i svensk tid, vintertid och sommartid", () => {
    expect(formatDateTime(Date.UTC(2026, 10, 6, 12, 42))).toBe("2026-11-06 13:42");
    expect(formatDateTime(Date.UTC(2026, 6, 1, 12, 42))).toBe("2026-07-01 14:42");
    expect(formatDateTime(new Date(Date.UTC(2026, 10, 6, 12, 42)))).toBe("2026-11-06 13:42");
    expect(formatDateTime("2026-11-06T12:42:00Z")).toBe("2026-11-06 13:42");
  });

  it("samma form på svenska och engelska, med kolon som chattens klockslag", () => {
    const t = Date.UTC(2026, 10, 6, 12, 42);
    expect(formatDateTime(t, { locale: "sv" })).toBe("2026-11-06 13:42");
    expect(formatDateTime(t, { locale: "sv-SE" })).toBe("2026-11-06 13:42");
    expect(formatDateTime(t, { locale: "en" })).toBe("2026-11-06 13:42");
    expect(formatDateTime(t, { locale: "en-GB" })).toBe("2026-11-06 13:42");
  });

  it("gränsen mot sommartid: klockan hoppar 02:00 till 03:00 i mars och 03:00 tillbaka till 02:00 i oktober", () => {
    // 29 mars 2026: 00:30 UTC är 01:30 (CET), 01:30 UTC är 03:30 (CEST). Ingen tid 02:xx finns den natten.
    expect(formatDateTime(Date.UTC(2026, 2, 29, 0, 30))).toBe("2026-03-29 01:30");
    expect(formatDateTime(Date.UTC(2026, 2, 29, 1, 30))).toBe("2026-03-29 03:30");
    // 25 oktober 2026: 02:30 finns två gånger, först i sommartid och en timme senare i vintertid.
    expect(formatDateTime(Date.UTC(2026, 9, 25, 0, 30))).toBe("2026-10-25 02:30");
    expect(formatDateTime(Date.UTC(2026, 9, 25, 1, 30))).toBe("2026-10-25 02:30");
    expect(formatDateTime(Date.UTC(2026, 9, 25, 2, 30))).toBe("2026-10-25 03:30");
  });

  it("midnatt är 00 och aldrig 24, och dagen följer svensk tid och inte UTC", () => {
    expect(formatDateTime(Date.UTC(2026, 10, 5, 23, 5))).toBe("2026-11-06 00:05");
  });

  it("en annan tidszon när appen ger en, och svensk tid som förval ur samma konstant som kalendern", () => {
    expect(formatDateTime(Date.UTC(2026, 10, 6, 12, 42), { tidszon: "America/New_York" })).toBe("2026-11-06 07:42");
    expect(formatDateTime(Date.UTC(2026, 10, 6, 12, 42), { tidszon: "UTC" })).toBe("2026-11-06 12:42");
    expect(STANDARD_TIDSZON).toBe("Europe/Stockholm");
    expect(KALENDERNS_TIDSZON).toBe(STANDARD_TIDSZON);
    expect(() => formatDateTime(Date.UTC(2026, 10, 6), { tidszon: "Mars/Olympus" })).toThrow(RangeError);
  });

  it("ett rent datum förblir ett datum, aldrig 00:00", () => {
    expect(formatDateTime("2026-11-06")).toBe("2026-11-06");
    expect(formatDateTime("2026-01-01")).toBe("2026-01-01");
  });

  it("en Firestore-Timestamp läses som sina millisekunder, och saknad tid blir MISSING och inte en nolla", () => {
    expect(formatDateTime({ toMillis: () => Date.UTC(2026, 10, 6, 12, 42) })).toBe("2026-11-06 13:42");
    for (const v of [null, undefined, "", "inte-en-tid", Number.NaN]) expect(formatDateTime(/** @type {any} */ (v))).toBe(MISSING);
  });
});

describe("Biblioteket visar tidsstämpeln", () => {
  const kim = { uid: "uid-kim", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
  const skapad = Date.UTC(2026, 10, 6, 12, 42);
  const andrad = Date.UTC(2026, 10, 7, 8, 10);
  const post = (/** @type {number} */ nar) => ({ ...byggPost({ groupId: "g", typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade.", skapadAv: kim, skapad, andrad: nar }), id: "a" });

  it("kortets metarad: ändringens tidsstämpel, inte bara datumet", () => {
    render(<OpsBibliotek poster={[post(andrad)]} jag={{ uid: "uid-kim", roll: "admin" }} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/" />);
    const rad = document.querySelector("[data-bibliotek-kort] [data-bibliotek-metarad]");
    expect(rad).not.toBeNull();
    expect(rad?.textContent).toContain("2026-11-07 09:10");
  });

  it("detaljen: vem och när den skrevs, och när den ändrades", () => {
    const p = post(andrad);
    render(<OpsBibliotek poster={[p]} vald={p} jag={{ uid: "uid-kim", roll: "admin" }} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/" />);
    expect(document.querySelector("[data-bibliotek-meta]")?.textContent).toBe("Skriven av Kim, 2026-11-06 13:42. Ändrad 2026-11-07 09:10.");
  });

  it("detaljen säger inte Ändrad när posten aldrig ändrats", () => {
    const p = post(skapad);
    render(<OpsBibliotek poster={[p]} vald={p} jag={{ uid: "uid-kim", roll: "admin" }} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/" />);
    expect(document.querySelector("[data-bibliotek-meta]")?.textContent).toBe("Skriven av Kim, 2026-11-06 13:42.");
  });
});

describe("Kategoriloggen visar svensk tid och inte UTC", () => {
  it("en ändring skriven 20:00 UTC i oktober står som 22:00", () => {
    render(
      <OpsKatalogInstallning
        kategorier={[{ id: "hog", namn: { sv: "Hög" }, farg: 1, ikon: "bell", fas: "aktiv", ordning: 0 }]}
        ikoner={["bell"]}
        onSpara={() => {}}
        onArkivera={() => {}}
        groupId="g"
        logg={[{ id: "hog", kategori: "hog", handelse: "tillagd", nar: "2026-10-06T20:00:00Z", efter: { namn: { sv: "Hög" } } }]}
      />,
    );
    const rad = [...document.querySelectorAll("li")].find((li) => li.textContent?.includes("Hög") && /\d{2}:\d{2}/.test(li.textContent ?? ""));
    expect(rad?.textContent).toContain("2026-10-06 22:00");
  });
});
