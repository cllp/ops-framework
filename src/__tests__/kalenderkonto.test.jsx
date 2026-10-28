import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useKalenderSynlighet } from "../lib/useKalenderSynlighet.js";
import { createKalendervalskalla } from "../data/kalendervalskalla.js";
import { createMemorySource } from "../data/adapters.js";
import { registreraFelmottagare } from "../lib/felrapport.js";
import { kalenderSynlighetNyckel } from "../lib/kalendersynlighet.js";

/**
 * Kalendervalen följer kontot (0.151.0, CP 2026-10-28): "Väljer jag ram i mobilen syns det inte på datorn."
 *
 * ⛔ Provet mäter det en person upplever, med ett konto vars svar provet styr för hand (`styrbart`): att kontots värde ersätter det lokala, att det lokala lyfts en gång, att
 * ett tryck medan kontot hämtas inte förloras, att snabba tryck ger högst en skrivning i taget med det senaste sist, och att ett fel syns och aldrig rullar tillbaka valet.
 */

const KALENDRAR = [
  { id: "gruppen", namn: "Styrelsen" },
  { id: "apple", namn: "Apple" },
  { id: "arenden", namn: "Ärenden", avFranStart: true },
];
const NYCKEL = kalenderSynlighetNyckel("p:g");

/** Ett löfte provet löser eller avvisar själv. */
function utskjutet() {
  /** @type {(v?: any) => void} */ let ok = () => {};
  /** @type {(e?: any) => void} */ let fel = () => {};
  const lofte = new Promise((res, rej) => {
    ok = res;
    fel = rej;
  });
  return { lofte, ok, fel };
}

/** Lokalt minne som provet kan läsa i efterhand. */
function lokalt(/** @type {Record<string, any>} */ start = {}) {
  const varden = new Map(Object.entries(start).map(([k, v]) => [k, JSON.stringify(v)]));
  return { varden, getItem: (/** @type {string} */ n) => (varden.has(n) ? /** @type {string} */ (varden.get(n)) : null), setItem: (/** @type {string} */ n, /** @type {string} */ v) => void varden.set(n, v) };
}

/**
 * Ett konto vars läsning och skrivningar provet styr. `lasSvar` och `skrivSvar` är köer av utskjutna löften: varje anrop tar nästa, eller löses direkt när kön är tom.
 * @param {{ las?: any, lasHallen?: boolean, skrivHallen?: boolean }} [val] `lasHallen` och `skrivHallen` är kvar som tydlighet i anropen; det är `holdLas` och `holdSkriv` som håller ett anrop.
 */
function styrbart(val = {}) {
  /** @type {ReturnType<typeof utskjutet>[]} */ const lasKo = [];
  /** @type {ReturnType<typeof utskjutet>[]} */ const skrivKo = [];
  const stat = { las: 0, skriv: /** @type {any[]} */ ([]), iflygning: 0, mestIflygning: 0, ordning: /** @type {string[]} */ ([]) };
  let lasVarde = val.las ?? null;
  const konto = {
    las: () => {
      stat.las += 1;
      if (!val.lasHallen && lasKo.length === 0) return Promise.resolve(lasVarde);
      const d = lasKo.shift() ?? utskjutet();
      return d.lofte;
    },
    skriv: (/** @type {any} */ v) => {
      stat.skriv.push(JSON.parse(JSON.stringify(v)));
      stat.iflygning += 1;
      stat.mestIflygning = Math.max(stat.mestIflygning, stat.iflygning);
      const d = skrivKo.shift();
      const klart = d ? d.lofte : Promise.resolve();
      return klart.finally(() => {
        stat.iflygning -= 1;
      });
    },
  };
  return {
    konto,
    stat,
    /** Nästa läsning väntar på detta. */
    holdLas: () => {
      const d = utskjutet();
      lasKo.push(d);
      return d;
    },
    holdSkriv: () => {
      const d = utskjutet();
      skrivKo.push(d);
      return d;
    },
    sattLas: (/** @type {any} */ v) => {
      lasVarde = v;
    },
  };
}

/** @param {Record<string, any>} props */
function rita(props) {
  return renderHook((/** @type {any} */ p) => useKalenderSynlighet({ minne: "p:g", kalendrar: KALENDRAR, ...p }), { initialProps: props });
}
const tomrunda = () => act(async () => {});

/** @type {string[]} */
let fanget;
let avregistrera = () => {};
beforeEach(() => {
  fanget = [];
  avregistrera = registreraFelmottagare({ fanga: (fel, sammanhang) => void fanget.push(`${(/** @type {Error} */ (fel)).message} @ ${(/** @type {any} */ (sammanhang)).steg}`), satt: () => {} });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  avregistrera();
  vi.restoreAllMocks();
});

describe("läsa: kontot ersätter det lokala", () => {
  it("kalendern ritas direkt med det lokala och byter till kontots värde när det kommer, och skriver det till det lokala minnet", async () => {
    const lag = lokalt({ [NYCKEL]: { v: 1, syns: { apple: false }, visning: {} } });
    const k = styrbart({ las: { v: 1, syns: { arenden: true }, visning: { apple: "ram" } }, lasHallen: true });
    const hall = k.holdLas();
    const { result } = rita({ lagring: lag, konto: k.konto });
    // Före svaret: det lokala.
    expect(result.current.arSynlig("apple")).toBe(false);
    expect(result.current.arSynlig("arenden")).toBe(false);
    await act(async () => hall.ok({ v: 1, syns: { arenden: true }, visning: { apple: "ram" } }));
    // Efter: kontots, helt. Det lokala valet (apple av) är borta.
    expect(result.current.arSynlig("apple")).toBe(true);
    expect(result.current.arSynlig("arenden")).toBe(true);
    expect(result.current.visning("apple")).toBe("ram");
    await waitFor(() => expect(JSON.parse(/** @type {string} */ (lag.varden.get(NYCKEL)))).toEqual({ v: 1, syns: { arenden: true }, visning: { apple: "ram" } }));
    // ⛔ Kontots eget värde skrivs inte tillbaka till kontot.
    expect(k.stat.skriv).toEqual([]);
    expect(result.current.kontoFel).toBeNull();
  });

  it("⛔ ett dokument som finns vinner alltid, också ett tomt: 'Alla kalendrar' på en annan enhet", async () => {
    const lag = lokalt({ [NYCKEL]: { v: 1, syns: { apple: false }, visning: { apple: "ram" } } });
    const k = styrbart({ las: { v: 1, syns: {}, visning: {} } });
    const { result } = rita({ lagring: lag, konto: k.konto });
    await tomrunda();
    expect(result.current.arForval).toBe(true);
    expect(result.current.arSynlig("apple")).toBe(true);
    expect(result.current.visning("apple")).toBe("handelser");
    expect(k.stat.skriv).toEqual([]);
  });

  it("ett trasigt dokument på kontot är inget dokument: det lokala lyfts", async () => {
    const k = styrbart({ las: { v: 7, nonsens: true } });
    const lag = lokalt({ [NYCKEL]: { v: 1, syns: { apple: false }, visning: {} } });
    rita({ lagring: lag, konto: k.konto });
    await tomrunda();
    expect(k.stat.skriv).toEqual([{ v: 1, syns: { apple: false }, visning: {} }]);
  });
});

describe("första gången: de lokala valen lyfts upp en gång", () => {
  it("kontot har inget dokument och det lokala har val: de skrivs, en gång", async () => {
    const lag = lokalt({ [NYCKEL]: { v: 1, syns: { apple: false }, visning: { gruppen: "bada" } } });
    const k = styrbart({ las: null });
    const { result, rerender } = rita({ lagring: lag, konto: k.konto });
    await tomrunda();
    expect(k.stat.skriv).toEqual([{ v: 1, syns: { apple: false }, visning: { gruppen: "bada" } }]);
    // Och inget mer vid nästa ritning.
    rerender({ lagring: lag, konto: k.konto });
    await tomrunda();
    expect(k.stat.skriv).toHaveLength(1);
    expect(result.current.arSynlig("apple")).toBe(false);
  });

  it("⛔ ett tomt lokalt minne skriver ingenting: ett dokument som bara säger förval är inget val", async () => {
    const k = styrbart({ las: null });
    rita({ lagring: lokalt(), konto: k.konto });
    await tomrunda();
    expect(k.stat.las).toBe(1);
    expect(k.stat.skriv).toEqual([]);
  });
});

describe("ett tryck medan kontot hämtas förloras inte", () => {
  it("spelas upp ovanpå kontots värde, och skrivs en gång", async () => {
    const k = styrbart({ lasHallen: true });
    const hall = k.holdLas();
    const { result } = rita({ lagring: lokalt(), konto: k.konto });
    act(() => result.current.vaxla("apple")); // apple av, innan kontots värde är känt
    expect(result.current.arSynlig("apple")).toBe(false);
    await act(async () => hall.ok({ v: 1, syns: { gruppen: false }, visning: { arenden: "ram" } }));
    // Kontots val (gruppen av, ärenden ram) OCH trycket (apple av).
    expect(result.current.arSynlig("gruppen")).toBe(false);
    expect(result.current.arSynlig("apple")).toBe(false);
    expect(result.current.visning("arenden")).toBe("ram");
    await tomrunda();
    expect(k.stat.skriv).toEqual([{ v: 1, syns: { gruppen: false, apple: false }, visning: { arenden: "ram" } }]);
  });

  it("kontot har inget dokument: trycket är det som lyfts", async () => {
    const k = styrbart({ lasHallen: true });
    const hall = k.holdLas();
    const { result } = rita({ lagring: lokalt(), konto: k.konto });
    act(() => result.current.vaxla("apple"));
    await act(async () => hall.ok(null));
    await tomrunda();
    expect(k.stat.skriv).toEqual([{ v: 1, syns: { apple: false }, visning: {} }]);
  });
});

describe("skriva: direkt, optimistiskt, och aldrig tävlande", () => {
  it("ett tryck ändrar kalendern i samma tryck och skrivs till kontot efteråt", async () => {
    const k = styrbart({ las: null, skrivHallen: true });
    const { result } = rita({ lagring: lokalt(), konto: k.konto });
    await tomrunda();
    const hall = k.holdSkriv();
    act(() => result.current.vaxla("apple"));
    // Direkt: kalendern är ändrad medan skrivningen väntar.
    expect(result.current.arSynlig("apple")).toBe(false);
    await tomrunda();
    expect(k.stat.skriv).toEqual([{ v: 1, syns: { apple: false }, visning: {} }]);
    await act(async () => hall.ok());
    expect(result.current.kontoFel).toBeNull();
  });

  it("⛔ SNABBA TRYCK: högst en skrivning i taget, och den SISTA vinner", async () => {
    const k = styrbart({ las: null, skrivHallen: true });
    const { result } = rita({ lagring: lokalt(), konto: k.konto });
    await tomrunda();
    const forsta = k.holdSkriv();
    const andra = k.holdSkriv();
    act(() => result.current.vaxla("apple")); // skrivning 1 går iväg och väntar
    await tomrunda();
    expect(k.stat.skriv).toHaveLength(1);
    // Fem tryck medan den väntar: ingen ny skrivning startar.
    act(() => result.current.vaxla("gruppen"));
    act(() => result.current.valjVisning("apple", "ram"));
    act(() => result.current.vaxla("arenden"));
    act(() => result.current.valjVisning("apple", "bada"));
    act(() => result.current.vaxla("gruppen"));
    await tomrunda();
    expect(k.stat.skriv).toHaveLength(1);
    expect(k.stat.mestIflygning).toBe(1);
    // Första är klar: nu skrivs det senaste, en gång.
    await act(async () => forsta.ok());
    expect(k.stat.skriv).toHaveLength(2);
    expect(k.stat.skriv[1]).toEqual({ v: 1, syns: { apple: false, gruppen: true, arenden: true }, visning: { apple: "bada" } });
    await act(async () => andra.ok());
    await tomrunda();
    // Totalt två skrivningar för sex tryck, aldrig två i luften, och det som står på kontot är det senaste.
    expect(k.stat.skriv).toHaveLength(2);
    expect(k.stat.mestIflygning).toBe(1);
    expect(result.current.kontoFel).toBeNull();
  });

  it("⛔ ändras valet tillbaka medan en skrivning väntar skrivs det gamla igen: kontot slutar med det som visas", async () => {
    // Kontot har redan "apple på" uttryckligen, så att att trycka av och på igen ger EXAKT samma dokument som kontot hade.
    const k = styrbart({ las: { v: 1, syns: { apple: true }, visning: {} }, skrivHallen: true });
    const { result } = rita({ lagring: lokalt(), konto: k.konto });
    await tomrunda();
    const forsta = k.holdSkriv();
    k.holdSkriv();
    act(() => result.current.vaxla("apple")); // av: skrivs
    await tomrunda();
    expect(k.stat.skriv).toEqual([{ v: 1, syns: { apple: false }, visning: {} }]);
    act(() => result.current.vaxla("apple")); // på igen: lika med det som stod på kontot innan
    await tomrunda();
    await act(async () => forsta.ok());
    // Utan tillbaka-hanteringen hade kontot slutat med "apple av" medan skärmen visar "apple på".
    expect(k.stat.skriv).toHaveLength(2);
    expect(k.stat.skriv.at(-1)).toEqual({ v: 1, syns: { apple: true }, visning: {} });
    expect(result.current.arSynlig("apple")).toBe(true);
  });

  it("utan tryck skrivs ingenting: att öppna kalendern ändrar inte kontot", async () => {
    const k = styrbart({ las: { v: 1, syns: { apple: false }, visning: {} } });
    rita({ lagring: lokalt(), konto: k.konto });
    await tomrunda();
    await tomrunda();
    expect(k.stat.skriv).toEqual([]);
  });
});

describe("fel syns, aldrig tyst, och rullar aldrig tillbaka valet", () => {
  it("en skrivning som misslyckas: kontoFel 'skriv', rapporterat, valet står kvar, och nästa tryck försöker igen", async () => {
    const k = styrbart({ las: null, skrivHallen: true });
    const { result } = rita({ lagring: lokalt(), konto: k.konto });
    await tomrunda();
    k.holdSkriv().fel(new Error("Missing or insufficient permissions."));
    act(() => result.current.vaxla("apple"));
    await tomrunda();
    expect(result.current.kontoFel).toBe("skriv");
    expect(fanget).toEqual(["Missing or insufficient permissions. @ spara synlighet på kontot"]);
    // Det som ritades är det personen bad om.
    expect(result.current.arSynlig("apple")).toBe(false);
    // Nästa tryck skriver igen, med allt, och felet försvinner när det lyckas.
    act(() => result.current.vaxla("gruppen"));
    await tomrunda();
    expect(k.stat.skriv).toHaveLength(2);
    expect(k.stat.skriv[1]).toEqual({ v: 1, syns: { apple: false, gruppen: false }, visning: {} });
    expect(result.current.kontoFel).toBeNull();
  });

  it("sparaIgen skriver det senaste valet också utan ett nytt tryck", async () => {
    const k = styrbart({ las: null, skrivHallen: true });
    const { result } = rita({ lagring: lokalt(), konto: k.konto });
    await tomrunda();
    k.holdSkriv().fel(new Error("nätet"));
    act(() => result.current.vaxla("apple"));
    await tomrunda();
    expect(result.current.kontoFel).toBe("skriv");
    act(() => result.current.sparaIgen());
    await tomrunda();
    expect(k.stat.skriv).toHaveLength(2);
    expect(k.stat.skriv[1]).toEqual(k.stat.skriv[0]);
    expect(result.current.kontoFel).toBeNull();
  });

  it("⛔ en läsning som misslyckas: kontoFel 'las', det lokala står, INGET skrivs, och nästa tryck läser om först", async () => {
    const lag = lokalt({ [NYCKEL]: { v: 1, syns: { gruppen: false }, visning: {} } });
    const k = styrbart({ lasHallen: true });
    k.holdLas().fel(new Error("offline"));
    const { result } = rita({ lagring: lag, konto: k.konto });
    await tomrunda();
    expect(result.current.kontoFel).toBe("las");
    expect(result.current.arSynlig("gruppen")).toBe(false);
    expect(fanget).toEqual(["offline @ läsa synlighet från kontot"]);
    // Ett tryck medan kontot inte gick att läsa: läser om (nu lyckas det), spelar upp trycket ovanpå kontots värde, skriver.
    k.sattLas({ v: 1, syns: { arenden: true }, visning: {} });
    const lasning = k.holdLas();
    act(() => result.current.vaxla("apple"));
    expect(k.stat.skriv).toEqual([]);
    expect(k.stat.las).toBe(2);
    await act(async () => lasning.ok({ v: 1, syns: { arenden: true }, visning: {} }));
    await tomrunda();
    expect(result.current.kontoFel).toBeNull();
    // Kontots val (ärenden på) och trycket (apple av); det lokala "gruppen av" fanns aldrig på kontot och är borta: kontot vann.
    expect(result.current.arSynlig("gruppen")).toBe(true);
    expect(result.current.arSynlig("apple")).toBe(false);
    expect(result.current.arSynlig("arenden")).toBe(true);
    expect(k.stat.skriv).toEqual([{ v: 1, syns: { arenden: true, apple: false }, visning: {} }]);
  });

  it("sparaIgen efter ett läsfel läser om", async () => {
    const k = styrbart({ lasHallen: true });
    k.holdLas().fel(new Error("offline"));
    const { result } = rita({ lagring: lokalt(), konto: k.konto });
    await tomrunda();
    expect(result.current.kontoFel).toBe("las");
    const andra = k.holdLas();
    act(() => result.current.sparaIgen());
    await act(async () => andra.ok({ v: 1, syns: { apple: false }, visning: {} }));
    expect(result.current.kontoFel).toBeNull();
    expect(result.current.arSynlig("apple")).toBe(false);
  });

  it("en konto som kastar synkront är samma fel som ett löfte som avvisas", async () => {
    const konto = { las: () => { throw new Error("kastade"); }, skriv: () => { throw new Error("kastade"); } };
    const { result } = rita({ lagring: lokalt(), konto });
    await tomrunda();
    expect(result.current.kontoFel).toBe("las");
  });
});

describe("byta grupp och utan konto", () => {
  it("⛔ ett svar som kommer efter ett byte av grupp skrivs aldrig in i den nya gruppen, och lyfter aldrig den nya gruppens val genom den gamla kontot", async () => {
    const k1 = styrbart({ lasHallen: true });
    const sen = k1.holdLas();
    const k2 = styrbart({ las: { v: 1, syns: { gruppen: false }, visning: {} } });
    const { result, rerender } = rita({ minne: "p:g1", lagring: lokalt(), konto: k1.konto });
    // Den nya gruppen har egna lokala val och ett konto som redan svarat.
    rerender({ minne: "p:g2", lagring: lokalt({ [kalenderSynlighetNyckel("p:g2")]: { v: 1, syns: { gruppen: false }, visning: {} } }), konto: k2.konto });
    await tomrunda();
    expect(result.current.arSynlig("gruppen")).toBe(false);
    // Det sena svaret från den förra gruppen kommer nu, och det säger att kontot inget har: det vore dags att lyfta "det lokala", som nu är den NYA gruppens.
    await act(async () => sen.ok(null));
    await tomrunda();
    expect(result.current.arSynlig("gruppen")).toBe(false);
    expect(k1.stat.skriv).toEqual([]);
    expect(k2.stat.skriv).toEqual([]);
    // Och ett sent svar med ett dokument ändrar inte den nya gruppens val heller.
    const k3 = styrbart({ lasHallen: true });
    const sen3 = k3.holdLas();
    const ut = rita({ minne: "p:g3", lagring: lokalt(), konto: k3.konto });
    ut.rerender({ minne: "p:g4", lagring: lokalt(), konto: styrbart({ las: null }).konto });
    await tomrunda();
    await act(async () => sen3.ok({ v: 1, syns: { apple: false }, visning: {} }));
    expect(ut.result.current.arSynlig("apple")).toBe(true);
  });

  it("⛔ utan konto är allt som förut: bara det lokala minnet, och inga fel", async () => {
    const lag = lokalt();
    const { result } = rita({ lagring: lag });
    act(() => result.current.vaxla("apple"));
    await tomrunda();
    expect(JSON.parse(/** @type {string} */ (lag.varden.get(NYCKEL)))).toEqual({ v: 1, syns: { apple: false }, visning: {} });
    expect(result.current.kontoFel).toBeNull();
    act(() => result.current.sparaIgen());
  });

  it("utan minne finns ingen nyckel att knyta kontot till: kontot används inte", async () => {
    const k = styrbart({ las: null });
    rita({ minne: "", lagring: lokalt(), konto: k.konto });
    await tomrunda();
    expect(k.stat.las).toBe(0);
  });
});

describe("visa bara den här följer kontot som vilket val som helst", () => {
  it("skrivs med 'före', och en annan enhet kan ta tillbaka det", async () => {
    const kalla = createKalendervalskalla({ kalla: createMemorySource(), kalenderval: "kalenderval" });
    const enhetA = rita({ lagring: lokalt(), konto: kalla.konto("uid-1", "g") });
    await tomrunda();
    act(() => enhetA.result.current.vaxla("arenden")); // ärenden på
    act(() => enhetA.result.current.visaBara("apple"));
    await waitFor(async () => expect((await kalla.las("uid-1", "g"))?.fore).toBeDefined());

    // Datorn: en annan webbläsare, tomt lokalt minne, samma konto.
    const enhetB = rita({ lagring: lokalt(), konto: kalla.konto("uid-1", "g") });
    await waitFor(() => expect(enhetB.result.current.synliga).toEqual(["apple"]));
    expect(enhetB.result.current.arEnsam("apple")).toBe(true);
    act(() => enhetB.result.current.visaBara("apple"));
    await waitFor(() => expect(enhetB.result.current.synliga).toEqual(["gruppen", "apple", "arenden"]));
    // Och telefonen får tillbaka-läget när den läser om.
    await waitFor(async () => expect((await kalla.las("uid-1", "g"))?.fore).toBeUndefined());
  });
});

describe("⛔ en flik som blir synlig läser om kontot", () => {
  /** @param {"visible" | "hidden"} lage */
  const byt = (lage) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => lage });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
  };
  afterEach(() => byt("visible"));

  it("tar kontots nyare värde, så att fliken inte skriver sitt gamla läge över det som valts på en annan enhet", async () => {
    const k = styrbart({ las: { v: 1, syns: { apple: false }, visning: {} } });
    const { result } = rita({ lagring: lokalt(), konto: k.konto });
    await tomrunda();
    expect(result.current.arSynlig("apple")).toBe(false);
    // Telefonen ändrar kontot medan datorns flik står öppen.
    k.sattLas({ v: 1, syns: { apple: false, gruppen: false }, visning: { apple: "ram" } });
    byt("hidden");
    expect(k.stat.las).toBe(1);
    byt("visible");
    await tomrunda();
    expect(k.stat.las).toBe(2);
    expect(result.current.arSynlig("gruppen")).toBe(false);
    expect(result.current.visning("apple")).toBe("ram");
    // Och en omläsning är ingen ändring av kontot.
    expect(k.stat.skriv).toEqual([]);
    // Nästa tryck på datorn bygger på det nya läget, inte det gamla.
    act(() => result.current.vaxla("arenden"));
    await tomrunda();
    expect(k.stat.skriv).toEqual([{ v: 1, syns: { apple: false, gruppen: false, arenden: true }, visning: { apple: "ram" } }]);
  });

  it("⛔ aldrig över ett osparat val: efter ett skrivfel står fliken kvar vid sitt eget", async () => {
    const k = styrbart({ las: { v: 1, syns: {}, visning: {} }, skrivHallen: true });
    const { result } = rita({ lagring: lokalt(), konto: k.konto });
    await tomrunda();
    k.holdSkriv().fel(new Error("nätet"));
    act(() => result.current.vaxla("apple"));
    await tomrunda();
    expect(result.current.kontoFel).toBe("skriv");
    k.sattLas({ v: 1, syns: { gruppen: false }, visning: {} });
    byt("visible");
    await tomrunda();
    expect(result.current.arSynlig("apple")).toBe(false);
    expect(result.current.arSynlig("gruppen")).toBe(true);
  });

  it("ett tryck medan omläsningen väntar vinner över den", async () => {
    const k = styrbart({ las: { v: 1, syns: {}, visning: {} }, lasHallen: false });
    const { result } = rita({ lagring: lokalt(), konto: k.konto });
    await tomrunda();
    const hall = k.holdLas();
    byt("visible");
    act(() => result.current.vaxla("apple"));
    await act(async () => hall.ok({ v: 1, syns: { gruppen: false }, visning: {} }));
    expect(result.current.arSynlig("apple")).toBe(false);
    expect(result.current.arSynlig("gruppen")).toBe(true);
  });

  it("ett fel i omläsningen rapporteras men syns inte i listan, och utan konto händer ingenting", async () => {
    const k = styrbart({ lasHallen: true });
    const forsta = k.holdLas();
    const { result } = rita({ lagring: lokalt(), konto: k.konto });
    await act(async () => forsta.ok({ v: 1, syns: {}, visning: {} }));
    k.holdLas().fel(new Error("offline"));
    byt("visible");
    await tomrunda();
    expect(result.current.kontoFel).toBeNull();
    expect(fanget).toEqual(["offline @ läsa om synlighet från kontot"]);
    const utan = rita({ lagring: lokalt() });
    byt("visible");
    expect(utan.result.current.kontoFel).toBeNull();
  });
});
