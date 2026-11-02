import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsIconLink } from "../components/OpsIconLink.jsx";
import { OpsModulSida } from "../components/OpsModulSida.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { defineModule } from "../lib/modul.js";
import { byggGrupp } from "../lib/grupp.js";
import { HUVUDMENY_MAX, sattHuvudmeny } from "../lib/modulinstallningar.js";
import { LANGTRYCK_MS } from "../lib/apparark.js";

/**
 * Taket för appikonerna i toppraden (0.177.0, `HUVUDMENY_MAX`).
 *
 * ⛔ HÄNDELSEN: CP 2026-11-02 20:58, med en skärmbild från telefonen (390 px). Gruppen hade sju appar valda för "Visa i huvudmenyn" och toppraden klippte den sista ikonen
 * vid högerkanten. Beslutet: ett tak, och användaren prioriterar själv. Provet har fyra delar, en per ställe där taket gäller:
 *   1. skrivvägen nekar fler än taket (`byggGrupp`, `sattHuvudmeny`) och säger det med ord,
 *   2. reglaget "Visa i huvudmenyn" går inte att slå på när raden är full, och hinten säger det på svenska och engelska,
 *   3. läsvägen klipper aldrig: de första N i toppraden, resten som rader i Meny (bottenradens ark och huvudets meny), ingen app försvinner,
 *   4. långtryck på en appikon tar bort den ur huvudmenyn genom SAMMA callback som reglaget, och utan callback finns inget långtryck.
 * jsdom lägger ingen CSS, så vad som ryms i 360 px mäts i `scripts/huvudmeny-matt.mjs` (npm run check:huvudmeny). Här mäts strukturen.
 *
 * Talet N läses ur konstanten, aldrig ur ett tal i provet: mätningen äger talet.
 */

const I = () => <svg />;
const NAMN = ["Bibliotek", "Meddelanden", "Ekonomi", "Recept", "Agenter", "Foton", "Planering"];
const ID = NAMN.map((n) => n.toLowerCase());
const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const meny = { sektioner: [[{ key: "a", etikett: "Aktivitet", onClick: () => {} }]], onLoggaUt: () => {} };
const moduler = ID.map((id, i) => ({ id, namn: { sv: NAMN[i], en: NAMN[i] }, hubb: { rutt: `/${id}`, ikon: <I /> } }));
const SJU = ID.slice(0, 7);

/** @param {number} antal */
function appar(antal) {
  return ID.slice(0, antal).map((id, i) => <OpsIconLink key={id} href={`/${id}`} label={NAMN[i]} kvarIHuvudet icon={<I />} />);
}

/** @param {{ antal?: number, ark?: object | null, meny?: object | undefined, sprak?: "sv" | "en" }} [v] */
function Skal({ antal = 7, ark, meny: m = meny, sprak = "sv" } = {}) {
  const lista = ID.slice(0, antal);
  const apparArk = ark === null ? undefined : { moduler, grupp: { moduler: lista, huvudmeny: lista }, farAndra: true, ...ark };
  return (
    <OpsSprakProvider sprak={sprak}>
      <OpsAppShell
        brand="Ops"
        fasta={fasta}
        activeHref="/"
        onNavigate={(_h, e) => e.preventDefault()}
        actions={
          <>
            <OpsIconLink href="/inkorg" label="Inkorg" icon={<I />} />
            {appar(antal)}
            <OpsIconLink href="/sok" label="Sök" icon={<I />} />
          </>
        }
        meny={m}
        {...(apparArk ? { apparArk } : {})}
      >
        <p>innehåll</p>
      </OpsAppShell>
    </OpsSprakProvider>
  );
}

/** Appnamnen som är länkar i toppraden. @returns {string[]} */
const iToppraden = () => NAMN.filter((n) => within(screen.getByRole("banner")).queryAllByRole("link", { name: n, hidden: true }).length > 0);

describe("1. skrivvägen nekar fler än taket", () => {
  const GRUPP = (/** @type {string[]} */ huvudmeny) => ({ id: "bolaget", namn: { sv: "Bolaget", en: "The company" }, moduler: SJU, huvudmeny, arkiverad: false });

  it("byggGrupp med modulerna (skrivvägen): taket går igenom, taket + 1 kastar med ord", () => {
    expect(byggGrupp(GRUPP(SJU.slice(0, HUVUDMENY_MAX)), SJU).huvudmeny).toHaveLength(HUVUDMENY_MAX);
    expect(() => byggGrupp(GRUPP(SJU.slice(0, HUVUDMENY_MAX + 1)), SJU)).toThrow(new RegExp(`Toppraden rymmer ${HUVUDMENY_MAX}\\. Ta bort en först\\.`));
  });

  it("⛔ läsvägen kastar aldrig på längden: en grupp som redan har sju går att läsa, ingen migrering", () => {
    expect(byggGrupp(GRUPP(SJU)).huvudmeny).toEqual(SJU);
  });

  it("sattHuvudmeny: att lägga till vid taket kastar med ord, att ta bort och att lägga till en som redan står där gör det inte", () => {
    const full = SJU.slice(0, HUVUDMENY_MAX);
    expect(() => sattHuvudmeny(full, SJU[HUVUDMENY_MAX], true)).toThrow(new RegExp(`Toppraden rymmer ${HUVUDMENY_MAX}\\. Ta bort en först\\.`));
    expect(sattHuvudmeny(full, full[0], true)).toEqual(full);
    expect(sattHuvudmeny(full, full[0], false)).toEqual(full.slice(1));
    // Under taket lägger den sist, som förut.
    expect(sattHuvudmeny(full.slice(0, HUVUDMENY_MAX - 1), SJU[HUVUDMENY_MAX], true)).toEqual([...full.slice(0, HUVUDMENY_MAX - 1), SJU[HUVUDMENY_MAX]]);
  });
});

describe("2. reglaget Visa i huvudmenyn", () => {
  const modul = (/** @type {string} */ id) =>
    defineModule({ id, namn: { sv: id, en: id }, nav: [], routes: [], samlingar: [], kallor: {}, skapar: [], hubb: { ikon: <I />, rutt: `/${id}`, startsida: "start", delar: [{ id: "start", namn: { sv: "Start", en: "Start" }, ikon: <I />, rutt: `/${id}/start` }] } });
  const reglage = () => screen.getByRole("switch", { name: /Visa i huvudmenyn|Show in the main menu/ });
  /** @param {string} id @param {string[]} huvudmeny */
  function rita(id, huvudmeny, { sprak = "sv" } = {}) {
    const onSparaHuvudmeny = vi.fn();
    render(
      <OpsSprakProvider sprak={/** @type {any} */ (sprak)}>
        <OpsModulSida modul={modul(id)} activeHref={`/${id}?lage=installningar`} hubHref="/hub" ram={{ farAndra: true, grupp: { moduler: SJU, huvudmeny }, onOrdning: vi.fn(), onSparaHuvudmeny, onSpara: vi.fn() }}>
          <p />
        </OpsModulSida>
      </OpsSprakProvider>,
    );
    return onSparaHuvudmeny;
  }
  const fullRad = SJU.slice(1, 1 + HUVUDMENY_MAX);

  it("⛔ full rad: reglaget för en app som inte står där är avstängt, och hinten säger varför (sv)", () => {
    const spara = rita(SJU[0], fullRad);
    expect(/** @type {HTMLInputElement} */ (reglage()).disabled || reglage().getAttribute("aria-disabled") === "true").toBe(true);
    expect(screen.getByText(`Toppraden rymmer ${HUVUDMENY_MAX}. Ta bort en först.`)).toBeTruthy();
    fireEvent.click(reglage());
    expect(spara).not.toHaveBeenCalled();
  });

  it("⛔ samma hint på engelska", () => {
    rita(SJU[0], fullRad, { sprak: "en" });
    expect(screen.getByText(`The top bar holds ${HUVUDMENY_MAX}. Remove one first.`)).toBeTruthy();
  });

  it("en app som redan står i raden kan slås av även när raden är full, och skriver listan utan den", async () => {
    const spara = rita(fullRad[0], fullRad);
    expect(/** @type {HTMLInputElement} */ (reglage()).disabled).toBe(false);
    expect(screen.queryByText(/Toppraden rymmer/)).toBeNull();
    fireEvent.click(reglage());
    await waitFor(() => expect(spara).toHaveBeenCalledWith(fullRad.slice(1)));
  });

  it("under taket går reglaget att slå på och skriver samma fält som förut", async () => {
    const spara = rita(SJU[0], fullRad.slice(0, HUVUDMENY_MAX - 1));
    expect(/** @type {HTMLInputElement} */ (reglage()).disabled).toBe(false);
    fireEvent.click(reglage());
    await waitFor(() => expect(spara).toHaveBeenCalledWith([...fullRad.slice(0, HUVUDMENY_MAX - 1), SJU[0]]));
  });
});

describe("3. läsvägen klipper aldrig", () => {
  afterEach(cleanup);

  /** Klassen som döljer ett element vid en bredd? Tailwind 4: `max-*` är `width < N` och `min-*` är `width >= N`. Bara de brytpunkter skalet använder. @param {string} klass @param {number} bredd */
  function doljs(klass, bredd) {
    const max = /max-\[(\d+)px\]:hidden/.exec(klass);
    if (max) return bredd < Number(max[1]);
    const min = /min-\[(\d+)px\]:hidden/.exec(klass);
    if (min) return bredd >= Number(min[1]);
    if (/(^|\s)max-lg:hidden/.test(klass)) return bredd < 1024;
    if (/(^|\s)lg:hidden/.test(klass)) return bredd >= 1024;
    return false;
  }
  /** Klasserna på ikonens omslag (`data-huvudmeny-plats`), eller tomt när ikonen aldrig döljs. @param {string} namn */
  function ikonKlass(namn) {
    const lank = within(screen.getByRole("banner")).getByRole("link", { name: namn });
    return lank.closest("[data-huvudmeny-plats]")?.className ?? "";
  }
  /** Klasserna på radens omslag i Meny. @param {HTMLElement} ark @param {string} namn */
  const radKlass = (ark, namn) => within(ark).getByRole("link", { name: namn }).parentElement?.className ?? "";
  const oppnaBottenMeny = () => {
    fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Meny" }));
    return screen.getByRole("dialog");
  };

  it("⛔ sju fästa appar: de första HUVUDMENY_MAX (4) ritas i toppraden, i appens ordning, och inga fler", () => {
    expect(HUVUDMENY_MAX).toBe(4);
    render(<Skal antal={7} />);
    expect(iToppraden()).toEqual(NAMN.slice(0, HUVUDMENY_MAX));
  });

  it("⛔ ikon 0 syns alltid, ikon 1-3 döljs under bredden där de inte ryms (mätt: 1 vid 320, 2 vid 360, 3 vid 390 och 768, 4 från lg)", () => {
    render(<Skal antal={4} />);
    expect(ikonKlass(NAMN[0])).toBe("");
    expect(ikonKlass(NAMN[1])).toContain("max-[360px]:hidden");
    expect(ikonKlass(NAMN[2])).toContain("max-[390px]:hidden");
    expect(ikonKlass(NAMN[3])).toContain("max-lg:hidden");
    // Omslaget är `contents`: det blir ingen egen ruta i klungan.
    expect(ikonKlass(NAMN[1])).toContain("contents");
  });

  it("⛔ raderna i bottenradens Meny har de OMVÄNDA klasserna, i appens ordning, och ikon 0 har ingen rad", () => {
    render(<Skal antal={4} />);
    const ark = oppnaBottenMeny();
    expect(within(ark).queryByRole("link", { name: NAMN[0] })).toBeNull();
    expect(radKlass(ark, NAMN[1])).toContain("min-[360px]:hidden");
    expect(radKlass(ark, NAMN[2])).toContain("min-[390px]:hidden");
    expect(radKlass(ark, NAMN[3])).toContain("lg:hidden");
  });

  it("⛔ en app står på EXAKT ETT ställe på varje bredd: i toppraden eller i Meny, aldrig båda och aldrig ingen", () => {
    // Första ritningen: toppradens klasser och huvudets meny (från md). Radix döljer resten av sidan för skärmläsare medan en DIALOG är öppen, så bottenradens ark läses i en egen ritning.
    const forsta = render(<Skal antal={7} />);
    const ikonKlasser = NAMN.slice(0, HUVUDMENY_MAX).map(ikonKlass);
    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: /fler åtgärder/ }));
    const huvudNav = screen.getByRole("navigation", { name: "Fler appar" });
    const huvudKlasser = Object.fromEntries(within(huvudNav).getAllByRole("link").map((a) => [a.textContent, a.className]));
    forsta.unmount();
    render(<Skal antal={7} />);
    const ark = oppnaBottenMeny();
    for (const bredd of [320, 340, 359, 360, 375, 389, 390, 414, 600, 767, 768, 1000, 1023, 1024, 1280]) {
      for (const [k, namn] of NAMN.entries()) {
        const iHuvud = k < HUVUDMENY_MAX && !doljs(ikonKlasser[k], bredd);
        // Under md är det bottenradens Meny, från md huvudets meny (bottenraden finns inte då).
        const iMeny = bredd < 768
          ? k > 0 && (k >= HUVUDMENY_MAX || !doljs(radKlass(ark, namn), bredd))
          : k >= HUVUDMENY_MAX || (namn in huvudKlasser && !doljs(huvudKlasser[namn], bredd));
        expect(Number(iHuvud) + Number(iMeny), `${namn} (ikon ${k}) vid ${bredd} px: toppraden ${iHuvud}, Meny ${iMeny}`).toBe(1);
      }
    }
  });

  it("⛔ de efter de första fyra står i Meny på alla bredder, utan breddklass, i ordning, och ingen app saknas", () => {
    render(<Skal antal={7} />);
    const ark = oppnaBottenMeny();
    for (const n of NAMN.slice(HUVUDMENY_MAX)) {
      expect(within(ark).getByRole("link", { name: n }).getAttribute("href")).toBe(`/${n.toLowerCase()}`);
      expect(radKlass(ark, n)).not.toMatch(/hidden/);
    }
  });

  it("⛔ och i huvudets meny från md, som en egen navigering med namn: ikon 3 (dold under lg) först, med omvänd klass, sedan överskottet utan klass", () => {
    render(<Skal antal={7} />);
    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: /fler åtgärder/ }));
    const nav = screen.getByRole("navigation", { name: "Fler appar" });
    const lankar = within(nav).getAllByRole("link");
    expect(lankar.map((a) => a.textContent)).toEqual(NAMN.slice(HUVUDMENY_MAX - 1));
    expect(lankar[0].className).toContain("lg:hidden");
    for (const a of lankar.slice(1)) expect(a.className).not.toMatch(/hidden/);
    // Med överskott finns navigeringen på alla bredder.
    expect(nav.className).not.toContain("lg:hidden");
  });

  it("⛔ utan meny gäller samma sak: raderna ligger i bottenradens ark, med samma klasser", () => {
    render(<Skal antal={7} meny={undefined} />);
    const ark = oppnaBottenMeny();
    expect(radKlass(ark, NAMN[1])).toContain("min-[360px]:hidden");
    for (const n of NAMN.slice(HUVUDMENY_MAX)) expect(within(ark).getByRole("link", { name: n })).toBeTruthy();
  });

  it("en grupp med exakt taket har inget överskott: huvudets meny har bara ikon 3, och navigeringen göms från lg", () => {
    render(<Skal antal={HUVUDMENY_MAX} />);
    expect(iToppraden()).toEqual(NAMN.slice(0, HUVUDMENY_MAX));
    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: /fler åtgärder/ }));
    const nav = screen.getByRole("navigation", { name: "Fler appar" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual([NAMN[HUVUDMENY_MAX - 1]]);
    expect(nav.className).toContain("lg:hidden");
  });

  it("taket räknar bara kvarIHuvudet: Inkorg och Sök är åtgärder med sitt eget tak", () => {
    render(<Skal antal={HUVUDMENY_MAX} />);
    expect(within(screen.getByRole("banner")).getByRole("link", { name: "Inkorg" })).toBeTruthy();
    expect(ikonKlass("Inkorg")).toBe("");
  });
});

describe("4. långtryck på en appikon", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /** jsdom saknar PointerEvent: en MouseEvent med pekartypens namn. @param {EventTarget} el @param {string} typ */
  function peka(el, typ) {
    act(() => {
      el.dispatchEvent(new MouseEvent(typ, { bubbles: true, cancelable: true, clientX: 40, clientY: 30, button: 0 }));
    });
  }
  const ikon = (/** @type {string} */ namn) => within(screen.getByRole("banner")).getByRole("link", { name: namn });
  function hallIn(/** @type {string} */ namn) {
    peka(ikon(namn), "pointerdown");
    act(() => void vi.advanceTimersByTime(LANGTRYCK_MS + 50));
  }
  const val = () => screen.queryByRole("menuitem", { name: /Ta bort från huvudmenyn|Remove from main menu/ });

  it("⛔ håll in en appikon: valet 'Ta bort från huvudmenyn' öppnas, och ett val skriver listan utan appen genom callbacken", async () => {
    const onSparaHuvudmeny = vi.fn();
    render(<Skal antal={HUVUDMENY_MAX} ark={{ onSparaHuvudmeny }} />);
    hallIn(NAMN[0]);
    expect(val()).toBeTruthy();
    peka(document, "pointerup");
    act(() => void vi.advanceTimersByTime(600));
    fireEvent.click(/** @type {HTMLElement} */ (val()));
    await act(async () => {});
    expect(onSparaHuvudmeny).toHaveBeenCalledTimes(1);
    expect(onSparaHuvudmeny).toHaveBeenCalledWith(ID.slice(1, HUVUDMENY_MAX));
  });

  it("⛔ klicket från samma tryck som öppnade valet väljer inget (släppskyddet)", () => {
    const onSparaHuvudmeny = vi.fn();
    render(<Skal antal={HUVUDMENY_MAX} ark={{ onSparaHuvudmeny }} />);
    hallIn(NAMN[0]);
    peka(document, "pointerup");
    fireEvent.click(/** @type {HTMLElement} */ (val()));
    expect(onSparaHuvudmeny).not.toHaveBeenCalled();
  });

  it("engelska: 'Remove from main menu'", () => {
    render(<Skal antal={HUVUDMENY_MAX} sprak="en" ark={{ onSparaHuvudmeny: vi.fn() }} />);
    hallIn(NAMN[0]);
    expect(screen.getByRole("menuitem", { name: "Remove from main menu" })).toBeTruthy();
  });

  it("⛔ finns ingen callback ritas inget långtrycksval, och inget omslag", () => {
    render(<Skal antal={HUVUDMENY_MAX} />);
    expect(document.querySelector("[data-huvudmeny-ikon]")).toBeNull();
    hallIn(NAMN[0]);
    expect(val()).toBeNull();
  });

  it("⛔ utan behörighet (farAndra falskt) finns inget långtryck, samma villkor som reglaget", () => {
    render(<Skal antal={HUVUDMENY_MAX} ark={{ onSparaHuvudmeny: vi.fn(), farAndra: false }} />);
    expect(document.querySelector("[data-huvudmeny-ikon]")).toBeNull();
    hallIn(NAMN[0]);
    expect(val()).toBeNull();
  });

  it("en ikon som inte hör till en app i gruppens huvudmeny får inget långtryck (Inkorg, Sök)", () => {
    render(<Skal antal={HUVUDMENY_MAX} ark={{ onSparaHuvudmeny: vi.fn() }} />);
    hallIn("Inkorg");
    expect(val()).toBeNull();
  });

  it("⛔ ett fel från callbacken syns i valet och valet stannar öppet", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Skal antal={HUVUDMENY_MAX} ark={{ onSparaHuvudmeny: vi.fn(() => Promise.reject(new Error("Reglerna släppte inte in skrivningen."))) }} />);
    hallIn(NAMN[0]);
    peka(document, "pointerup");
    act(() => void vi.advanceTimersByTime(600));
    fireEvent.click(/** @type {HTMLElement} */ (val()));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Reglerna släppte inte in skrivningen."));
    expect(val()).toBeTruthy();
  });

  it("ett vanligt tryck navigerar som förut och öppnar inget val", () => {
    const onNavigate = vi.fn((_h, e) => e.preventDefault());
    render(
      <OpsAppShell
        brand="Ops"
        fasta={fasta}
        activeHref="/"
        onNavigate={onNavigate}
        actions={<OpsIconLink href="/bibliotek" label="Bibliotek" kvarIHuvudet icon={<I />} onNavigate={onNavigate} />}
        apparArk={{ moduler, grupp: { moduler: ID.slice(0, 1), huvudmeny: ID.slice(0, 1) }, farAndra: true, onSparaHuvudmeny: vi.fn() }}
      >
        <p />
      </OpsAppShell>,
    );
    fireEvent.click(ikon(NAMN[0]));
    expect(onNavigate).toHaveBeenCalledWith("/bibliotek", expect.anything());
    expect(val()).toBeNull();
  });
});
