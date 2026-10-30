import { createElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { LANGTRYCK_MS } from "../lib/apparark.js";
import { validateModuler } from "../lib/modul.js";
import { PLATSER, PLATSYTOR, SKAPA_PLATSER, synsPa, synsPaText, tillaggFor } from "../lib/tillagg.js";

/**
 * Platsen `skapa.rad` (0.155.0, cllp/lifehub.app#491 "Tillägg 5", CP 2026-10-29): en modul anmäler sina egna skapa-rader i manifestet, och skalet visar dem i plusmenyn och i långtrycket på mittknappen,
 * bara i en grupp där modulen är påslagen. "Nytt projekt" är det första fallet, men ramverket känner inte Projekt.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött mot 0.154.0 (platsen finns inte, `defineModule` avvisar manifestet och skalet ritar ingen rad), grönt med grenen.
 */

const ikon = (id = "p") => createElement("svg", { "data-ikon": id });
const nav = [{ href: "/", label: "Start" }];

/** @param {string} id @param {any[]} tillagg */
const MODUL = (id, tillagg) => ({ id, namn: { sv: id, en: id }, nav: [], routes: [], samlingar: [], kallor: {}, skapar: [], hubb: null, tillagg });
/** @param {Record<string, any>} [over] */
const RAD = (over = {}) => ({ plats: "skapa.rad", id: "nytt-projekt", etikett: { sv: "Nytt projekt", en: "New project" }, ikon: ikon(), onSkapa: () => {}, ...over });

describe("manifestet: platsen valideras vid uppstart", () => {
  it("platsen står bland ramverkets platser, och Syns på säger Plus för en modul som bara har den", () => {
    expect(SKAPA_PLATSER).toEqual(["skapa.rad"]);
    expect(PLATSER).toContain("skapa.rad");
    expect(PLATSYTOR.skapa).toEqual({ sv: "Plus", en: "Plus" });
    const [m] = validateModuler([MODUL("projekt", [RAD()])]);
    expect(synsPa(/** @type {any} */ (m))).toEqual({ egenYta: false, ytor: ["skapa"] });
    expect(synsPaText(synsPa(/** @type {any} */ (m)), { egenYta: "Egen yta", ingenting: "inget" }, "sv")).toBe("Plus");
    // Golv: de äldre platserna är kvar.
    expect(PLATSER).toContain("handelse.atgard");
    expect(PLATSER.length).toBeGreaterThanOrEqual(6);
  });

  it("godtar en rad och skriver ut den fryst, med ikonen och funktionen som de gavs, och en omvalidering går igenom", () => {
    const onSkapa = vi.fn();
    const i = ikon("mapp");
    const [m] = validateModuler([MODUL("projekt", [RAD({ onSkapa, ikon: i })])]);
    const t = /** @type {any} */ (m).tillagg[0];
    expect(t).toMatchObject({ plats: "skapa.rad", id: "nytt-projekt", etikett: { sv: "Nytt projekt", en: "New project" } });
    expect(t.onSkapa).toBe(onSkapa);
    expect(t.ikon).toBe(i);
    expect(t.komponent).toBeUndefined();
    expect(Object.isFrozen(t)).toBe(true);
    expect(() => validateModuler([m])).not.toThrow();
  });

  it("⛔ en rad utan ikon, med något som inte är ett element, eller utan onSkapa avvisas, med modulens namn och fältet i felet", () => {
    expect(() => validateModuler([MODUL("projekt", [RAD({ ikon: undefined })])])).toThrow(/modul "projekt": tillagg\[0\]\.ikon för "nytt-projekt" krävs på skapa\.rad/);
    for (const fel of ["FolderPlus", () => null, 5, {}]) {
      expect(() => validateModuler([MODUL("projekt", [RAD({ ikon: fel })])]), String(fel)).toThrow(/tillagg\[0\]\.ikon för "nytt-projekt" krävs på skapa\.rad och måste vara ett React-element/);
    }
    expect(() => validateModuler([MODUL("projekt", [RAD({ onSkapa: undefined })])])).toThrow(/modul "projekt": tillagg\[0\]\.onSkapa för "nytt-projekt" krävs på skapa\.rad och måste vara en funktion\./);
    expect(() => validateModuler([MODUL("projekt", [RAD({ onSkapa: "navigera" })])])).toThrow(/måste vara en funktion, inte string/);
  });

  it("⛔ en rad med komponent, spara, maxSekunder eller skapa avvisas: platsen tar emot ikon och onSkapa", () => {
    for (const falt of [{ komponent: () => null }, { spara: () => {} }, { maxSekunder: 5 }, { skapa: { fel: () => [] } }]) {
      expect(() => validateModuler([MODUL("projekt", [RAD(falt)])]), Object.keys(falt)[0]).toThrow(/hör inte hemma på skapa\.rad/);
    }
  });

  it("⛔ ikon och onSkapa hör bara hemma på skapa.rad", () => {
    const sektion = { plats: "handelse.sektion", id: "s", etikett: { sv: "S", en: "S" }, komponent: () => null };
    expect(() => validateModuler([MODUL("projekt", [{ ...sektion, ikon: ikon() }])])).toThrow(/tillagg\[0\]\.ikon för "s" hör bara hemma på platsen skapa\.rad/);
    expect(() => validateModuler([MODUL("projekt", [{ ...sektion, onSkapa: () => {} }])])).toThrow(/tillagg\[0\]\.onSkapa för "s" hör bara hemma på platsen skapa\.rad/);
    const mal = { plats: "inspelning.mal", id: "m", etikett: { sv: "M", en: "M" }, spara: () => {} };
    expect(() => validateModuler([MODUL("projekt", [{ ...mal, onSkapa: () => {} }])])).toThrow(/hör bara hemma på platsen skapa\.rad/);
  });

  it("⛔ etiketten kräver båda språken, och samma id två gånger avvisas, som på alla platser", () => {
    expect(() => validateModuler([MODUL("projekt", [RAD({ etikett: { sv: "Nytt projekt" } })])])).toThrow(/etikett för "nytt-projekt".*en/);
    expect(() => validateModuler([MODUL("projekt", [RAD(), RAD()])])).toThrow(/står två gånger/);
  });

  it("tillaggFor ger bara raderna från påslagna moduler, med modulens id stämplat av ramverket", () => {
    const moduler = validateModuler([MODUL("projekt", [RAD()]), MODUL("annan", [RAD({ id: "ny", etikett: { sv: "Ny annan", en: "New other" } })])]);
    expect(tillaggFor({ moduler, grupp: { moduler: ["projekt"] }, plats: "skapa.rad" }).map((t) => `${t.modulId}:${t.id}`)).toEqual(["projekt:nytt-projekt"]);
    expect(tillaggFor({ moduler, grupp: { moduler: ["projekt", "annan"] }, plats: "skapa.rad" }).map((t) => `${t.modulId}:${t.id}`)).toEqual(["projekt:nytt-projekt", "annan:ny"]);
    expect(tillaggFor({ moduler, grupp: { moduler: [] }, plats: "skapa.rad" })).toEqual([]);
  });
});

describe("plusmenyn: platsen skapa.rad", () => {
  const oppnaPlus = () => fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
  const skal = (moduler, aktivGrupp, extra = {}, skapa = {}) =>
    render(
      <OpsAppShell brand="Ops" nav={nav} activeHref="/" skapa={{ handelse: <p>formulär</p>, lage: "g", moduler, aktivGrupp, ...skapa }} {...extra}>
        <p>innehåll</p>
      </OpsAppShell>,
    );

  it("visar raden för en modul som är påslagen i gruppen, efter ramverkets rader, och inte för en avslagen modul", () => {
    const paslagen = vi.fn();
    const avslagen = vi.fn();
    const moduler = validateModuler([
      MODUL("projekt", [RAD({ onSkapa: paslagen, ikon: ikon("pa") })]),
      MODUL("annan", [RAD({ id: "ny", etikett: { sv: "Avslagen rad", en: "Off" }, onSkapa: avslagen })]),
    ]);
    skal(moduler, { id: "g", moduler: ["projekt"] }, {}, { grupp: () => <p>grupp</p> });
    oppnaPlus();
    expect(screen.getByRole("button", { name: "Nytt projekt" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Avslagen rad" })).toBeNull();
    // Ikonen är modulens eget element, och raden står efter Ny händelse och Ny grupp.
    const rad = screen.getByRole("button", { name: "Nytt projekt" });
    expect(rad.querySelector('[data-ikon="pa"]')).toBeTruthy();
    const knappar = screen.getAllByRole("button").map((b) => b.textContent?.trim());
    expect(knappar.indexOf("Nytt projekt")).toBeGreaterThan(knappar.indexOf("Ny händelse"));
    expect(knappar.indexOf("Nytt projekt")).toBeGreaterThan(knappar.indexOf("Ny grupp"));
    expect(avslagen).not.toHaveBeenCalled();
  });

  it("ett val stänger listan och anropar onSkapa med den aktiva gruppen, en gång", async () => {
    const onSkapa = vi.fn();
    const grupp = { id: "g", moduler: ["projekt"] };
    skal(validateModuler([MODUL("projekt", [RAD({ onSkapa })])]), grupp);
    oppnaPlus();
    fireEvent.click(screen.getByRole("button", { name: "Nytt projekt" }));
    await waitFor(() => expect(onSkapa).toHaveBeenCalledTimes(1));
    expect(onSkapa).toHaveBeenCalledWith({ grupp });
    // Listan är stängd: raden ritas inte längre.
    await waitFor(() => expect(screen.queryByRole("button", { name: "Nytt projekt" })).toBeNull());
  });

  it("etiketten följer språket", () => {
    skal(validateModuler([MODUL("projekt", [RAD()])]), { id: "g", moduler: ["projekt"] }, {}, { sprak: "en" });
    oppnaPlus();
    expect(screen.getByRole("button", { name: "New project" })).toBeTruthy();
  });

  it("⛔ en modul med bara en skapa-rad gör att plusset finns, och utan någon rad (och utan annat) finns det inte", () => {
    const moduler = validateModuler([MODUL("projekt", [RAD()])]);
    const a = render(
      <OpsAppShell brand="Ops" nav={nav} activeHref="/" skapa={{ lage: "g", moduler, aktivGrupp: { id: "g", moduler: ["projekt"] } }}>
        <p>x</p>
      </OpsAppShell>,
    );
    expect(screen.getByRole("button", { name: "Skapa" })).toBeTruthy();
    a.unmount();
    // Modulen är inte påslagen i gruppen och ingen annan rad finns: inget plus att öppna, som för alla andra tomma lägen.
    render(
      <OpsAppShell brand="Ops" nav={nav} activeHref="/" skapa={{ lage: "g", moduler, aktivGrupp: { id: "g", moduler: [] } }}>
        <p>x</p>
      </OpsAppShell>,
    );
    expect(screen.queryByRole("button", { name: "Skapa" })).toBeNull();
  });

  it("flera moduler ger flera rader i modulernas ordning, och utan skapa.moduler ritas inga", () => {
    const moduler = validateModuler([MODUL("projekt", [RAD()]), MODUL("bokning", [RAD({ id: "ny-bokning", etikett: { sv: "Ny bokning", en: "New booking" } })])]);
    const a = skal(moduler, { id: "g", moduler: ["projekt", "bokning"] });
    oppnaPlus();
    const knappar = screen.getAllByRole("button").map((b) => b.textContent?.trim());
    expect(knappar.indexOf("Nytt projekt")).toBeGreaterThan(-1);
    expect(knappar.indexOf("Ny bokning")).toBe(knappar.indexOf("Nytt projekt") + 1);
    a.unmount();
    render(
      <OpsAppShell brand="Ops" nav={nav} activeHref="/" skapa={{ handelse: <p>formulär</p>, lage: "g" }}>
        <p>x</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    expect(screen.queryByRole("button", { name: "Nytt projekt" })).toBeNull();
  });
});

describe("långtrycket på mittknappen med talk", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const inspelare = { starta: vi.fn(async () => {}), stoppa: vi.fn(async () => ({ blob: new Blob(["a"]), mimeType: "audio/webm", sekunder: 1 })), kasta: vi.fn(), niva: () => 0 };
  const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
  const plus = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-knapp]"));

  it("⛔ mittknappen kan hållas in när enda raden är en modulrad: ett tryck är TALK, ett långtryck öppnar listan med raden (lifehub.app#491)", async () => {
    const onSkapa = vi.fn();
    const moduler = validateModuler([MODUL("projekt", [RAD({ onSkapa })])]);
    render(
      <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={{ onTalk: vi.fn(), inspelare }} skapa={{ lage: "g", moduler, aktivGrupp: { id: "g", moduler: ["projekt"] } }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.pointerDown(plus(), { button: 0 });
    act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
    fireEvent.pointerUp(plus());
    fireEvent.click(plus());
    await act(async () => {});
    // Långtrycket spelade inte in.
    expect(inspelare.starta).not.toHaveBeenCalled();
    const ark = screen.getByRole("dialog", { name: "Skapa" });
    const knappar = Array.from(ark.querySelectorAll("button")).map((b) => b.textContent?.trim()).filter(Boolean);
    expect(knappar).toContain("Nytt projekt");
    expect(knappar).not.toContain("TALK, prata in");
    fireEvent.click(screen.getByRole("button", { name: "Nytt projekt" }));
    act(() => vi.advanceTimersByTime(10));
    expect(onSkapa).toHaveBeenCalledTimes(1);
  });

  it("⛔ utan en rad (modulen avslagen) går mittknappen inte att hålla in: långtrycket gör ingenting", async () => {
    const moduler = validateModuler([MODUL("projekt", [RAD()])]);
    render(
      <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={{ onTalk: vi.fn(), inspelare }} skapa={{ lage: "g", moduler, aktivGrupp: { id: "g", moduler: [] } }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.pointerDown(plus(), { button: 0 });
    act(() => vi.advanceTimersByTime(LANGTRYCK_MS * 2));
    fireEvent.pointerUp(plus());
    expect(screen.queryByRole("dialog", { name: "Skapa" })).toBeNull();
  });
});
