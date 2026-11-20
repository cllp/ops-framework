import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsIconLink } from "../components/OpsIconLink.jsx";
import { OpsModulSida } from "../components/OpsModulSida.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { defineModule } from "../lib/modul.js";
import { byggGrupp } from "../lib/grupp.js";
import { HUVUDMENY_BAND, HUVUDMENY_MAX, sattHuvudmeny } from "../lib/modulinstallningar.js";
import { LANGTRYCK_MS } from "../lib/apparark.js";
import { avdelningsBreddklass } from "../lib/nav.js";

/**
 * Taket för appikonerna i toppraden (0.177.0, `HUVUDMENY_MAX`).
 *
 * ⛔ HÄNDELSEN: CP 2026-11-02 20:58, med en skärmbild från telefonen (390 px). Gruppen hade sju appar valda för "Visa i huvudmenyn" och toppraden klippte den sista ikonen
 * vid högerkanten. Beslutet: ett tak, och användaren prioriterar själv. Provet har fyra delar, en per ställe där taket gäller:
 *   1. skrivvägen nekar fler än taket (`byggGrupp`, `sattHuvudmeny`) och säger det med ord,
 *   2. reglaget "Visa i huvudmenyn" går inte att slå på när raden är full, och hinten säger det på svenska och engelska,
 *   3. läsvägen klipper aldrig: det som ryms i toppraden, resten bakom « (0.247.0, cllp/lifehub.app#909), ingen app försvinner och ingen står i Meny,
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

/** @param {{ antal?: number, ark?: object | null, meny?: object | undefined, sprak?: "sv" | "en", sok?: boolean }} [v] `sok: false` tar bort Sök: den flyttas annars till Meny som en rad utan breddklass, och då är avdelningen aldrig tom. */
function Skal({ antal = 7, ark, meny: m = meny, sprak = "sv", sok = true } = {}) {
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
            {sok ? <OpsIconLink href="/sok" label="Sök" icon={<I />} /> : null}
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

describe("3. läsvägen klipper aldrig: det som inte ryms ligger bakom « (0.247.0, cllp/lifehub.app#909)", () => {
  afterEach(cleanup);

  /**
   * Döljer klassträngen elementet vid bredden? Tailwind 4: `max-*` är `width < N`, `min-*` är `width >= N`, `lg` är 1024 px. Varianter staplas (`min-[360px]:max-[390px]:hidden`), och
   * ett element är dolt när NÅGON av klasserna döljer det. Bara de brytpunkter skalet använder; en okänd variant kastar, så provet inte blir grönt av en klass det inte förstår.
   * @param {string} klasser @param {number} bredd
   */
  function doljs(klasser, bredd) {
    return klasser.split(/\s+/).filter((k) => k.endsWith(":hidden")).some((k) =>
      k.slice(0, -":hidden".length).split(":").every((v) => {
        const max = /^max-\[(\d+)px\]$/.exec(v);
        if (max) return bredd < Number(max[1]);
        const min = /^min-\[(\d+)px\]$/.exec(v);
        if (min) return bredd >= Number(min[1]);
        if (v === "max-lg") return bredd < 1024;
        if (v === "lg") return bredd >= 1024;
        if (v === "md") return bredd >= 768;
        throw new Error(`okänd variant ${v} i ${k}`);
      }),
    );
  }
  /** Klasserna på ikonens omslag i toppraden, eller tomt när ikonen aldrig döljs. @param {string} namn */
  function ikonKlass(namn) {
    const lank = within(screen.getByRole("banner")).getByRole("link", { name: namn, hidden: true });
    return lank.closest("[data-huvudmeny-plats]")?.className ?? "";
  }
  const knapp = () => screen.queryByRole("button", { name: "Fler appar", hidden: true });
  /** Öppnar « och ger klasserna per app i raden. @returns {Record<string, string>} */
  function oppnaFler() {
    fireEvent.click(/** @type {HTMLElement} */ (knapp()));
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-huvudmeny-fler-rad]"));
    return Object.fromEntries(within(rad).getAllByRole("link", { hidden: true }).map((a) => [a.getAttribute("aria-label") ?? a.textContent, a.closest("[data-huvudmeny-fler-plats]")?.className ?? ""]));
  }
  const BREDDER = [320, 340, 359, 360, 375, 389, 390, 414, 600, 767, 768, 1000, 1023, 1024, 1280];

  it("⛔ en app står på EXAKT ETT ställe på varje bredd: i toppraden eller bakom «, aldrig båda och aldrig ingen (1, 2, 3, 4 och 7 appar)", () => {
    for (const antal of [1, 2, 3, 4, 7]) {
      const r = render(<Skal antal={antal} />);
      const ikonKlasser = NAMN.slice(0, antal).map(ikonKlass);
      const finns = knapp() !== null;
      const knappKlass = finns ? /** @type {HTMLElement} */ (document.querySelector("[data-huvudmeny-fler]")).className : "";
      const fler = finns ? oppnaFler() : {};
      for (const bredd of BREDDER) {
        const synligKnapp = finns && !doljs(knappKlass, bredd);
        let synliga = 0;
        for (const [k, namn] of NAMN.slice(0, antal).entries()) {
          const iHuvud = !doljs(ikonKlasser[k], bredd);
          const bakom = synligKnapp && namn in fler && !doljs(fler[namn], bredd);
          if (iHuvud) synliga += 1;
          expect(Number(iHuvud) + Number(bakom), `${antal} appar, ${namn} (ikon ${k}) vid ${bredd} px: toppraden ${iHuvud}, bakom « ${bakom}`).toBe(1);
        }
        // Raden rymmer det mätningen säger, och « tar en plats när den syns.
        const platser = HUVUDMENY_BAND.findLast((b) => bredd >= b.fran)?.platser ?? 0;
        expect(synliga + Number(synligKnapp), `${antal} appar vid ${bredd} px`).toBeLessThanOrEqual(platser);
        expect(synliga, `${antal} appar vid ${bredd} px: högst taket`).toBeLessThanOrEqual(HUVUDMENY_MAX);
      }
      r.unmount();
    }
  });

  it("⛔ en ensam app ryms på alla bredder: ingen « alls", () => {
    render(<Skal antal={1} />);
    expect(knapp()).toBeNull();
    expect(ikonKlass(NAMN[0])).toBe("");
  });

  it("⛔ sju fästa appar: från lg syns de första HUVUDMENY_MAX (4) i appens ordning, och resten står bakom « på alla bredder", () => {
    expect(HUVUDMENY_MAX).toBe(4);
    render(<Skal antal={7} />);
    expect(NAMN.filter((n) => !doljs(ikonKlass(n), 1280))).toEqual(NAMN.slice(0, HUVUDMENY_MAX));
    const knappKlass = /** @type {HTMLElement} */ (document.querySelector("[data-huvudmeny-fler]")).className;
    expect(BREDDER.every((b) => !doljs(knappKlass, b))).toBe(true);
    const fler = oppnaFler();
    for (const n of NAMN.slice(HUVUDMENY_MAX)) expect(BREDDER.every((b) => !doljs(fler[n], b)), n).toBe(true);
  });

  it("⛔ fyra appar vid 390 px: två ikoner och «, och bakom « de två sista (« tar en plats)", () => {
    render(<Skal antal={4} />);
    expect(NAMN.slice(0, 4).filter((n) => !doljs(ikonKlass(n), 390))).toEqual(NAMN.slice(0, 2));
    const fler = oppnaFler();
    expect(NAMN.slice(0, 4).filter((n) => !doljs(fler[n], 390))).toEqual(NAMN.slice(2, 4));
  });

  it("⛔ Meny har inga apprader längre, varken i bottenradens ark eller i huvudets meny", () => {
    const forsta = render(<Skal antal={7} />);
    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: /fler åtgärder/ }));
    expect(screen.queryByRole("navigation", { name: "Fler verktyg" })).toBeNull();
    for (const n of NAMN) expect(document.querySelectorAll(`[data-radix-popper-content-wrapper] a[href="/${n.toLowerCase()}"]`).length, n).toBe(0);
    forsta.unmount();
    render(<Skal antal={7} meny={undefined} />);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Meny" }));
    const ark = screen.getByRole("dialog");
    for (const n of NAMN) expect(within(ark).queryByRole("link", { name: n }), n).toBeNull();
  });

  it("ett tryck på en ikon bakom « navigerar och stänger raden", () => {
    const onNavigate = vi.fn((_h, e) => e.preventDefault());
    render(
      <OpsAppShell brand="Ops" fasta={fasta} activeHref="/" onNavigate={onNavigate} actions={<>{ID.slice(0, 3).map((id, i) => <OpsIconLink key={id} href={`/${id}`} label={NAMN[i]} kvarIHuvudet icon={<I />} onNavigate={onNavigate} />)}</>}>
        <p />
      </OpsAppShell>,
    );
    fireEvent.click(/** @type {HTMLElement} */ (knapp()));
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-huvudmeny-fler-rad]"));
    fireEvent.click(within(rad).getByRole("link", { name: NAMN[2], hidden: true }));
    expect(onNavigate).toHaveBeenCalledWith("/ekonomi", expect.anything());
    expect(document.querySelector("[data-huvudmeny-fler-rad]")).toBeNull();
  });

  it("« har ett namn på båda språken", () => {
    const r = render(<Skal antal={4} />);
    expect(knapp()).toBeTruthy();
    r.unmount();
    render(<Skal antal={4} sprak="en" />);
    expect(screen.getByRole("button", { name: "More apps", hidden: true })).toBeTruthy();
  });

  it("taket räknar bara kvarIHuvudet: Inkorg och Sök är åtgärder med sitt eget tak", () => {
    render(<Skal antal={HUVUDMENY_MAX} />);
    expect(within(screen.getByRole("banner")).getByRole("link", { name: "Inkorg" })).toBeTruthy();
    expect(ikonKlass("Inkorg")).toBe("");
  });
});

describe("3b. avdelningsBreddklass, för rader som en app själv ger en breddklass", () => {
  it("⛔ klassen från raden som döljs sist, och inget om någon rad syns alltid eller klassen inte kan tolkas", () => {
    expect(avdelningsBreddklass([{ breddklass: "min-[360px]:hidden" }])).toBe("min-[360px]:hidden");
    expect(avdelningsBreddklass([{ breddklass: "min-[360px]:hidden" }, { breddklass: "min-[390px]:hidden" }])).toBe("min-[390px]:hidden");
    expect(avdelningsBreddklass([{ breddklass: "min-[390px]:hidden" }, { breddklass: "min-[360px]:hidden" }, { breddklass: "lg:hidden" }])).toBe("lg:hidden");
    expect(avdelningsBreddklass([{ breddklass: "min-[360px]:hidden" }, {}])).toBeUndefined();
    expect(avdelningsBreddklass([{ breddklass: "max-[360px]:hidden" }])).toBeUndefined();
    expect(avdelningsBreddklass([])).toBeUndefined();
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
