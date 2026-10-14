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
    expect(mitten().getAttribute("aria-label")).toBe("TALK, prata in");
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
});
