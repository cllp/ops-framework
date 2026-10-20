import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost } from "../lib/bibliotek.js";
import { UTSKRIFT_TAK_MS, UTSKRIFT_VANTETID_MS } from "../lib/utskrift.js";

/*
 * Utskriften går i bakgrunden, och den kan tas bort och köras om (0.133.0, lifehub.app#349).
 *
 * CP 2026-10-20: "Kan man göra så att man kan ta bort transkribering på en ljudupptagning och köra om den?" och att utskriften ska gå i bakgrunden och fortsätta även om man går därifrån, att det
 * ska stå tydligt att den gör det, och att man ska få veta när den är klar.
 *
 * ⛔ LÄGET LÄSES UR POSTEN. Proven "efter en ommontering" är provet för att man gick därifrån och kom tillbaka: komponenten monteras om från noll med samma post, och måste visa samma sak.
 */

const NU = 1_800_000_000_000;
const MIN = 60_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const FORFATTARE = { uid: "uid-1", roll: "medlem" };
const ANNAN_MEDLEM = { uid: "uid-2", roll: "medlem" };
const ADMIN = { uid: "uid-3", roll: "admin", groupId: "cps-ab" };
const RUBRIK = "Idé 2026-10-17 10:05";
const av = { uid: "uid-1", namn: "Kim" };

/** @param {Record<string, unknown>} [extra] */
const ljud = (extra = {}) => ({
  ...byggPost({
    groupId: "cps-ab",
    typ: "fil",
    rubrik: RUBRIK,
    fil: { sokvag: "grupper/cps-ab/bibliotek/p/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 4000 },
    durationMs: 180000,
    skapadAv: skapare,
    skapad: NU - 1000,
    andrad: NU - 1000,
    ...extra,
  }),
  id: "ljud",
});
const pagar = (extra = {}) => ({ status: "pagar", startad: NU - 2 * MIN, av, ...extra });

/** @type {(id: string, falt: Record<string, unknown>) => void} */
let servern = () => {};

/**
 * @param {{ start?: any[], jag?: any, props?: Record<string, any> }} p
 */
function Harness({ start = [ljud()], jag = FORFATTARE, props = {} }) {
  const [poster, setPoster] = useState(start);
  const [vald, setVald] = useState(/** @type {any} */ (null));
  useEffect(() => {
    // "Servern" ändrar posten: en nyckel som sätts till `undefined` tas bort, som `FieldValue.delete()`.
    servern = (id, falt) =>
      setPoster((ps) =>
        ps.map((p) => {
          if (p.id !== id) return p;
          const ny = { ...p, ...falt };
          for (const [k, v] of Object.entries(falt)) if (v === undefined) delete ny[k];
          return ny;
        }),
      );
  }, []);
  return (
    <OpsBibliotek poster={poster} jag={jag} vald={vald} onOppna={(p) => setVald(p)} onStang={() => setVald(null)} onSkapa={() => {}} onSpara={() => {}} filUrl={() => "https://exempel.se/ide.webm"} hubHref="/hub" {...props} />
  );
}

const oppna = () => fireEvent.click(screen.getByRole("button", { name: RUBRIK }));
const flush = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
const gaTid = (/** @type {number} */ ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
/** Med fejkade timers hänger `findBy`, så dialogen väntas in med mikrouppgifterna. */
const dialogen = async () => {
  await flush();
  return screen.getByRole("dialog");
};
const knapp = (/** @type {string} */ namn) => screen.queryByRole("button", { name: namn });
const lage = () => document.querySelector("[data-bibliotek-utskrift-kontroll]")?.getAttribute("data-bibliotek-utskrift-lage");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NU);
  // jsdom spelar inget ljud och skriver ut "Not implemented" när spelaren städar.
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("utskriften går i bakgrunden: läget kommer ur posten", () => {
  it("⛔ i detaljen: att den går i bakgrunden, hur länge den pågått, hur länge den BRUKAR ta (märkt som en uppskattning) och att man får en notis", () => {
    render(<Harness start={[ljud({ utskriftJobb: pagar() })]} props={{ onSkrivUt: vi.fn() }} />);
    oppna();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Skriver ut i bakgrunden. Du kan gå härifrån, utskriften blir klar ändå.");
    expect(status).toHaveTextContent("Har pågått i 2 min.");
    expect(status).toHaveTextContent("Brukar ta cirka 2 min (uppskattning).");
    expect(status).toHaveTextContent("Du får en notis när den är klar.");
    expect(lage()).toBe("pagar");
    // Ingen procentstapel: modellen ger inget löpande förlopp, och en påhittad procent är en gissning som ser ut som en mätning.
    expect(document.querySelector("[role='progressbar'], progress")).toBeNull();
    expect(status.textContent).not.toMatch(/%/);
  });

  it("⛔ EFTER EN OMMONTERING (man gick därifrån och kom tillbaka) visar kortet och detaljen samma läge, ur posten", () => {
    const post = ljud({ utskriftJobb: pagar() });
    const forsta = render(<Harness start={[post]} props={{ onSkrivUt: vi.fn() }} />);
    expect(document.querySelector("[data-bibliotek-skriver-ut]")).not.toBeNull();
    forsta.unmount();
    // Från noll, med samma post: ingen komponent har något minne av att utskriften startades här.
    render(<Harness start={[post]} props={{ onSkrivUt: vi.fn() }} />);
    expect(document.querySelector("[data-bibliotek-skriver-ut]")?.textContent).toBe("Skriver ut…");
    oppna();
    expect(screen.getByRole("status")).toHaveTextContent("Skriver ut i bakgrunden.");
  });

  it("kortet säger 'Skriver ut…' bara medan läget är pågår, inte vid ingen, klar eller fel", () => {
    for (const [extra, forvantat] of /** @type {const} */ ([[{}, false], [{ utskrift: "Text" }, false], [{ utskriftJobb: pagar({ status: "fel", fel: "X" }) }, false], [{ utskriftJobb: pagar() }, true]])) {
      const { unmount } = render(<Harness start={[ljud(extra)]} />);
      expect(document.querySelector("[data-bibliotek-skriver-ut]") !== null, JSON.stringify(extra)).toBe(forvantat);
      unmount();
    }
  });

  it("⛔ knapparna Skriv ut, Skriv ut igen och Ta bort utskriften är AVSTÄNGDA medan läget är pågår", () => {
    const props = { onSkrivUt: vi.fn(), onSkrivUtIgen: vi.fn(), onTaBortUtskrift: vi.fn() };
    const utanText = render(<Harness start={[ljud({ utskriftJobb: pagar() })]} props={props} />);
    oppna();
    expect(knapp("Skriv ut texten")).toBeDisabled();
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Skriv ut texten")));
    expect(props.onSkrivUt).not.toHaveBeenCalled();
    utanText.unmount();
    render(<Harness start={[ljud({ utskrift: "Gammal text", utskriftJobb: pagar() })]} props={props} />);
    oppna();
    expect(knapp("Skriv ut igen")).toBeDisabled();
    expect(knapp("Ta bort utskriften")).toBeDisabled();
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Skriv ut igen")));
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Ta bort utskriften")));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(props.onSkrivUtIgen).not.toHaveBeenCalled();
    expect(props.onTaBortUtskrift).not.toHaveBeenCalled();
    // Den gamla texten står kvar medan den ersätts.
    expect(document.querySelector("[data-bibliotek-utskrift]")?.textContent).toBe("Gammal text");
  });

  it("tiden som gått räknas om medan sidan står öppen", async () => {
    render(<Harness start={[ljud({ utskriftJobb: pagar({ startad: NU - 20_000 }) })]} />);
    oppna();
    expect(screen.getByRole("status")).toHaveTextContent("Har pågått i mindre än en minut.");
    await gaTid(60_000);
    expect(screen.getByRole("status")).toHaveTextContent("Har pågått i 1 min.");
  });

  it("⛔ uppskattningen finns bara när ljudets längd är känd; annars står det att den inte går att räkna ut", () => {
    const { durationMs: _bort, ...utanLangd } = ljud({ utskriftJobb: pagar() });
    render(<Harness start={[utanLangd]} />);
    oppna();
    expect(screen.getByRole("status")).toHaveTextContent("Hur lång tid det brukar ta går inte att uppskatta");
    expect(screen.getByRole("status").textContent).not.toMatch(/Brukar ta cirka/);
  });

  it("en annan person ser vem som startade, och får ingen notis-rad", () => {
    render(<Harness jag={ADMIN} start={[ljud({ utskriftJobb: pagar() })]} />);
    oppna();
    expect(screen.getByRole("status")).toHaveTextContent("Startad av Kim.");
    expect(screen.getByRole("status").textContent).not.toMatch(/notis/);
  });

  it("⛔ en utskrift som klarnar: jobbet försvinner ur posten och texten tar över, utan knappen Skriv ut", async () => {
    render(<Harness start={[ljud({ utskriftJobb: pagar() })]} props={{ onSkrivUt: vi.fn(), onSkrivUtIgen: vi.fn(), onTaBortUtskrift: vi.fn() }} />);
    oppna();
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => servern("ljud", { utskrift: "Första versen", utskriftJobb: undefined }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector("[data-bibliotek-utskrift]")?.textContent).toBe("Första versen");
    expect(lage()).toBe("klar");
    expect(knapp("Skriv ut texten")).toBeNull();
    expect(knapp("Skriv ut igen")).toBeEnabled();
    expect(document.querySelector("[data-bibliotek-skriver-ut]")).toBeNull();
  });
});

describe("när utskriften gick fel", () => {
  it("⛔ jobbets text och knappen Försök igen, som kör Skriv ut", async () => {
    const onSkrivUt = vi.fn(() => Promise.resolve());
    render(<Harness start={[ljud({ utskriftJobb: pagar({ status: "fel", fel: "Tjänsten svarade inte." }) })]} props={{ onSkrivUt }} />);
    oppna();
    expect(screen.getByRole("alert")).toHaveTextContent("Tjänsten svarade inte.");
    expect(lage()).toBe("fel");
    expect(knapp("Skriv ut texten")).toBeNull();
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Försök igen")));
    await flush();
    expect(onSkrivUt).toHaveBeenCalledTimes(1);
  });

  it("⛔ en 'pågår' som är äldre än 15 minuter är ett fel med texten 'Utskriften blev inte klar. Försök igen.', och Försök igen finns", () => {
    render(<Harness start={[ljud({ utskriftJobb: pagar({ startad: NU - UTSKRIFT_TAK_MS - 1 }) })]} props={{ onSkrivUt: vi.fn() }} />);
    oppna();
    expect(screen.getByRole("alert")).toHaveTextContent("Utskriften blev inte klar. Försök igen.");
    expect(knapp("Försök igen")).toBeEnabled();
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector("[data-bibliotek-skriver-ut]")).toBeNull();
  });

  it("en pågående utskrift blir ett fel när 15 minuter gått medan sidan står öppen", async () => {
    render(<Harness start={[ljud({ utskriftJobb: pagar({ startad: NU - 14 * MIN }) })]} props={{ onSkrivUt: vi.fn() }} />);
    oppna();
    expect(lage()).toBe("pagar");
    await gaTid(2 * MIN);
    expect(lage()).toBe("fel");
    expect(screen.getByRole("alert")).toHaveTextContent("Utskriften blev inte klar. Försök igen.");
  });

  it("har posten en text och en misslyckad omkörning visas texten kvar och Försök igen frågar först", () => {
    const onSkrivUtIgen = vi.fn();
    render(<Harness start={[ljud({ utskrift: "Kvar", utskriftJobb: pagar({ status: "fel", fel: "Nej." }) })]} props={{ onSkrivUtIgen }} />);
    oppna();
    expect(document.querySelector("[data-bibliotek-utskrift]")?.textContent).toBe("Kvar");
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Försök igen")));
    expect(screen.getByRole("dialog")).toHaveTextContent("Den nuvarande utskriften ersätts.");
    expect(onSkrivUtIgen).not.toHaveBeenCalled();
  });
});

describe("Skriv ut igen och Ta bort utskriften: bara med utskrift, behörighet och prop", () => {
  const props = () => ({ onSkrivUtIgen: vi.fn(() => Promise.resolve()), onTaBortUtskrift: vi.fn(() => Promise.resolve()) });
  const med = (/** @type {Record<string, unknown>} */ extra = {}) => [ljud({ utskrift: "Vers ett\nVers två", ...extra })];

  it("⛔ med utskrift, behörighet och båda propparna syns båda valen, bredvid Kopiera", () => {
    render(<Harness start={med()} props={props()} />);
    oppna();
    expect(knapp("Skriv ut igen")).toBeEnabled();
    expect(knapp("Ta bort utskriften")).toBeEnabled();
    expect(knapp("Kopiera")).toBeInTheDocument();
  });

  it("⛔ utan propp syns inte valet, var och en för sig", () => {
    const { unmount } = render(<Harness start={med()} props={{ onSkrivUtIgen: vi.fn() }} />);
    oppna();
    expect(knapp("Skriv ut igen")).toBeInTheDocument();
    expect(knapp("Ta bort utskriften")).toBeNull();
    unmount();
    render(<Harness start={med()} props={{ onTaBortUtskrift: vi.fn() }} />);
    oppna();
    expect(knapp("Skriv ut igen")).toBeNull();
    expect(knapp("Ta bort utskriften")).toBeInTheDocument();
  });

  it("⛔ utan utskrift syns inga val (det finns inget att ersätta eller ta bort), men Skriv ut texten gör det", () => {
    render(<Harness start={[ljud()]} props={{ ...props(), onSkrivUt: vi.fn() }} />);
    oppna();
    expect(knapp("Skriv ut igen")).toBeNull();
    expect(knapp("Ta bort utskriften")).toBeNull();
    expect(knapp("Skriv ut texten")).toBeInTheDocument();
  });

  it("⛔ en tom utskrift ('Utskriften är tom.') har bara Skriv ut texten, som förut", () => {
    render(<Harness start={[ljud({ utskrift: "" })]} props={{ ...props(), onSkrivUt: vi.fn() }} />);
    oppna();
    expect(knapp("Skriv ut igen")).toBeNull();
    expect(knapp("Ta bort utskriften")).toBeNull();
    expect(knapp("Skriv ut texten")).toBeInTheDocument();
  });

  it("⛔ utan behörighet (en annan medlem, inte författaren) syns inga val, men en admin i gruppen får dem", () => {
    const { unmount } = render(<Harness start={med()} jag={ANNAN_MEDLEM} props={props()} />);
    oppna();
    expect(document.querySelector("[data-bibliotek-utskrift]")?.textContent).toBe("Vers ett\nVers två");
    expect(knapp("Skriv ut igen")).toBeNull();
    expect(knapp("Ta bort utskriften")).toBeNull();
    unmount();
    render(<Harness start={med()} jag={ADMIN} props={props()} />);
    oppna();
    expect(knapp("Skriv ut igen")).toBeInTheDocument();
    expect(knapp("Ta bort utskriften")).toBeInTheDocument();
  });

  it("⛔ FRÅGAN KOMMER FÖRE ANROPET: Skriv ut igen frågar 'Den nuvarande utskriften ersätts.', och Avbryt anropar ingenting", async () => {
    const p = props();
    render(<Harness start={med()} props={p} />);
    oppna();
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Skriv ut igen")));
    const dialog = await dialogen();
    expect(dialog).toHaveTextContent("Den nuvarande utskriften ersätts.");
    expect(p.onSkrivUtIgen).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Avbryt" }));
    await flush();
    expect(p.onSkrivUtIgen).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    // Bekräftar man anropas den, med id och grupp.
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Skriv ut igen")));
    fireEvent.click(within(await dialogen()).getByRole("button", { name: "Skriv ut igen" }));
    await flush();
    expect(p.onSkrivUtIgen).toHaveBeenCalledTimes(1);
    expect(p.onSkrivUtIgen).toHaveBeenCalledWith({ id: "ljud", groupId: "cps-ab" });
    expect(p.onTaBortUtskrift).not.toHaveBeenCalled();
  });

  it("⛔ Ta bort utskriften frågar först, och anropar sedan med id och grupp", async () => {
    const p = props();
    render(<Harness start={med()} props={p} />);
    oppna();
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Ta bort utskriften")));
    const dialog = await dialogen();
    expect(dialog).toHaveTextContent("Utskriften tas bort. Ljudet finns kvar.");
    expect(p.onTaBortUtskrift).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Avbryt" }));
    await flush();
    expect(p.onTaBortUtskrift).not.toHaveBeenCalled();
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Ta bort utskriften")));
    fireEvent.click(within(await dialogen()).getByRole("button", { name: "Ta bort utskriften" }));
    await flush();
    expect(p.onTaBortUtskrift).toHaveBeenCalledTimes(1);
    expect(p.onTaBortUtskrift).toHaveBeenCalledWith({ id: "ljud", groupId: "cps-ab" });
  });

  it("⛔ EFTER BORTTAGNING KOMMER 'Skriv ut texten' tillbaka: när posten saknar utskrift är läget 'ingen'", async () => {
    const onTaBortUtskrift = vi.fn(() => Promise.resolve());
    render(<Harness start={med()} props={{ onTaBortUtskrift, onSkrivUt: vi.fn() }} />);
    oppna();
    expect(knapp("Skriv ut texten")).toBeNull();
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Ta bort utskriften")));
    fireEvent.click(within(await dialogen()).getByRole("button", { name: "Ta bort utskriften" }));
    await flush();
    // Servern har tagit emot det och tar bort fälten (UTSKRIFT_FALT); posten uppdateras.
    act(() => servern("ljud", { utskrift: undefined, utskriftJobb: undefined }));
    expect(document.querySelector("[data-bibliotek-utskrift]")).toBeNull();
    expect(lage()).toBe("ingen");
    expect(knapp("Skriv ut texten")).toBeEnabled();
    expect(knapp("Ta bort utskriften")).toBeNull();
    expect(knapp("Skriv ut igen")).toBeNull();
  });

  it("⛔ efter att servern tagit emot borttagningen står 'Tar bort utskriften…' och knapparna är avstängda tills posten ändras (eller väntetiden gått)", async () => {
    const p = props();
    render(<Harness start={med()} props={p} />);
    oppna();
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Ta bort utskriften")));
    fireEvent.click(within(await dialogen()).getByRole("button", { name: "Ta bort utskriften" }));
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("Tar bort utskriften…");
    expect(knapp("Ta bort utskriften")).toBeDisabled();
    expect(knapp("Skriv ut igen")).toBeDisabled();
    // Händer inget med posten släpper väntan efter UTSKRIFT_VANTETID_MS: en app som inte uppgraderats ska inte hänga.
    await gaTid(UTSKRIFT_VANTETID_MS + 100);
    expect(screen.queryByRole("status")).toBeNull();
    expect(knapp("Ta bort utskriften")).toBeEnabled();
  });

  it("Skriv ut igen: medan anropet pågår står 'Skriver ut…', och när servern lagt in jobbet övergår det till bakgrundsläget", async () => {
    /** @type {() => void} */ let los = () => {};
    const onSkrivUtIgen = vi.fn(() => new Promise((a) => { los = /** @type {() => void} */ (a); }));
    render(<Harness start={med()} props={{ onSkrivUtIgen, onTaBortUtskrift: vi.fn() }} />);
    oppna();
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Skriv ut igen")));
    fireEvent.click(within(await dialogen()).getByRole("button", { name: "Skriv ut igen" }));
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("Skriver ut…");
    expect(knapp("Skriv ut igen")).toBeDisabled();
    expect(knapp("Ta bort utskriften")).toBeDisabled();
    await act(async () => los());
    await flush();
    // Servern har tagit emot: posten får jobbet.
    act(() => servern("ljud", { utskriftJobb: pagar({ startad: NU }) }));
    expect(screen.getByRole("status")).toHaveTextContent("Skriver ut i bakgrunden.");
    expect(lage()).toBe("pagar");
    expect(knapp("Skriv ut igen")).toBeDisabled();
  });

  it("⛔ fel visas på samma sätt som för Skriv ut: orsaken står kvar och valen går att trycka igen", async () => {
    const onSkrivUtIgen = vi.fn(() => Promise.reject(new Error("Dygnstaket är nått.")));
    const onTaBortUtskrift = vi.fn(() => Promise.reject(new Error("Du får inte ändra den här posten.")));
    render(<Harness start={med()} props={{ onSkrivUtIgen, onTaBortUtskrift }} />);
    oppna();
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Skriv ut igen")));
    fireEvent.click(within(await dialogen()).getByRole("button", { name: "Skriv ut igen" }));
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("Dygnstaket är nått.");
    expect(knapp("Skriv ut igen")).toBeEnabled();
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Ta bort utskriften")));
    fireEvent.click(within(await dialogen()).getByRole("button", { name: "Ta bort utskriften" }));
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("Du får inte ändra den här posten.");
    expect(document.querySelector("[data-bibliotek-utskrift]")?.textContent).toBe("Vers ett\nVers två");
  });

  it("ett fel utan text får ramverkets eget ord", async () => {
    render(<Harness start={med()} props={{ onSkrivUtIgen: vi.fn(() => Promise.reject(new Error(""))) }} />);
    oppna();
    fireEvent.click(/** @type {HTMLElement} */ (knapp("Skriv ut igen")));
    fireEvent.click(within(await dialogen()).getByRole("button", { name: "Skriv ut igen" }));
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("Ljudet gick inte att skriva ut.");
  });
});
