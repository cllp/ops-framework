import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { GOLV, UNDANTAGSTAK, granska, granskaFil } from "../../scripts/lib/vantar.mjs";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsButton } from "../components/OpsButton.jsx";
import { OpsModulSida } from "../components/OpsModulSida.jsx";
import { OpsSvarsknappar } from "../components/OpsSvar.jsx";
import { OpsSvepRad } from "../components/OpsSvepRad.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { OpsTrad } from "../components/OpsMeddelanden.jsx";
import { defineModule } from "../lib/modul.js";

/**
 * Väntläget överallt där en knapp startar ett anrop (0.141.0, CP 2026-10-23: "Medans man kopplar måste man få en progress. Detta glömmer vi ofta.
 * Se till att alla ställen där användaren väntar på svar får en progress.").
 *
 * ══ VAD SOM MÄTS ══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * DEL 1, VAKTEN (`scripts/lib/vantar.mjs`, körs av `npm run check:vantar`): grön mot komponenterna, röd för varje inplanterat brott, och röd
 * under golvet och över taket. Mutationerna görs i minnet på komponenternas egen källtext (en rad tas bort), så "rött utan rättelsen" är
 * mätt mot de riktiga raderna och inte mot en påhittad fixtur. Varje mutation kräver att raden FANNS (annars provar den ingenting).
 *
 * DEL 2, BETEENDET: knapparna som vakten fick rättade väntar på riktigt när anropet inte är klart (`aria-busy`, en snurra, ett andra tryck
 * gör ingenting), och `OpsButton busyLabel` säger vad som pågår.
 *
 * ⛔ jsdom kör ingen CSS: provet mäter attribut och DOM, inte hur det ser ut. Utseendet mäts i `check-skalyta`.
 */

const KOMPONENTER = path.resolve(import.meta.dirname, "../components");

/** @returns {Record<string, string>} */
function komponenter() {
  /** @type {Record<string, string>} */
  const ut = {};
  for (const f of fs.readdirSync(KOMPONENTER).filter((x) => x.endsWith(".jsx")).sort()) ut[f] = fs.readFileSync(path.join(KOMPONENTER, f), "utf8");
  return ut;
}

/**
 * Ersätter EN förekomst i EN fil, och kräver att den fanns.
 * @param {Record<string, string>} filer @param {string} fil @param {string} gammal @param {string} ny
 */
function mutera(filer, fil, gammal, ny) {
  const kalla = filer[fil];
  expect(kalla, `${fil} finns`).toBeTypeOf("string");
  const antal = kalla.split(gammal).length - 1;
  expect(antal, `raden "${gammal.slice(0, 60)}" i ${fil} ska finnas exakt en gång, annars provar mutationen ingenting`).toBe(1);
  return { ...filer, [fil]: kalla.replace(gammal, ny) };
}

/** @param {{ brott: { fil: string, regel: string }[] }} r @param {string} fil @param {string} regel */
const harBrott = (r, fil, regel) => r.brott.some((b) => b.fil === fil && b.regel === regel);

describe("vakten check-vantar: varje knapp som startar ett anrop väntar synligt", () => {
  const filer = komponenter();

  it("grön mot komponenterna, med golv och tak, och varje undantag har ett skäl", () => {
    const r = granska(filer);
    expect(r.brott).toEqual([]);
    expect(r.golv).toEqual([]);
    expect(r.stat.filer).toBeGreaterThanOrEqual(GOLV.filer);
    expect(r.stat.knappar).toBeGreaterThanOrEqual(GOLV.knappar);
    expect(r.stat.anropande).toBeGreaterThanOrEqual(GOLV.anropande);
    expect(r.stat.undantag).toBeLessThanOrEqual(UNDANTAGSTAK);
    // Taket är inte slack: står det högre än antalet undantag finns det utrymme att fylla utan att någon märker det.
    expect(UNDANTAGSTAK).toBe(r.stat.undantag);
  });

  it("⛔ röd: OpsModulRam Anslut slutar ge löftet vidare (den knappen är CP:s 'medans man kopplar')", () => {
    const r = granska(mutera(filer, "OpsModulRam.jsx", "return bakgrund(() => ram.kopplingar?.onAnslut?.(k.id), () => {});", "bakgrund(() => ram.kopplingar?.onAnslut?.(k.id), () => {});"));
    expect(harBrott(r, "OpsModulRam.jsx", "loftet-svaljs")).toBe(true);
  });

  it("⛔ röd: den tryckta RSVP-knappen tappar aria-busy (en rå knapp som startar ett anrop)", () => {
    const r = granska(mutera(filer, "OpsSvar.jsx", "aria-busy={skriver === v || undefined}", ""));
    expect(harBrott(r, "OpsSvar.jsx", "ra-knapp")).toBe(true);
  });

  it("⛔ röd: Spara i trädnamnsformuläret tappar aria-busy (en submit i ett formulär som startar ett anrop)", () => {
    const r = granska(mutera(filer, "OpsMeddelanden.jsx", 'aria-busy={sparar === "namn" || undefined}', ""));
    expect(harBrott(r, "OpsMeddelanden.jsx", "submit-utan-vantan")).toBe(true);
  });

  it("⛔ röd: skickaknappen i skrivfältet tappar aria-busy", () => {
    const r = granska(mutera(filer, "OpsMeddelanden.jsx", "aria-busy={skickar || undefined}", ""));
    expect(harBrott(r, "OpsMeddelanden.jsx", "submit-utan-vantan")).toBe(true);
  });

  it("⛔ röd: en åtgärd i svepraden tappar aria-busy", () => {
    const r = granska(mutera(filer, "OpsSvepRad.jsx", "aria-busy={arbetar === a.etikett || undefined}", ""));
    expect(harBrott(r, "OpsSvepRad.jsx", "ra-knapp")).toBe(true);
  });

  it("⛔ röd: ett undantag utan skäl, ett dött undantag och ett undantag som passerar taket", () => {
    const utanSkal = granska(mutera(filer, "OpsApparArk.jsx", "vantar-ej: ordningen ritas direkt (hallen) och ställs tillbaka med ett fel om onOrdning avslås, se spara()", "vantar-ej: kort"));
    expect(harBrott(utanSkal, "OpsApparArk.jsx", "undantag-utan-skal")).toBe(true);

    const dott = granska({ ...filer, "OpsChip.jsx": `// vantar-ej: ett skäl som är långt nog men som inte täcker något brott alls\n${filer["OpsChip.jsx"]}` });
    expect(harBrott(dott, "OpsChip.jsx", "dod-undantag")).toBe(true);

    // En nionde rad, med skäl och med ett brott att täcka, passerar taket på åtta.
    const nio = mutera(filer, "OpsSvar.jsx", "aria-busy={skriver === v || undefined}", "");
    const medUndantag = { ...nio, "OpsSvar.jsx": nio["OpsSvar.jsx"].replace("  const knapp = (", "  /* vantar-ej: ett skäl som är långt nog men som inte hör hemma här, bara för taket */\n  const knapp = (") };
    const r = granska(medUndantag);
    expect(r.brott).toEqual([]);
    expect(r.stat.undantag).toBe(UNDANTAGSTAK + 1);
    expect(r.golv.some((g) => g.includes("taket är"))).toBe(true);
  });

  it("⛔ röd under golvet: en vakt som läser tre filer mäter ingenting", () => {
    const tre = Object.fromEntries(Object.entries(filer).slice(0, 3));
    const r = granska(tre);
    expect(r.golv.some((g) => g.includes("golvet för filer"))).toBe(true);
    expect(r.golv.some((g) => g.includes("golvet för knappar"))).toBe(true);
  });

  it("löftespropsen läses ur filens egen JSDoc, och en onClick som ger löftet vidare passerar", () => {
    const gron = `
/** @param {{ onSpara: () => Promise<void> }} props */
export function A({ onSpara }) {
  return <OpsButton onClick={() => onSpara()}>Spara</OpsButton>;
}`;
    const rod = `
/** @param {{ onSpara: () => Promise<void> }} props */
export function A({ onSpara }) {
  return <OpsButton onClick={() => { void onSpara(); }}>Spara</OpsButton>;
}`;
    const synlig = `
/** @param {{ onSpara: () => Promise<void> }} props */
export function A({ onSpara }) {
  return <OpsButton busy={false} onClick={() => { void onSpara(); }}>Spara</OpsButton>;
}`;
    const sync = `
/** @param {{ onSpara: () => void }} props */
export function A({ onSpara }) {
  return <button onClick={() => onSpara()}>Spara</button>;
}`;
    // `void` kastar bort löftet också i en pilfunktion med uttryckskropp (hubbens vanligaste fel, mätt 2026-10-23).
    const voidKropp = `
/** @param {{ onSpara: () => Promise<void> }} props */
export function A({ onSpara }) {
  return <OpsButton onClick={() => void onSpara()}>Spara</OpsButton>;
}`;
    expect(granskaFil("a.jsx", voidKropp).brott.map((b) => b.regel)).toEqual(["loftet-svaljs"]);
    expect(granskaFil("a.jsx", gron).brott).toEqual([]);
    expect(granskaFil("a.jsx", rod).brott.map((b) => b.regel)).toEqual(["loftet-svaljs"]);
    expect(granskaFil("a.jsx", synlig).brott).toEqual([]);
    // En prop som inte kan ge ett löfte startar inget anrop: en rå knapp är då rätt.
    expect(granskaFil("a.jsx", sync).brott).toEqual([]);
  });
});

/** Ett löfte som avgörs när testet vill. */
function uppskjuten() {
  /** @type {(v?: unknown) => void} */
  let los = () => {};
  const lofte = new Promise((a) => {
    los = a;
  });
  return { lofte, los };
}

describe("OpsButton busyLabel: verbet i pågående form", () => {
  it("knappen säger 'Sparar…' medan löftet pågår, behåller etiketten osynlig i samma ruta och är aria-busy och spärrad", async () => {
    const d = uppskjuten();
    const onClick = vi.fn(() => d.lofte);
    render(<OpsButton busyLabel="Sparar…" onClick={onClick}>Spara</OpsButton>);
    const knapp = screen.getByRole("button", { name: "Spara" });
    expect(knapp).not.toHaveAttribute("aria-busy");
    fireEvent.click(knapp);
    await waitFor(() => expect(knapp).toHaveAttribute("aria-busy", "true"));
    expect(knapp).toBeDisabled();
    expect(knapp.querySelector("svg")).not.toBeNull();
    // Namnet är verbet (den osynliga etiketten är aria-hidden), och etiketten ligger kvar så att bredden inte hoppar.
    expect(screen.getByRole("button", { name: "Sparar…" })).toBe(knapp);
    const dold = knapp.querySelector('[aria-hidden="true"].invisible');
    expect(dold?.textContent).toBe("Spara");
    fireEvent.click(knapp);
    expect(onClick).toHaveBeenCalledTimes(1);
    await act(async () => d.los());
    await waitFor(() => expect(knapp).not.toHaveAttribute("aria-busy"));
    expect(knapp).toHaveTextContent(/^Spara$/);
    expect(knapp.querySelector("svg")).toBeNull();
  });

  it("utan busyLabel står etiketten kvar som förut, och en ikonknapp har ingen etikett att byta", async () => {
    const d = uppskjuten();
    render(<OpsButton onClick={() => d.lofte}>Spara</OpsButton>);
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Spara" })).toHaveAttribute("aria-busy", "true"));
    expect(document.querySelector(".invisible")).toBeNull();
    await act(async () => d.los());

    const e = uppskjuten();
    render(<OpsButton iconOnly ariaLabel="Ta bort" busyLabel="Tar bort…" onClick={() => e.lofte}>x</OpsButton>);
    fireEvent.click(screen.getByRole("button", { name: "Ta bort" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ta bort" })).toHaveAttribute("aria-busy", "true"));
    expect(screen.queryByText("Tar bort…")).toBeNull();
    await act(async () => e.los());
  });
});

describe("knapparna som vakten fick rättade väntar på riktigt", () => {
  it("OpsSvar: den tryckta knappen visar en snurra och är aria-busy, den andra är spärrad, och båda är lediga efteråt", async () => {
    const d = uppskjuten();
    const onSvara = vi.fn(() => d.lofte);
    render(<OpsSvarsknappar onSvara={onSvara} />);
    const kommer = screen.getByRole("button", { name: "Kommer" });
    const kommerInte = screen.getByRole("button", { name: "Kommer inte" });
    expect(kommer.querySelector("svg")).not.toBeNull();
    fireEvent.click(kommer);
    await waitFor(() => expect(kommer).toHaveAttribute("aria-busy", "true"));
    expect(kommer.querySelector('svg[class*="animate-spin"]')).not.toBeNull();
    expect(kommerInte).toBeDisabled();
    expect(kommerInte).not.toHaveAttribute("aria-busy");
    fireEvent.click(kommerInte);
    expect(onSvara).toHaveBeenCalledTimes(1);
    await act(async () => d.los());
    await waitFor(() => expect(kommer).not.toHaveAttribute("aria-busy"));
    expect(kommer).not.toBeDisabled();
    expect(kommerInte).not.toBeDisabled();
  });

  it("OpsSvepRad: en åtgärd som väntar visar en rad med snurra och namnet, och försvinner när den är klar", async () => {
    const d = uppskjuten();
    const onValj = vi.fn(() => d.lofte);
    render(
      <ul>
        <OpsSvepRad atgarder={[{ id: "radera", etikett: "Radera", fara: true, onValj }]}>
          <span>Raden</span>
        </OpsSvepRad>
      </ul>,
    );
    const knapp = screen.getByText("Radera").closest("button");
    expect(knapp).not.toBeNull();
    fireEvent.click(/** @type {HTMLElement} */ (knapp));
    await waitFor(() => expect(document.querySelector("[data-ops-svep-arbetar]")).not.toBeNull());
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-ops-svep-arbetar]"));
    expect(rad).toHaveAttribute("role", "status");
    expect(rad.textContent).toBe("Radera…");
    expect(rad.querySelector("svg")).not.toBeNull();
    expect(onValj).toHaveBeenCalledTimes(1);
    await act(async () => d.los());
    await waitFor(() => expect(document.querySelector("[data-ops-svep-arbetar]")).toBeNull());
    expect(screen.getByText("Raden")).toBeTruthy();
  });

  it("OpsSvepRad: avslås åtgärden försvinner väntan och felet står kvar", async () => {
    let avslag = (/** @type {unknown} */ _e) => {};
    const lofte = new Promise((_a, b) => {
      avslag = b;
    });
    render(
      <ul>
        <OpsSvepRad atgarder={[{ id: "radera", etikett: "Radera", onValj: () => /** @type {Promise<void>} */ (lofte) }]}>
          <span>Raden</span>
        </OpsSvepRad>
      </ul>,
    );
    fireEvent.click(/** @type {HTMLElement} */ (screen.getByText("Radera").closest("button")));
    await waitFor(() => expect(document.querySelector("[data-ops-svep-arbetar]")).not.toBeNull());
    await act(async () => avslag(new Error("nätet föll")));
    await waitFor(() => expect(document.querySelector("[data-ops-svep-arbetar]")).toBeNull());
    expect(screen.getByRole("alert").textContent).toBe("nätet föll");
  });

  it("OpsModulRam: Anslut väntar ('Ansluter…', aria-busy) tills appens anrop är klart, och ett avslag ställer tillbaka knappen med ett fel", async () => {
    const I = () => <svg />;
    const modul = defineModule({
      id: "ekonomi",
      namn: { sv: "Ekonomi", en: "Finance" },
      nav: [],
      routes: [],
      samlingar: [],
      kallor: {},
      skapar: [],
      hubb: { ikon: <I />, rutt: "/ekonomi", startsida: "oversikt", delar: [{ id: "oversikt", namn: { sv: "Översikt", en: "Overview" }, ikon: <I />, rutt: "/ekonomi/oversikt" }] },
      kopplingar: [{ id: "enable-banking", namn: { sv: "Bank", en: "Bank" }, hint: { sv: "Enable Banking", en: "Enable Banking" }, behorigheter: [{ sv: "Läsa transaktioner", en: "Read transactions" }] }],
    });
    /** @type {(e: unknown) => void} */
    let avslag = () => {};
    const lofte = new Promise((_a, b) => {
      avslag = b;
    });
    const onAnslut = vi.fn(() => /** @type {Promise<void>} */ (lofte));
    const ram = { farAndra: true, grupp: { moduler: ["ekonomi"], huvudmeny: [] }, onOrdning: vi.fn(), onSparaHuvudmeny: vi.fn(), onSpara: vi.fn(), kopplingar: { lage: {}, onAnslut, onKopplaFran: vi.fn() } };
    render(<OpsModulSida modul={modul} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram}><p /></OpsModulSida>);
    const knapp = screen.getByRole("button", { name: "Anslut" });
    fireEvent.click(knapp);
    await waitFor(() => expect(knapp).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByRole("button", { name: "Ansluter…" })).toBe(knapp);
    expect(knapp).toBeDisabled();
    fireEvent.click(knapp);
    expect(onAnslut).toHaveBeenCalledTimes(1);
    await act(async () => avslag(new Error("Banken svarade inte")));
    await waitFor(() => expect(knapp).not.toHaveAttribute("aria-busy"));
    expect(knapp).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Anslut" })).toBe(knapp);
    expect(screen.getByText("Banken svarade inte")).toBeTruthy();
  });
});

describe("tråden: Lyft till minnet och Döp om väntar synligt", () => {
  const MEDLEMMAR = [
    { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
    { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  ];
  const namnFor = (/** @type {string} */ uid) => MEDLEMMAR.find((m) => m.userId === uid)?.namn ?? uid;
  async function trad() {
    let t = 1_700_000_000_000;
    const s = createSamtalskalla({ kalla: createMemorySource({}), tradar: "tradar", klocka: () => (t += 1000) });
    const g = await s.oppnaGrupp({ groupId: "cps-ab", uid: "anna" });
    const rot = await s.skicka(g.id, { text: "Budgeten är klar", av: "bo" });
    await s.skickaITrad(g.id, rot.id, { text: "Vi tar den på fredag", av: "anna" });
    return { s, g, rot };
  }

  it("Lyft till minnet: knappen på det lyfta meddelandet är aria-busy med en snurra, de andra är spärrade, och alla är lediga efteråt", async () => {
    const { s, g, rot } = await trad();
    const d = uppskjuten();
    const lyft = vi.fn(() => /** @type {Promise<void>} */ (d.lofte));
    render(<OpsTrad kalla={s} uid="anna" samtal={g} tid={rot.id} gruppNamn="Gruppen" namnFor={namnFor} medlemmar={MEDLEMMAR} onStang={() => {}} onLyftTillMinnet={lyft} minneHref="/minne" />);
    const knappar = await screen.findAllByRole("button", { name: "Lyft till minnet" });
    fireEvent.click(knappar[0]);
    await waitFor(() => expect(knappar[0]).toHaveAttribute("aria-busy", "true"));
    expect(knappar[0].querySelector("svg")).not.toBeNull();
    expect(knappar[1]).toBeDisabled();
    fireEvent.click(knappar[1]);
    expect(lyft).toHaveBeenCalledTimes(1);
    await act(async () => d.los());
    await waitFor(() => expect(knappar[0]).not.toHaveAttribute("aria-busy"));
    expect(knappar[1]).not.toBeDisabled();
  });

  it("Döp om: Spara är aria-busy med en snurra medan servern svarar, ett andra tryck gör ingenting, och formuläret stängs när det är klart", async () => {
    const { s, g, rot } = await trad();
    const d = uppskjuten();
    const dopOm = vi.fn(() => d.lofte);
    render(<OpsTrad kalla={{ ...s, dopOm }} uid="anna" samtal={g} tid={rot.id} gruppNamn="Gruppen" namnFor={namnFor} medlemmar={MEDLEMMAR} onStang={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Döp om" }));
    const spara = await screen.findByRole("button", { name: "Spara" });
    fireEvent.click(spara);
    await waitFor(() => expect(spara).toHaveAttribute("aria-busy", "true"));
    expect(spara).toBeDisabled();
    expect(spara.querySelector("svg")).not.toBeNull();
    fireEvent.click(spara);
    expect(dopOm).toHaveBeenCalledTimes(1);
    await act(async () => d.los());
    await waitFor(() => expect(screen.queryByRole("button", { name: "Spara" })).toBeNull());
  });
});

describe("Logga ut i menyn väntar synligt (0.141.0)", () => {
  const nav = [{ href: "/", label: "Idag", icon: <svg /> }];
  const skal = (/** @type {() => unknown} */ onLoggaUt) => (
    <OpsAppShell brand="Ops" nav={nav} activeHref="/" meny={{ onLoggaUt }}>
      <p>innehåll</p>
    </OpsAppShell>
  );

  it("ger onLoggaUt ett löfte står menyn öppen med 'Loggar ut…', en snurra och aria-busy, ett andra tryck gör ingenting, och menyn stängs när löftet är klart", async () => {
    const d = uppskjuten();
    const onLoggaUt = vi.fn(() => d.lofte);
    render(skal(onLoggaUt));
    fireEvent.click(screen.getByRole("button", { name: "Meny, fler åtgärder" }));
    const rad = screen.getByRole("button", { name: "Logga ut" });
    fireEvent.click(rad);
    await waitFor(() => expect(rad).toHaveAttribute("aria-busy", "true"));
    expect(rad).toHaveTextContent("Loggar ut…");
    expect(rad.querySelector("svg")).not.toBeNull();
    expect(rad).toBeDisabled();
    fireEvent.click(rad);
    expect(onLoggaUt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Meny" })).toBeTruthy();
    await act(async () => d.los());
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Meny" })).toBeNull());
  });

  it("ger onLoggaUt inget löfte är det som förut: menyn stängs och funktionen körs, utan väntan", async () => {
    const onLoggaUt = vi.fn();
    render(skal(onLoggaUt));
    fireEvent.click(screen.getByRole("button", { name: "Meny, fler åtgärder" }));
    fireEvent.click(screen.getByRole("button", { name: "Logga ut" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Meny" })).toBeNull());
    expect(onLoggaUt).toHaveBeenCalledTimes(1);
  });
});
