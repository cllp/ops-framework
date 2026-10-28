import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { OpsBottomNav } from "../components/OpsBottomNav.jsx";
import { TANGENTBORD_MINST_PX, arTextfalt, tangentbordUppe, viewportKrympt } from "../lib/tangentbord.js";

/**
 * Bottenraden göms medan tangentbordet är uppe (0.152.0, cllp/ops-framework#461, punkt 1).
 *
 * CP 2026-10-28: raden stod kvar mellan skrivfältet och tangentbordet på en iPhone. Villkoret är TVÅ saker: ett textfält har fokus OCH
 * `visualViewport` har krympt tydligt mot fönstret. jsdom kör ingen CSS och har inget `visualViewport`, så provet styr ett eget
 * (`EventTarget` med `height`, `scale` och `offsetTop`) och läser `data-tangentbord` och klassen `hidden` på raden. Vad som ritas, att raden
 * verkligen försvinner och att skrivfältet hamnar ovanför tangentbordet mäts i Chromium i `check-skalyta` avsnitt 47 (5).
 */

const NAV = [
  { href: "/", label: "Idag" },
  { href: "/kalender", label: "Kalender" },
  { href: "/hub", label: "Hub" },
];

const ursprung = Object.getOwnPropertyDescriptor(window, "visualViewport");
afterEach(() => {
  if (ursprung) Object.defineProperty(window, "visualViewport", ursprung);
  else delete (/** @type {any} */ (window)).visualViewport;
  document.body.innerHTML = "";
});

/** Ett `visualViewport` vi styr. Höjden börjar lika med fönstrets: inget tangentbord. */
function falskVv(extra = {}) {
  const vv = Object.assign(new EventTarget(), { height: window.innerHeight, scale: 1, offsetTop: 0 }, extra);
  Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
  return vv;
}

/** Krymper viewporten som ett tangentbord på `px` och säger till. */
async function tangentbord(vv, px) {
  await act(async () => {
    vv.height = window.innerHeight - px;
    vv.dispatchEvent(new Event("resize"));
  });
}

/** En tick: raden mäts om en tick efter `focusout`, så att den inte blinkar när man byter fält. */
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 5)); });

async function fokusera(el) {
  await act(async () => el.focus());
}
async function lamna(el) {
  await act(async () => el.blur());
  await tick();
}

function rita() {
  const ut = render(
    <>
      <OpsBottomNav nav={NAV} activeHref="/" primaryAction={{ label: "TALK", onClick: () => {} }} />
      <textarea aria-label="Skriv" />
      <input aria-label="Sök" type="search" />
      <button type="button">Knapp</button>
    </>,
  );
  const rad = () => screen.getByRole("navigation", { name: "Snabbnavigering", hidden: true });
  return { ...ut, rad, falt: screen.getByLabelText("Skriv"), sok: screen.getByLabelText("Sök"), knapp: screen.getByRole("button", { name: "Knapp" }) };
}

const gomd = (/** @type {HTMLElement} */ rad) => rad.getAttribute("data-tangentbord") === "uppe" && rad.classList.contains("hidden");

describe("bottenraden och tangentbordet", () => {
  it("⛔ ett textfält har fokus och viewporten har krympt: raden och mikrofonknappen göms", async () => {
    const vv = falskVv();
    const { rad, falt } = rita();
    expect(gomd(rad())).toBe(false);
    // Mikrofonknappen sitter i raden: göms raden göms den med.
    expect(rad().querySelector('button[aria-label="TALK"]')).not.toBeNull();
    await fokusera(falt);
    expect(gomd(rad())).toBe(false);
    await tangentbord(vv, 300);
    expect(gomd(rad())).toBe(true);
    expect(rad().contains(screen.getByRole("button", { name: "TALK", hidden: true }))).toBe(true);
    // Platsen raden reserverar nollas av tokens.css under det här attributet.
    expect(document.documentElement.hasAttribute("data-ops-tangentbord")).toBe(true);
  });

  it("⛔ en extern tangentbordsenhet: fokus i fältet utan att viewporten krymper gömmer ingenting", async () => {
    falskVv();
    const { rad, falt } = rita();
    await fokusera(falt);
    expect(gomd(rad())).toBe(false);
    expect(document.documentElement.hasAttribute("data-ops-tangentbord")).toBe(false);
  });

  it("⛔ en krympt viewport utan fält i fokus gömmer inte heller (verktygsfältet, en dialog, zoom)", async () => {
    const vv = falskVv();
    const { rad } = rita();
    await tangentbord(vv, 300);
    expect(gomd(rad())).toBe(false);
  });

  it("raden kommer tillbaka när fokus lämnar fältet", async () => {
    const vv = falskVv();
    const { rad, falt } = rita();
    await fokusera(falt);
    await tangentbord(vv, 300);
    expect(gomd(rad())).toBe(true);
    await lamna(falt);
    expect(gomd(rad())).toBe(false);
    expect(document.documentElement.hasAttribute("data-ops-tangentbord")).toBe(false);
  });

  it("raden kommer tillbaka när viewporten växer igen, också med fokus kvar", async () => {
    const vv = falskVv();
    const { rad, falt } = rita();
    await fokusera(falt);
    await tangentbord(vv, 300);
    expect(gomd(rad())).toBe(true);
    await tangentbord(vv, 0);
    expect(document.activeElement).toBe(falt);
    expect(gomd(rad())).toBe(false);
  });

  it("⛔ gränsen: 149 px är inget tangentbord, 150 är det", async () => {
    expect(TANGENTBORD_MINST_PX).toBe(150);
    const vv = falskVv();
    const { rad, falt } = rita();
    await fokusera(falt);
    await tangentbord(vv, TANGENTBORD_MINST_PX - 1);
    expect(gomd(rad())).toBe(false);
    await tangentbord(vv, TANGENTBORD_MINST_PX);
    expect(gomd(rad())).toBe(true);
  });

  it("⛔ en zoomad sida krymper viewporten utan att något tangentbord finns", async () => {
    const vv = falskVv({ scale: 2 });
    const { rad, falt } = rita();
    await fokusera(falt);
    await tangentbord(vv, 300);
    expect(gomd(rad())).toBe(false);
    vv.scale = 1;
    await tangentbord(vv, 300);
    expect(gomd(rad())).toBe(true);
  });

  it("⛔ byter man fält blinkar raden inte till: fokus ut ur det ena och in i det andra är ett och samma läge", async () => {
    const vv = falskVv();
    const { rad, falt, sok } = rita();
    await fokusera(falt);
    await tangentbord(vv, 300);
    const lagen = [];
    const iakttagare = new MutationObserver(() => lagen.push(gomd(rad())));
    iakttagare.observe(rad(), { attributes: true });
    await act(async () => sok.focus());
    await tick();
    iakttagare.disconnect();
    expect(document.activeElement).toBe(sok);
    expect(lagen).not.toContain(false);
    expect(gomd(rad())).toBe(true);
  });

  it("det som inte tar text lyfter inget tangentbord: knapp, kryssruta, skrivskyddat och avstängt fält", async () => {
    const vv = falskVv();
    const { rad, knapp } = rita();
    await tangentbord(vv, 300);
    await fokusera(knapp);
    expect(gomd(rad())).toBe(false);
    const rutor = [
      Object.assign(document.createElement("input"), { type: "checkbox" }),
      Object.assign(document.createElement("input"), { type: "text", readOnly: true }),
      Object.assign(document.createElement("textarea"), { readOnly: true }),
    ];
    for (const r of rutor) {
      document.body.appendChild(r);
      await fokusera(r);
      expect(arTextfalt(r), r.outerHTML).toBe(false);
      expect(gomd(rad()), r.outerHTML).toBe(false);
    }
  });

  it("contenteditable och textliknande input-typer räknas som textfält", async () => {
    const vv = falskVv();
    const { rad } = rita();
    const ce = document.createElement("div");
    ce.setAttribute("contenteditable", "true");
    ce.tabIndex = 0;
    document.body.appendChild(ce);
    expect(arTextfalt(ce)).toBe(true);
    for (const typ of ["text", "search", "email", "url", "tel", "password", "number"]) {
      expect(arTextfalt(Object.assign(document.createElement("input"), { type: typ })), typ).toBe(true);
    }
    await tangentbord(vv, 300);
    await fokusera(ce);
    expect(gomd(rad())).toBe(true);
  });

  it("ingen visualViewport (jsdom, gamla webbläsare): ingenting göms, ingenting kastar", async () => {
    delete (/** @type {any} */ (window)).visualViewport;
    const { rad, falt } = rita();
    await fokusera(falt);
    expect(viewportKrympt()).toBe(false);
    expect(tangentbordUppe()).toBe(false);
    expect(gomd(rad())).toBe(false);
  });

  it("⛔ EN uppsättning lyssnare oavsett hur många rader som frågar, och inga kvar när den sista gått", async () => {
    const vv = falskVv();
    const lagg = vi.spyOn(vv, "addEventListener");
    const ta = vi.spyOn(vv, "removeEventListener");
    const a = render(<OpsBottomNav nav={NAV} activeHref="/" />);
    const b = render(<OpsBottomNav nav={NAV} activeHref="/" />);
    expect(lagg.mock.calls.filter(([h]) => h === "resize")).toHaveLength(1);
    a.unmount();
    expect(ta).not.toHaveBeenCalled();
    b.unmount();
    expect(ta.mock.calls.filter(([h]) => h === "resize")).toHaveLength(1);
    expect(document.documentElement.hasAttribute("data-ops-tangentbord")).toBe(false);
  });

  it("en rad som avmonteras medan tangentbordet är uppe lämnar inget attribut kvar på sidan", async () => {
    const vv = falskVv();
    const { falt, unmount } = rita();
    await fokusera(falt);
    await tangentbord(vv, 300);
    expect(document.documentElement.hasAttribute("data-ops-tangentbord")).toBe(true);
    unmount();
    expect(document.documentElement.hasAttribute("data-ops-tangentbord")).toBe(false);
  });
});
