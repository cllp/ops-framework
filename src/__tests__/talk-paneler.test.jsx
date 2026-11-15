import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useState } from "react";
import { OpsAppShell, useOppnaSkapa } from "../components/OpsAppShell.jsx";
import { OpsEventList } from "../components/OpsEventList.jsx";
import { OpsField, OpsTextarea } from "../components/OpsField.jsx";
import { PanelDialog } from "../components/PanelDialog.jsx";
import { arOvanforPanel, registreraPanel, skyddaOvanforPanel } from "../lib/panellager.js";

/*
 * TALK ovanpå panelerna (0.231.0, cllp/ops-framework#602).
 *
 * CP 2026-11-15: "TAlk finns ju inte när man skall skriva text i ärenden mm." Sedan 0.230.0 skriver TALK i fältet där markören står, men
 * panelerna täckte TALK-knappen: `OpsSkapaPanel` låg över bottenraden på telefonen, och `OpsRadPanel` var en modal Radix-dialog vars slöja,
 * fokusfälla och `aria-hidden` stängde ute både knappen och TALK:s yta. Skissen CP godkände ("Snyggt kör på skissen"): mikrofonen står kvar,
 * panelerna slutar där den börjar, och de andra flikarna är dämpade.
 *
 * ⛔ jsdom kör ingen CSS. Var panelen slutar, att knappen är det som träffas och skärmbilderna mäts i `check-skalyta` avsnitt 67. Här mäts det som
 * är DOM och händelser: `inert`, `aria-hidden`, att ett tryck inte stänger panelen, Radix fokusfälla och att talet går till fältet.
 * `tryck` gör det en webbläsare gör: pointerdown, fokus till knappen, klick.
 */

function falskInspelare() {
  return {
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

/** @param {string[]} meningar */
function falskIgenkanning(meningar) {
  const stoppa = vi.fn();
  for (const m of meningar) stoppa.mockResolvedValueOnce(m);
  stoppa.mockResolvedValue("");
  return { starta: vi.fn(), stoppa, kasta: vi.fn() };
}

const SAGT = "kolla kabeln innan torsdag";
const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const flush = () => act(async () => {});
/** Radix lägger sina lyssnare på dokumentet ett varv senare (`setTimeout(0)`). */
const varv = () => act(async () => { vi.advanceTimersByTime(20); });
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));
const bottenMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-knapp]"));
const talkYta = () => document.querySelector("[data-ops-talk]");
const dold = (/** @type {Element} */ el) => el.closest('[aria-hidden="true"]') !== null;
const inert = (/** @type {Element} */ el) => el.closest("[inert]") !== null;

/** @param {HTMLElement} knapp */
async function tryck(knapp) {
  fireEvent.pointerDown(knapp);
  knapp.focus();
  fireEvent.click(knapp);
  await flush();
}

function skapaTalk() {
  return { onTalk: vi.fn(async () => {}), onAgent: vi.fn(async () => {}), onMeddelande: vi.fn(), inspelare: falskInspelare(), igenkanning: falskIgenkanning([SAGT]) };
}

const KALLOR = {
  arende: {
    etikett: "Ärenden",
    atgarder: () => [{ id: "oppna", etikett: "Öppna ärendet", href: "/arenden/1" }],
    dela: () => ({ skal: "Ärenden delas inte härifrån." }),
  },
};
const RADER = [{ id: "arende:1", title: "Ljudkoll inför spelningen", when: "I dag", kind: "Ärende" }];

/** Ett fält i en panel, med det inskrivna i `window.__panelfalt`. */
function Falt() {
  const [v, setV] = useState("Mixern i rum B brummar");
  // @ts-ignore
  window.__panelfalt = v;
  return (
    <OpsField label="Beskrivning">
      <OpsTextarea value={v} onChange={setV} />
    </OpsField>
  );
}

/** Skalet med TALK och en vy. @param {{ talk: any, barn: import("react").ReactNode, skapa?: any }} p */
function Skal({ talk, barn, skapa }) {
  return (
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={talk} skapa={skapa}>
      {barn}
    </OpsAppShell>
  );
}

/** En modal panel (samma dialog som `OpsRadPanel`) med ett fält, öppen tills Tillbaka. */
function ModalMedFalt() {
  const [oppen, setOppen] = useState(true);
  return (
    <PanelDialog oppen={oppen} onStang={() => setOppen(false)} titel="Ljudkoll" markor={{ "data-testpanel": "" }}>
      <button type="button" onClick={() => setOppen(false)}>Tillbaka</button>
      <Falt />
    </PanelDialog>
  );
}

/** Formuläret i Nytt ärende: fältet ligger i skalets `OpsSkapaPanel`. @param {{ formId?: string }} p */
function Formular({ formId }) {
  return (
    <form id={formId}>
      <Falt />
    </form>
  );
}
function OppnaSkapa() {
  const oppna = useOppnaSkapa();
  useEffect(() => {
    oppna("handelse");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <p>Idag</p>;
}

const panelen = () => document.querySelector("[data-testpanel]");

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("panellagret", () => {
  it("ett tryck i det som bär attributet stänger ingen panel, ett tryck utanför gör det", () => {
    const ovanfor = document.createElement("div");
    ovanfor.setAttribute("data-ops-ovanfor-panel", "");
    const knapp = document.createElement("button");
    ovanfor.append(knapp);
    const annat = document.createElement("button");
    document.body.append(ovanfor, annat);
    expect(arOvanforPanel(knapp)).toBe(true);
    expect(arOvanforPanel(annat)).toBe(false);
    const h = (/** @type {Element} */ t) => ({ target: t, hindrad: false, preventDefault() { this.hindrad = true; } });
    const i = h(knapp);
    skyddaOvanforPanel(i);
    const u = h(annat);
    skyddaOvanforPanel(u);
    expect([i.hindrad, u.hindrad]).toEqual([true, false]);
    ovanfor.remove();
    annat.remove();
  });

  it("⛔ trycket avgörs när det kom: ett mål som lämnat sidan innan Radix frågar (knappen ritades om av klicket) stänger ändå inte panelen", () => {
    // Mätt i check-skalyta avsnitt 67 vid 390 px: Radix skjuter upp "tryck utanför" till klicket, och då har mikrofonens ikon bytts ut.
    const slapp = registreraPanel();
    try {
      const ovanfor = document.createElement("nav");
      ovanfor.setAttribute("data-ops-ovanfor-panel", "");
      const ikon = document.createElement("span");
      ovanfor.append(ikon);
      document.body.append(ovanfor);
      const tryck = new Event("pointerdown", { bubbles: true });
      ikon.dispatchEvent(tryck);
      ikon.remove();
      const h = { target: ikon, detail: { originalEvent: tryck }, hindrad: false, preventDefault() { this.hindrad = true; } };
      skyddaOvanforPanel(h);
      // Ett tryck utanför, också det med ett mål som lämnat sidan, stänger som förut.
      const annat = document.createElement("span");
      document.body.append(annat);
      const tryck2 = new Event("pointerdown", { bubbles: true });
      annat.dispatchEvent(tryck2);
      annat.remove();
      const u = { target: annat, detail: { originalEvent: tryck2 }, hindrad: false, preventDefault() { this.hindrad = true; } };
      skyddaOvanforPanel(u);
      expect([h.hindrad, u.hindrad]).toEqual([true, false]);
      ovanfor.remove();
    } finally {
      slapp();
    }
  });

  it("registret räknar paneler, och en nedräkning gäller en gång", () => {
    render(<Skal talk={skapaTalk()} barn={<p>Idag</p>} />);
    const oppen = () => document.querySelector("nav[data-ops-bottenrad]")?.hasAttribute("data-panel-oppen");
    /** @type {() => void} */
    let a = () => {};
    /** @type {() => void} */
    let b = () => {};
    try {
      act(() => {
        a = registreraPanel();
        b = registreraPanel();
      });
      expect(oppen()).toBe(true);
      act(() => {
        a();
        a();
      });
      // Den andra nedräkningen av `a` gäller inte: `b` är fortfarande öppen.
      expect(oppen()).toBe(true);
      act(() => b());
      expect(oppen()).toBe(false);
    } finally {
      // Registret är modulens: ett prov som faller får inte lämna en panel öppen åt nästa.
      a();
      b();
    }
  });

  it("skalet sätter märkena för huvudet och bottenraden på <html> och tar bort dem", () => {
    const { unmount } = render(<Skal talk={skapaTalk()} barn={<p>Idag</p>} />);
    expect(document.documentElement.hasAttribute("data-ops-med-huvud")).toBe(true);
    expect(document.documentElement.hasAttribute("data-ops-med-bottenrad")).toBe(true);
    unmount();
    expect(document.documentElement.hasAttribute("data-ops-med-huvud")).toBe(false);
    expect(document.documentElement.hasAttribute("data-ops-med-bottenrad")).toBe(false);
  });
});

describe("⛔ telefonen: medan en panel är öppen är flikarna dämpade och inert, och TALK är det inte", () => {
  it("Nytt ärende (`OpsSkapaPanel`): flikarna och Meny är inert, mikrofonen går att trycka på, och talet går till fältet där markören står", async () => {
    const talk = skapaTalk();
    render(<Skal talk={talk} skapa={{ lage: "g1", handelse: { form: Formular, katalog: null } }} barn={<OppnaSkapa />} />);
    await flush();
    expect(document.querySelector("[data-skapa-panel]")).not.toBeNull();
    const nav = /** @type {HTMLElement} */ (document.querySelector("nav[data-ops-bottenrad]"));
    const flikar = [...nav.querySelectorAll("a, button")].filter((k) => !k.hasAttribute("data-talk-knapp"));
    // Golv: Idag, Kalender, Hub och Meny.
    expect(flikar.length).toBeGreaterThanOrEqual(4);
    for (const f of flikar) expect(inert(f), `${f.textContent} ska vara inert`).toBe(true);
    expect(inert(bottenMikrofon())).toBe(false);
    expect(nav.querySelector("[data-panelkant]")).not.toBeNull();

    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Beskrivning"));
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    await tryck(bottenMikrofon());
    expect(document.querySelector("[data-talk-samtalet]")?.textContent).toContain("Till fältet Beskrivning");
    fireEvent.click(screen.getByRole("button", { name: /^Klar/ }));
    await flush();
    // @ts-ignore
    expect(window.__panelfalt).toBe(`Mixern i rum B brummar ${SAGT}`);
    expect(talk.onTalk).not.toHaveBeenCalled();
    expect(document.querySelector("[data-skapa-panel]")).not.toBeNull();
  });

  it("panelen stängd: inget är dämpat och ingen kant ritas (golvet: dämpningen hör till panelen, inte till raden)", async () => {
    render(<Skal talk={skapaTalk()} barn={<p>Idag</p>} />);
    await flush();
    const nav = /** @type {HTMLElement} */ (document.querySelector("nav[data-ops-bottenrad]"));
    expect(nav.querySelectorAll("[inert]").length).toBe(0);
    expect(nav.querySelector("[data-panelkant]")).toBeNull();
  });
});

describe("⛔ en modal panel (`OpsRadPanel`, `PanelDialog`): TALK ligger ovanför den", () => {
  it("ärendet i detalj: ett tryck på TALK-knappen i huvudet stänger inte panelen, knapparna är inte aria-hidden, och flikarna är inert", async () => {
    render(<Skal talk={skapaTalk()} barn={<OpsEventList events={RADER} radkallor={KALLOR} ariaLabel="Idag" />} />);
    fireEvent.click(screen.getByRole("button", { name: /Ljudkoll inför spelningen/ }));
    await varv();
    expect(document.querySelector("[data-radpanel]")).not.toBeNull();
    expect(dold(huvudMikrofon())).toBe(false);
    expect(dold(bottenMikrofon())).toBe(false);
    for (const f of [...document.querySelectorAll("nav[data-ops-bottenrad] a")]) expect(inert(f)).toBe(true);
    await tryck(huvudMikrofon());
    await varv();
    expect(document.querySelector("[data-radpanel]"), "panelen stängdes av trycket på TALK").not.toBeNull();
    const yta = /** @type {HTMLElement} */ (talkYta());
    expect(yta).not.toBeNull();
    expect(dold(yta)).toBe(false);
    // Utan fält: talet går till menyn som förut, inte någonstans av sig självt.
    expect(document.querySelector("[data-talk-samtalet]")).toBeNull();
  });

  it("TALK:s yta tar fokus och tangentbord ovanpå panelens fokusfälla", async () => {
    render(<Skal talk={skapaTalk()} barn={<ModalMedFalt />} />);
    await varv();
    // Något i panelen har haft fokus (fältet), så fokusfällan har något att dra tillbaka fokus till. Utan det mäter provet ingen fälla.
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Beskrivning"));
    act(() => ta.focus());
    expect(document.activeElement).toBe(ta);
    await tryck(huvudMikrofon());
    await varv();
    const klar = within(/** @type {HTMLElement} */ (talkYta())).getByRole("button", { name: /^Klar/ });
    act(() => klar.focus());
    await varv();
    expect(document.activeElement).toBe(klar);
    const annat = within(/** @type {HTMLElement} */ (talkYta())).getByRole("button", { name: "Något annat" });
    act(() => annat.focus());
    expect(document.activeElement).toBe(annat);
    // Golv: fokus mäts ovanpå en ÖPPEN panel. En panel som stängts av trycket hade gjort provet grönt utan fokusfälla.
    expect(panelen(), "panelen stängdes").not.toBeNull();
  });

  it("fältet i en modal panel: markören i fältet, TALK i huvudet, raden säger fältet och Klar skriver in det sagda där markören stod", async () => {
    render(<Skal talk={skapaTalk()} barn={<ModalMedFalt />} />);
    await varv();
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Beskrivning"));
    ta.focus();
    ta.setSelectionRange(6, 6);
    await tryck(huvudMikrofon());
    await varv();
    expect(panelen(), "panelen stängdes av trycket på TALK").not.toBeNull();
    expect(document.querySelector("[data-talk-samtalet]")?.textContent).toContain("Till fältet Beskrivning");
    const klar = within(/** @type {HTMLElement} */ (talkYta())).getByRole("button", { name: /^Klar/ });
    fireEvent.pointerDown(klar);
    fireEvent.click(klar);
    await flush();
    await varv();
    // @ts-ignore
    expect(window.__panelfalt).toBe(`Mixern ${SAGT} i rum B brummar`);
    expect(panelen(), "panelen stängdes av Klar").not.toBeNull();
    expect(talkYta()).toBeNull();
  });

  it("det som var förut står kvar: Escape stänger panelen, Tillbaka stänger den, och ett tryck på slöjan stänger den", async () => {
    render(<Skal talk={skapaTalk()} barn={<ModalMedFalt />} />);
    await varv();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await varv();
    expect(panelen()).toBeNull();
    cleanup();

    render(<Skal talk={skapaTalk()} barn={<ModalMedFalt />} />);
    await varv();
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    await varv();
    expect(panelen()).toBeNull();
    cleanup();

    render(<Skal talk={skapaTalk()} barn={<ModalMedFalt />} />);
    await varv();
    fireEvent.pointerDown(document.body);
    await varv();
    expect(panelen()).toBeNull();
  });
});
