import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import * as tillaggApi from "../lib/tillagg.js";
import { validateModuler } from "../lib/modul.js";
import { hubbForGrupp, valbaraModuler } from "../lib/hubb.js";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsGruppFormular } from "../components/OpsGruppFormular.jsx";

/**
 * Tillägg: en app pluggar in i en plats ramverkets yta erbjuder (0.60.0, #251, beslut 0003).
 *
 * ⛔ Händelsen: CP 2026-10-05, "Om jag skulle vilja i en grupp addera specifik funktionalitet för händelser [...] Var drar vi gränsen?".
 * Svaret är att en app aldrig ändrar en ramverksyta, den pluggar bara in där ytan lämnat en plats. Proven mäter båda halvorna: att en
 * modul som pekar på en plats som inte finns avvisas vid uppstart, och att ytan bara ritar tillägg från moduler som är påslagna i gruppen.
 *
 * ⛔ jsdom kör ingen CSS, så hur sektionen och raden SER UT mäts i webbläsaren (check-skalyta, scenen `tillagg`).
 */

const HANDELSE_PLATSER = /** @type {any} */ (tillaggApi).HANDELSE_PLATSER;

/** @param {string} id @param {any[]} tillagg @param {Record<string, any>} [extra] */
const MODUL = (id, tillagg, extra = {}) => ({
  id,
  namn: { sv: id === "omrostning" ? "Datumomröstning" : id, en: id },
  nav: [],
  routes: [],
  samlingar: [],
  kallor: {},
  skapar: [],
  hubb: null,
  tillagg,
  ...extra,
});

/** @param {Record<string, any>} [over] */
const TILLAGG = (over = {}) => ({
  plats: "handelse.sektion",
  id: "rostning",
  etikett: { sv: "Omröstning", en: "Poll" },
  komponent: () => null,
  ...over,
});

describe("manifestets tillagg valideras vid uppstart", () => {
  it("platserna är ramverkets och exporteras", () => {
    expect(HANDELSE_PLATSER).toEqual(["handelse.sektion", "handelse.atgard"]);
  });

  it("godtar ett giltigt tillägg och skriver ut det fryst", () => {
    const [m] = validateModuler([MODUL("omrostning", [TILLAGG()])]);
    expect(/** @type {any} */ (m).tillagg).toHaveLength(1);
    expect(/** @type {any} */ (m).tillagg[0]).toMatchObject({ plats: "handelse.sektion", id: "rostning", etikett: { sv: "Omröstning", en: "Poll" } });
    expect(Object.isFrozen(/** @type {any} */ (m).tillagg)).toBe(true);
  });

  it("⛔ en okänd plats avvisas, med modulens namn och fältet i felet", () => {
    expect(() => validateModuler([MODUL("omrostning", [TILLAGG({ plats: "handelse.lage" })])])).toThrow(/modul "omrostning": tillagg\[0\]\.plats "handelse\.lage" finns inte/);
  });

  it("⛔ en etikett utan engelska avvisas", () => {
    expect(() => validateModuler([MODUL("omrostning", [TILLAGG({ etikett: { sv: "Omröstning" } })])])).toThrow(/modul "omrostning": tillagg\[0\]\.etikett för "rostning".*en/);
  });

  it("⛔ en etikett utan svenska avvisas", () => {
    expect(() => validateModuler([MODUL("omrostning", [TILLAGG({ etikett: { en: "Poll" } })])])).toThrow(/modul "omrostning": tillagg\[0\]\.etikett för "rostning"/);
  });

  it("⛔ samma id två gånger i samma modul avvisas", () => {
    expect(() => validateModuler([MODUL("omrostning", [TILLAGG(), TILLAGG({ plats: "handelse.atgard" })])])).toThrow(/modul "omrostning": tillagg\[1\]\.id "rostning" står två gånger/);
  });

  it("⛔ ett tillägg utan komponent avvisas", () => {
    expect(() => validateModuler([MODUL("omrostning", [TILLAGG({ komponent: undefined })])])).toThrow(/modul "omrostning": tillagg\[0\]\.komponent för "rostning" krävs/);
  });

  it("⛔ okända fält i ett tillägg avvisas", () => {
    expect(() => validateModuler([MODUL("omrostning", [TILLAGG({ props: {} })])])).toThrow(/modul "omrostning": tillagg\[0\].*props/);
  });
});

const HANDELSE = { id: "h1", titel: "Rep", datum: "2026-10-12" };

describe("OpsHandelsePanel: platsen handelse.sektion", () => {
  it("ritar en påslagen moduls sektion med etiketten som rubrik, och inte en avslagen moduls", () => {
    const avslagen = vi.fn(() => <p>avslagen syns</p>);
    const moduler = validateModuler([
      MODUL("omrostning", [TILLAGG({ komponent: () => <p>röstningen syns</p> })]),
      MODUL("annan", [TILLAGG({ id: "annat", etikett: { sv: "Annat", en: "Other" }, komponent: avslagen })]),
    ]);
    render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} moduler={moduler} grupp={{ id: "g", moduler: ["omrostning"] }} />);
    const sektion = screen.getByRole("region", { name: "Omröstning" });
    expect(within(sektion).getByText("röstningen syns")).toBeTruthy();
    expect(screen.queryByText("avslagen syns")).toBeNull();
    expect(screen.queryByRole("region", { name: "Annat" })).toBeNull();
    expect(avslagen).not.toHaveBeenCalled();
  });

  it("⛔ komponenten får { handelse, grupp } och inget annat", () => {
    const komponent = vi.fn(() => null);
    const grupp = { id: "g", moduler: ["omrostning"] };
    const moduler = validateModuler([MODUL("omrostning", [TILLAGG({ komponent })])]);
    render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} moduler={moduler} grupp={grupp} />);
    expect(komponent).toHaveBeenCalled();
    const props = /** @type {any} */ (komponent.mock.calls[0])[0];
    expect(Object.keys(props).sort()).toEqual(["grupp", "handelse"]);
    expect(props.handelse).toBe(HANDELSE);
    expect(props.grupp).toBe(grupp);
  });

  it("sektionen står efter informationsrutan", () => {
    const moduler = validateModuler([MODUL("omrostning", [TILLAGG({ komponent: () => <p>röstningen syns</p> })])]);
    const { container } = render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} moduler={moduler} grupp={{ id: "g", moduler: ["omrostning"] }} />);
    const info = /** @type {Element} */ (container.querySelector("[data-handelseinfo]"));
    const sektion = /** @type {Element} */ (container.querySelector('[data-tillagg="omrostning:rostning"]'));
    expect(sektion).toBeTruthy();
    expect(info.compareDocumentPosition(sektion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("en åtgärd ritas inte i panelen: platsen avgör var ett tillägg syns", () => {
    const moduler = validateModuler([MODUL("omrostning", [TILLAGG({ plats: "handelse.atgard", komponent: () => <p>åtgärden</p> })])]);
    render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} moduler={moduler} grupp={{ id: "g", moduler: ["omrostning"] }} />);
    expect(screen.queryByText("åtgärden")).toBeNull();
  });
});

describe("plusmenyn: platsen handelse.atgard", () => {
  const nav = [{ href: "/", label: "Start" }];

  it("visar en påslagen moduls åtgärd i händelsedelen, och inte en avslagen moduls", () => {
    const komponent = vi.fn(() => <button type="button">Ny datumomröstning</button>);
    const avslagen = vi.fn(() => <button type="button">Avslagen</button>);
    const grupp = { id: "bolaget", moduler: ["omrostning"] };
    const moduler = validateModuler([
      MODUL("omrostning", [TILLAGG({ plats: "handelse.atgard", id: "ny", etikett: { sv: "Ny datumomröstning", en: "New date poll" }, komponent })]),
      MODUL("annan", [TILLAGG({ plats: "handelse.atgard", id: "ny", etikett: { sv: "Avslagen", en: "Off" }, komponent: avslagen })]),
    ]);
    render(
      <OpsAppShell brand="Ops" nav={nav} activeHref="/" skapa={{ handelse: <p>formulär</p>, lage: "bolaget", moduler, aktivGrupp: grupp }}>
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    expect(screen.getByRole("button", { name: "Ny datumomröstning" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Avslagen" })).toBeNull();
    expect(avslagen).not.toHaveBeenCalled();
    const props = /** @type {any} */ (komponent.mock.calls[0])[0];
    expect(Object.keys(props).sort()).toEqual(["grupp", "handelse"]);
    expect(props.handelse).toBeNull();
    expect(props.grupp).toBe(grupp);
  });

  it("⛔ en grupp vars id inte är skapalagets kastar: två svar på vilken grupp plusset gäller", () => {
    const moduler = validateModuler([MODUL("omrostning", [TILLAGG({ plats: "handelse.atgard" })])]);
    expect(() =>
      render(
        <OpsAppShell brand="Ops" nav={nav} activeHref="/" skapa={{ handelse: <p>formulär</p>, lage: "bolaget", moduler, aktivGrupp: { id: "annan", moduler: ["omrostning"] } }}>
          <p>innehåll</p>
        </OpsAppShell>,
      ),
    ).toThrow(/skapa\.aktivGrupp/);
  });
});

describe("inställningar, Appar: alla appar med Syns på", () => {
  const ikon = createElement("svg");
  const EKONOMI = () =>
    MODUL("ekonomi", [], {
      namn: { sv: "Ekonomi", en: "Finance" },
      nav: [{ href: "/ekonomi", label: "Ekonomi" }],
      hubb: { ikon, rutt: "/ekonomi", startsida: "oversikt", delar: [{ id: "oversikt", namn: { sv: "Översikt", en: "Overview" }, ikon, rutt: "/ekonomi/oversikt" }] },
    });
  const BADA = () =>
    MODUL("kassa", [TILLAGG({ id: "kvitto", etikett: { sv: "Kvitto", en: "Receipt" } })], {
      namn: { sv: "Kassa", en: "Till" },
      nav: [{ href: "/kassa", label: "Kassa" }],
      hubb: { ikon, rutt: "/kassa", startsida: "lista", delar: [{ id: "lista", namn: { sv: "Lista", en: "List" }, ikon, rutt: "/kassa/lista" }] },
    });
  const GRUPP = { id: "g", namn: { sv: "Gruppen" }, moduler: [] };

  it("visar en app utan yta med Syns på: Händelser och en med nav som Egen yta", () => {
    const moduler = validateModuler([EKONOMI(), MODUL("omrostning", [TILLAGG()]), BADA()]);
    const { container } = render(<OpsGruppFormular grupp={GRUPP} onSpara={async () => {}} moduler={{ valbara: valbaraModuler(moduler), agare: true }} />);
    const rader = container.querySelectorAll("[data-modul]");
    // ⛔ Golv (regel 4): ett prov på en lista som läste noll eller en rad kan inte skilja "alla appar" från "bara de med kort".
    expect(rader.length).toBeGreaterThanOrEqual(2);
    const rad = (/** @type {string} */ id) => /** @type {HTMLElement} */ (container.querySelector(`[data-modul="${id}"]`));
    expect(rad("omrostning")).toBeTruthy();
    expect(within(rad("omrostning")).getByText("Syns på: Händelser")).toBeTruthy();
    expect(within(rad("ekonomi")).getByText("Syns på: Egen yta")).toBeTruthy();
    expect(within(rad("kassa")).getByText("Syns på: Egen yta, Händelser")).toBeTruthy();
  });

  it("på engelska", () => {
    const moduler = validateModuler([EKONOMI(), MODUL("omrostning", [TILLAGG()])]);
    const { container } = render(<OpsGruppFormular sprak="en" grupp={GRUPP} onSpara={async () => {}} moduler={{ valbara: valbaraModuler(moduler), agare: true }} />);
    expect(within(/** @type {HTMLElement} */ (container.querySelector('[data-modul="omrostning"]'))).getByText("Visible in: Events")).toBeTruthy();
    expect(within(/** @type {HTMLElement} */ (container.querySelector('[data-modul="ekonomi"]'))).getByText("Visible in: Own page")).toBeTruthy();
  });

  it("på och av per grupp fungerar för en app utan yta", () => {
    const onSpara = vi.fn(async () => {});
    const moduler = validateModuler([EKONOMI(), MODUL("omrostning", [TILLAGG()])]);
    const { container } = render(<OpsGruppFormular formId="f" grupp={GRUPP} onSpara={onSpara} moduler={{ valbara: valbaraModuler(moduler), agare: true }} />);
    const knapp = /** @type {HTMLElement} */ (container.querySelector('[data-modul="omrostning"]'));
    expect(knapp.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(knapp);
    expect(knapp.getAttribute("aria-pressed")).toBe("true");
  });

  it("⛔ en app utan kort men med tillägg är inte en saknad rad i hubben", () => {
    const moduler = validateModuler([EKONOMI(), MODUL("omrostning", [TILLAGG()]), MODUL("tom", [])]);
    const { kort, saknade } = hubbForGrupp({ grupp: { id: "g", moduler: ["ekonomi", "omrostning", "tom"] }, moduler });
    expect(kort.map((m) => m.id)).toEqual(["ekonomi"]);
    expect(saknade).toEqual([{ id: "tom", skal: "inget-kort" }]);
  });
});
