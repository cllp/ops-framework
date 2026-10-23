import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsIconLink } from "../components/OpsIconLink.jsx";
import { GENVAG_TIPS_NYCKEL } from "../components/OpsSkapaGenvag.jsx";
import { LANGTRYCK_MS } from "../lib/apparark.js";
import { idagI } from "../lib/kalendrar.js";
import { validateNav } from "../lib/nav.js";

/*
 * ⛔ 0.103.0. CP 2026-10-14, "kör": "Långpress på ikoner och TALK med Microfon-ikon direkt ... Att håller man inne knappen på
 * kalender kommer man direkt in i skapa ny händelse, default datum är idag (det skall alltid ställas in om det inte finns nåt
 * datum). Under appar, blir det 'Skapa app', under Ärenden blir det Skapa ärende. Grupp-ikonen i telefonen långpress blir skapa
 * grupp. Då skulle vi kunna göra +:et till en Mikrofon".
 *
 * Proven mäter beteendet: vad ett tryck och ett långtryck GÖR (en panel öppnas, en navigering sker, en inspelning startar), och
 * vilket datum formuläret faktiskt får. Ingen av dem letar efter ett namn i källan.
 */

/** Kalenderns "idag" är Stockholms (`idagI`). 21.30 UTC den 14:e är 23.30 i Stockholm, alltså fortfarande den 14:e. */
const NU = new Date("2026-10-14T21:30:00Z");

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };

/** Händelseformuläret visar dagen det fick, så att provet läser det personen ser. @param {{ datum?: string | null, formId?: string }} p */
function Handelseform({ datum, formId }) {
  return <form id={formId} data-handelse-datum={datum ?? ""} />;
}

function falskInspelare() {
  return {
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 1 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

/** @param {any} [extra] */
function Skal(extra = {}) {
  return (
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" {...extra}>
      <p>innehåll</p>
    </OpsAppShell>
  );
}

const bottenrad = () => /** @type {HTMLElement} */ (document.querySelector("nav[aria-label='Snabbnavigering']"));
const kalender = () => /** @type {HTMLElement} */ (bottenrad().querySelector("a[href='/kalender']"));
const mitten = () => /** @type {HTMLElement} */ (bottenrad().querySelector("[data-talk-knapp], button[aria-label='Skapa']"));
const flush = () => act(async () => {});

/** Ett långtryck med fingret, släppet och klicket webbläsaren skickar efteråt. @param {HTMLElement} el */
async function hallIn(el) {
  fireEvent.pointerDown(el, { button: 0 });
  act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
  fireEvent.pointerUp(el);
  fireEvent.click(el);
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers({ now: NU });
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("mittknappen", () => {
  it("⛔ med talk är den en mikrofon, och ett vanligt tryck startar TALK", async () => {
    const insp = falskInspelare();
    render(Skal({ talk: { onTalk: vi.fn(), inspelare: insp }, skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
    expect(mitten().getAttribute("aria-label")).toBe("TALK, prata in. Håll inne för att skapa");
    fireEvent.click(mitten());
    await flush();
    expect(insp.starta).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "TALK" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Skapa" })).toBeNull();
  });

  it("⛔ utan talk är den plusset som förut: ett tryck öppnar skapa-listan", async () => {
    render(Skal({ skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
    expect(mitten().getAttribute("aria-label")).toBe("Skapa");
    expect(mitten().hasAttribute("data-talk-knapp")).toBe(false);
    fireEvent.click(mitten());
    await flush();
    expect(screen.getByRole("dialog", { name: "Skapa" }).textContent).toContain("Ny händelse");
  });
});

/*
 * ⛔ #382. CP 2026-10-14: "Undra om man i den ikonen kan ha en stor mikrofon och liksom lite bakomliggande ett plus som indikerar
 * det." ⛔ ÄNDRAT 0.104.0, CP 2026-10-14: "Sak bara vi måste ta bort plusset till plus-knappen. Den ser bara skräpig ut." Plusset är
 * borta, och namnet är det som säger att långtrycket finns. Det gäller fortfarande bara när ett långtryck faktiskt öppnar skapa.
 */
describe("mikrofonen utan plus, och namnet som säger håll inne", () => {
  const marke = () => mitten().querySelector("[data-skapa-marke]");

  it("⛔ med talk och skapa bakom ritas bara mikrofonen, namnet säger håll inne, och långtrycket öppnar skapa", async () => {
    render(Skal({ talk: { onTalk: vi.fn(), inspelare: falskInspelare() }, skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
    expect(marke()).toBeNull();
    expect(mitten().querySelectorAll("svg").length).toBe(1);
    expect(mitten().querySelector("[data-skapa-ikon] svg")).not.toBeNull();
    expect(mitten().getAttribute("aria-label")).toContain("Håll inne för att skapa");
    expect(mitten().getAttribute("aria-haspopup")).toBe("dialog");
    expect(mitten().getAttribute("aria-keyshortcuts")).toBe("Shift+F10");
    await hallIn(mitten());
    expect(screen.getByRole("dialog", { name: "Skapa" }).textContent).toContain("Ny händelse");
  });

  it("⛔ på engelska säger namnet hold to create", () => {
    render(Skal({ sprak: "en", talk: { onTalk: vi.fn(), inspelare: falskInspelare() }, skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
    // Bottenraden heter "Quick navigation" på engelska, så knappen hittas på sitt attribut.
    const knapp = /** @type {HTMLElement} */ (document.querySelector("nav[data-ops-bottenrad] [data-talk-knapp]"));
    // ⛔ Granskningen av PR 383, BÖR 2: HELA namnet på engelska. "TALK, prata in. Hold to create" var halvt svenskt.
    expect(knapp.getAttribute("aria-label")).toBe("TALK, speak. Hold to create");
    // Huvudets mikrofon har samma namn utan andra halvan, ur samma tabell.
    const huvud = /** @type {HTMLElement} */ (document.querySelector("header [data-talk-huvud]"));
    expect(huvud.getAttribute("aria-label")).toBe("TALK, speak");
  });

  it("⛔ under inspelning går mittknappen inte att hålla in, och namnet lovar inget långtryck (granskningen av PR 383, KAN 8)", async () => {
    render(Skal({ talk: { onTalk: vi.fn(), inspelare: falskInspelare() }, skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
    fireEvent.click(mitten());
    await flush();
    expect(mitten().getAttribute("data-talk-knapp")).toBe("lyssnar");
    expect(mitten().getAttribute("aria-label")).toBe("TALK, lyssnar");
    expect(marke()).toBeNull();
    expect(mitten().hasAttribute("aria-keyshortcuts")).toBe(false);
    // Varken fingret eller tangentbordet öppnar skapa-listan medan TALK lyssnar.
    fireEvent.pointerDown(mitten(), { button: 0 });
    act(() => vi.advanceTimersByTime(LANGTRYCK_MS));
    fireEvent.pointerUp(mitten());
    await flush();
    fireEvent.keyDown(mitten(), { key: "F10", shiftKey: true });
    await flush();
    expect(screen.queryByRole("dialog", { name: "Skapa" })).toBeNull();
  });

  it("⛔ utan talk ritas inget plusmärke: knappen är själv plusset, och namnet är Skapa", () => {
    render(Skal({ skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
    expect(marke()).toBeNull();
    expect(mitten().getAttribute("aria-label")).toBe("Skapa");
  });

  it("⛔ med talk men utan något att skapa ritas inget plus, och namnet lovar inget långtryck", () => {
    render(Skal({ talk: { onTalk: vi.fn(), inspelare: falskInspelare() } }));
    expect(marke()).toBeNull();
    expect(mitten().getAttribute("aria-label")).toBe("TALK, prata in");
  });
});

/*
 * ⛔ GRANSKNINGEN AV PR 383, MÅSTE 1. Före 0.103.0 öppnade Enter på plusset skapa-listan. Med mikrofonen startar Enter TALK, och
 * listan nåddes bara med ett långtryck. Under 768 px (också när en dator zoomar 200 %) fanns då ingen väg dit utan pekare.
 * Tangenten ContextMenu och Shift+F10 är kontextmenyns tangenter, och de öppnar det långtrycket öppnar.
 */
describe("tangentbordet når det långtrycket når", () => {
  /** @param {HTMLElement} el @param {Record<string, any>} tangent */
  const tryck = async (el, tangent) => {
    fireEvent.keyDown(el, tangent);
    await flush();
  };

  for (const [namn, tangent] of /** @type {const} */ ([["Shift+F10", { key: "F10", shiftKey: true }], ["ContextMenu", { key: "ContextMenu" }]])) {
    it(`⛔ ${namn} på mikrofonen öppnar skapa-listan och startar inte TALK`, async () => {
      const insp = falskInspelare();
      render(Skal({ talk: { onTalk: vi.fn(), inspelare: insp }, skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
      await tryck(mitten(), tangent);
      expect(screen.getByRole("dialog", { name: "Skapa" }).textContent).toContain("Ny händelse");
      expect(insp.starta).not.toHaveBeenCalled();
    });

    it(`⛔ ${namn} på Kalender öppnar Ny händelse och navigerar inte`, async () => {
      const onNavigate = vi.fn();
      render(Skal({ onNavigate, skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
      await tryck(kalender(), tangent);
      expect(screen.getByRole("region", { name: "Ny händelse" })).toBeTruthy();
      expect(onNavigate).not.toHaveBeenCalled();
    });
  }

  it("⛔ mikrofonen säger att den har en lista bakom sig och vilken tangent som öppnar den", () => {
    render(Skal({ talk: { onTalk: vi.fn(), inspelare: falskInspelare() }, skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
    expect(mitten().getAttribute("aria-haspopup")).toBe("dialog");
    expect(mitten().getAttribute("aria-keyshortcuts")).toBe("Shift+F10");
    expect(kalender().getAttribute("aria-keyshortcuts")).toBe("Shift+F10");
  });

  it("⛔ kontextmenyn som webbläsaren skickar efter tangenten stoppas, så att dess egen meny inte läggs ovanpå", async () => {
    render(Skal({ talk: { onTalk: vi.fn(), inspelare: falskInspelare() }, skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
    const knapp = mitten();
    await tryck(knapp, { key: "ContextMenu" });
    // `fireEvent` svarar falskt när händelsen stoppades (`preventDefault`).
    expect(fireEvent.contextMenu(knapp)).toBe(false);
  });

  it("⛔ utan något bakom finns ingen tangent: attributen saknas och Shift+F10 öppnar inget", async () => {
    const onNavigate = vi.fn();
    render(Skal({ onNavigate, talk: { onTalk: vi.fn(), inspelare: falskInspelare() }, skapa: { lage: "g1", arende: () => <form /> } }));
    // Kalenderns nyckel "handelse" har ingen mottagare här.
    expect(kalender().hasAttribute("aria-keyshortcuts")).toBe(false);
    await tryck(kalender(), { key: "F10", shiftKey: true });
    expect(screen.queryByRole("region", { name: "Ny händelse" })).toBeNull();
    cleanup();
    render(Skal({ talk: { onTalk: vi.fn(), inspelare: falskInspelare() } }));
    expect(mitten().hasAttribute("aria-haspopup")).toBe(false);
    expect(mitten().hasAttribute("aria-keyshortcuts")).toBe(false);
    await tryck(mitten(), { key: "F10", shiftKey: true });
    expect(screen.queryByRole("dialog", { name: "Skapa" })).toBeNull();
  });

  it("F10 utan Shift och andra tangenter gör ingenting", async () => {
    const insp = falskInspelare();
    render(Skal({ talk: { onTalk: vi.fn(), inspelare: insp }, skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
    await tryck(mitten(), { key: "F10" });
    await tryck(mitten(), { key: "a", shiftKey: true });
    expect(screen.queryByRole("dialog", { name: "Skapa" })).toBeNull();
    expect(insp.starta).not.toHaveBeenCalled();
  });
});

describe("långtryck på ikonerna", () => {
  it("⛔ långtryck på Kalender öppnar Ny händelse med dagens datum, och navigerar inte", async () => {
    const onNavigate = vi.fn();
    render(Skal({ onNavigate, skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
    await hallIn(kalender());
    expect(screen.getByRole("region", { name: "Ny händelse" })).toBeTruthy();
    const form = /** @type {HTMLElement} */ (document.querySelector("form[data-handelse-datum]"));
    expect(form.getAttribute("data-handelse-datum")).toBe("2026-10-14");
    expect(form.getAttribute("data-handelse-datum")).toBe(idagI(undefined, NU));
    // Klicket från samma tryck gick inte vidare till länken.
    expect(onNavigate).not.toHaveBeenCalled();
    // Dagen står inte i adressen: en omladdning i morgon ska ge morgondagen.
    expect(new URL(window.location.href).searchParams.get("datum")).toBeNull();
  });

  it("⛔ ett vanligt tryck på Kalender navigerar som förut, och öppnar inget", async () => {
    const onNavigate = vi.fn((/** @type {string} */ _h, /** @type {any} */ e) => e.preventDefault());
    render(Skal({ onNavigate, skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
    fireEvent.click(kalender());
    await flush();
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0]).toBe("/kalender");
    expect(screen.queryByRole("region", { name: "Ny händelse" })).toBeNull();
  });

  it("⛔ utan mottagare finns ingen genväg: inget öppnas, länken navigerar, och ikonen ser inte ut att gå att hålla in", async () => {
    const onNavigate = vi.fn((/** @type {string} */ _h, /** @type {any} */ e) => e.preventDefault());
    // `skapa` utan händelse: Kalenderns nyckel "handelse" har ingen mottagare.
    render(Skal({ onNavigate, skapa: { lage: "g1", arende: () => <form /> } }));
    expect(kalender().hasAttribute("data-skapa-genvag")).toBe(false);
    expect(kalender().className).not.toContain("[-webkit-touch-callout:none]");
    await hallIn(kalender());
    expect(screen.queryByRole("region", { name: "Ny händelse" })).toBeNull();
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("Inkorgens ikon med skapa=\"arende\" öppnar Nytt ärende, och gruppikonen Ny grupp", async () => {
    const onNavigate = vi.fn();
    render(
      Skal({
        onNavigate,
        actions: <OpsIconLink href="/inkorg" icon={<span />} label="Inkorg" skapa="arende" onNavigate={onNavigate} />,
        grupper: { lista: [{ id: "g1", namn: "CPS AB", roll: "agare" }], aktiv: "g1", onValj: () => {} },
        skapa: { lage: "g1", arende: ({ formId }) => <form id={formId} />, grupp: ({ formId }) => <form id={formId} /> },
      }),
    );
    const inkorg = /** @type {HTMLElement} */ (document.querySelector("header a[aria-label='Inkorg']"));
    expect(inkorg.getAttribute("data-skapa-genvag")).toBe("arende");
    await hallIn(inkorg);
    expect(screen.getByRole("region", { name: "Nytt ärende" })).toBeTruthy();
    expect(onNavigate).not.toHaveBeenCalled();
    cleanup();

    render(
      Skal({
        grupper: { lista: [{ id: "g1", namn: "CPS AB", roll: "agare" }], aktiv: "g1", onValj: () => {} },
        skapa: { lage: "g1", grupp: ({ formId }) => <form id={formId} /> },
      }),
    );
    const vaxlare = /** @type {HTMLElement} */ (document.querySelector("[data-skapa-genvag='grupp'] button"));
    await hallIn(vaxlare);
    expect(screen.getByRole("region", { name: "Ny grupp" })).toBeTruthy();
    // Klicket från samma tryck öppnade inte växlarens ark ovanpå.
    expect(screen.queryByRole("dialog", { name: "Byt grupp" })).toBeNull();
  });

  it("⛔ en nyckel med fel form kastar, och ett barn får ingen genväg", () => {
    expect(() => validateNav([{ href: "/", label: "A", skapa: "" }], "Prov")).toThrow(/skapa på "A"/);
    expect(() => validateNav([{ href: "/", label: "A", skapa: "Ny Händelse" }], "Prov")).toThrow(/skapa på "A"/);
    expect(() => validateNav([{ href: "/", label: "A", skapa: "talk" }], "Prov")).toThrow(/mittknappen/);
    expect(() => validateNav([{ href: "/", label: "A", children: [{ href: "/b", label: "B", skapa: "arende" }] }], "Prov")).toThrow(/barnet "B"/);
    expect(() => validateNav([{ href: "/", label: "A", skapa: "arende" }, { href: "/b", label: "B", skapa: null }], "Prov")).not.toThrow();
  });
});

describe("tipsraden", () => {
  it("⛔ visas första gången en ikon med genväg trycks, och sedan aldrig igen i samma webbläsare", async () => {
    const onNavigate = vi.fn((/** @type {string} */ _h, /** @type {any} */ e) => e.preventDefault());
    const skapa = { lage: "g1", handelse: { form: Handelseform, katalog: null } };
    render(Skal({ onNavigate, skapa }));
    expect(document.querySelector("[data-skapa-genvag-tips]")).toBeNull();
    fireEvent.click(kalender());
    await flush();
    const tips = /** @type {HTMLElement} */ (document.querySelector("[data-skapa-genvag-tips]"));
    expect(tips.getAttribute("role")).toBe("status");
    expect(tips.textContent).toContain("håll in Kalender så öppnas Ny händelse");
    expect(window.localStorage.getItem(GENVAG_TIPS_NYCKEL)).toBe("1");
    cleanup();

    render(Skal({ onNavigate, skapa }));
    fireEvent.click(kalender());
    await flush();
    expect(document.querySelector("[data-skapa-genvag-tips]")).toBeNull();
  });

  it("⛔ står på accentytan med primärknappens text, och en ring skiljer den från sidan (CP 2026-10-23: man ser knappt rutan)", async () => {
    const onNavigate = vi.fn((/** @type {string} */ _h, /** @type {any} */ e) => e.preventDefault());
    render(Skal({ onNavigate, skapa: { lage: "g1", handelse: { form: Handelseform, katalog: null } } }));
    fireEvent.click(kalender());
    await flush();
    const tips = /** @type {HTMLElement} */ (document.querySelector("[data-skapa-genvag-tips]"));
    const klasser = tips.className.split(/\s+/);
    expect(klasser).toEqual(expect.arrayContaining(["bg-accent", "text-accent-contrast", "ring-2", "ring-surface", "shadow-lg"]));
    expect(klasser).not.toContain("bg-elevated");
    const kryss = /** @type {HTMLElement} */ (tips.querySelector("button"));
    expect(kryss.className.split(/\s+/)).toContain("text-accent-contrast");
  });
});
