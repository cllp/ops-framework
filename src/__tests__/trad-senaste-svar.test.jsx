import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsMeddelanden, OpsSamtal, tradknappKlass } from "../components/OpsMeddelanden.jsx";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createFirestoreSource } from "../data/firestore.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { formatDateTime, formatTime } from "../lib/format.js";
import { GASTGRUPPATGARDER } from "../lib/gast.js";
import { synligText } from "../lib/samtal.js";

/**
 * 0.203.0, CP 2026-11-08 ("Går på din rekommendation. Kör!"): trådarna stannar i sin panel, och tre saker ändras.
 *
 *   1. Märket under en rot visar det senaste svaret: "1 svar · Collan: "Starkaste öppningen…" · 16.07". Källan har `senasteSvar(sid, tid)`,
 *      en läsning med `limit: 1` som görs när antalet räknas och aldrig annars. Inget lagras på tråden.
 *   2. Pilen bredvid "N svar" (Svara med citat) har samma hovring som märket: CP "Hover på pilen i svar i chatten är inte samma som svar."
 *   3. Det egna svaret i tråden står direkt: CP "Det var också en fördröjning på svar i tråden. Så jag fattade först inte var mitt trådsvar
 *      blev av." Läst ur koden: tråden läste (och för det första svaret skrev) tråden före meddelandet, medan gruppchatten skriver direkt.
 *
 * ⛔ jsdom kör ingen CSS. Att raden kortas och ryms i 390 px mäts i Chromium av `check:skalyta` 29 (e). Här mäts vad som står och vilka klasser som bär det.
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4): varje prov är kört mot 0.203.0 före den här skivan. Vilka som faller där, och vilka som är vakter för att
 * ingenting ändrats (och därför sågs falla mot en inplanterad mutation i stället), står i CHANGELOG under 0.203.0.
 */

configure({ asyncUtilTimeout: 15000 });
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "cecilia", namn: "Cecilia Berg", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];

/** Tiden som märket och inkorgen skriver den: klockslaget i dag, annars datum och tid. @param {number} tid */
const sagdTid = (tid) => (new Date(tid).toDateString() === new Date().toDateString() ? formatTime(tid, { locale: "sv-SE" }) : formatDateTime(tid, { locale: "sv-SE" }));

/** @param {{ kalla?: any }} [val] */
async function underlag(val = {}) {
  let t = Date.now() - 600000;
  const kalla = val.kalla ?? createMemorySource({});
  const samtal = /** @type {any} */ (createSamtalskalla({ kalla, klocka: () => (t += 1000), tradar: "tradar" }));
  const g = await samtal.oppnaGrupp({ groupId: "g", uid: "anna" });
  const rot = await samtal.skicka(g.id, { text: "Budgeten för Q3, hur ser den ut?", av: "cecilia" });
  const utan = await samtal.skicka(g.id, { text: "Fika på fredag?", av: "bo" });
  await samtal.skickaITrad(g.id, rot.id, { text: "Den ser tight ut", av: "bo" });
  await samtal.skickaITrad(g.id, rot.id, { text: "@Agent kan du sammanfatta?", av: "anna" });
  const sista = await samtal.skickaITrad(g.id, rot.id, { text: "Marginalen är 5,6 procent.", av: "ops" });
  return { kalla, samtal, grupp: g, rot, utan, sista };
}

/** En spärr som ett prov släpper när det vill. */
function sparr() {
  /** @type {() => void} */
  let slapp = () => {};
  const p = new Promise((r) => {
    slapp = () => r(undefined);
  });
  return { p, slapp: () => slapp() };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("senasteSvar i källan", () => {
  it("⛔ minnesadaptern: det nyaste svaret, och null för en tråd utan svar och en som inte finns", async () => {
    const { samtal, grupp, rot, utan, sista } = await underlag();
    expect(await samtal.senasteSvar(grupp.id, rot.id)).toMatchObject({ id: sista.id, text: "Marginalen är 5,6 procent.", av: "ops", tid: sista.tid });
    expect(await samtal.senasteSvar(grupp.id, utan.id)).toBeNull();
    // En tråd som skapats men vars första svar föll finns inte: en tråd skapas med sitt första svar. En okänd nyckel är samma fall.
    expect(await samtal.senasteSvar(grupp.id, "finns-inte")).toBeNull();
  });

  it("⛔ Firestore-adaptern: en fråga på tid fallande med limit 1 under trådens meddelanden, och null när den är tom", async () => {
    /** @type {any[]} */
    const fragor = [];
    let svar = [{ id: "m9", data: () => ({ text: "Senast", av: "bo", tid: 9 }) }];
    const sdk = {
      collection: (/** @type {any} */ _d, /** @type {string} */ c) => ({ c }),
      doc: () => ({}),
      getDoc: async () => ({ exists: () => false }),
      getDocs: async (/** @type {any} */ q) => {
        fragor.push(q);
        return { docs: svar };
      },
      addDoc: async () => ({ id: "x" }), setDoc: async () => {}, updateDoc: async () => {}, deleteDoc: async () => {},
      query: (/** @type {any} */ c, /** @type {any[]} */ ...villkor) => ({ c: c.c, villkor }),
      where: (/** @type {any[]} */ ...a) => ({ where: a }),
      orderBy: (/** @type {string} */ f, /** @type {string} */ d) => ({ orderBy: [f, d] }),
      limit: (/** @type {number} */ n) => ({ limit: n }),
      onSnapshot: () => () => {},
    };
    const s = /** @type {any} */ (createSamtalskalla({ kalla: createFirestoreSource({ db: {}, sdk }), tradar: "tradar" }));
    expect(await s.senasteSvar("s1", "t1")).toEqual({ id: "m9", text: "Senast", av: "bo", tid: 9 });
    expect(fragor).toHaveLength(1);
    expect(fragor[0].c).toBe("samtal/s1/tradar/t1/meddelanden");
    expect(fragor[0].villkor).toEqual([{ orderBy: ["tid", "desc"] }, { limit: 1 }]);
    svar = [];
    expect(await s.senasteSvar("s1", "t1")).toBeNull();
  });

  it("⛔ ett svar i en tråd källan sett läser inte tråden först (orsaken till fördröjningen)", async () => {
    const bas = createMemorySource({});
    /** @type {string[]} */
    const lasta = [];
    const kalla = /** @type {any} */ ({ ...bas, read: async (/** @type {string} */ c, /** @type {string} */ id) => (lasta.push(`${c}/${id}`), bas.read(c, id)) });
    const s = /** @type {any} */ (createSamtalskalla({ kalla, tradar: "tradar" }));
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    const rot = await s.skicka(g.id, { text: "Rot", av: "anna" });
    await s.skickaITrad(g.id, rot.id, { text: "Första", av: "bo" });
    lasta.length = 0;
    await s.skickaITrad(g.id, rot.id, { text: "Andra", av: "bo" });
    expect(lasta.filter((v) => v.includes("/tradar/"))).toEqual([]);
    // Båda svaren är skrivna (utan klocka kan de ha samma millisekund, därför utan ordning).
    expect((await s.tradmeddelanden(g.id, rot.id)).map((/** @type {any} */ m) => m.text).sort()).toEqual(["Andra", "Första"]);
    // En annan källa, samma lagring: tråden är okänd för den, och då läses den först, som förut.
    const annan = /** @type {any} */ (createSamtalskalla({ kalla, tradar: "tradar" }));
    lasta.length = 0;
    await annan.skickaITrad(g.id, rot.id, { text: "Tredje", av: "anna" });
    expect(lasta.filter((v) => v.includes("/tradar/"))).toEqual([`samtal/${g.id}/tradar/${rot.id}`]);
  });

  it("⛔ onLokal får svaret med det id det lagras under, innan källan rörs", async () => {
    const bas = createMemorySource({});
    /** @type {string[]} */
    const hande = [];
    const kalla = /** @type {any} */ ({
      ...bas,
      read: async (/** @type {string} */ c, /** @type {string} */ id) => (hande.push("read"), bas.read(c, id)),
      create: async (/** @type {string} */ c, /** @type {any} */ d) => (hande.push("create"), bas.create(c, d)),
    });
    const s = /** @type {any} */ (createSamtalskalla({ kalla, tradar: "tradar" }));
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    const rot = await s.skicka(g.id, { text: "Rot", av: "anna" });
    hande.length = 0;
    /** @type {any} */
    let lokal = null;
    const ny = await s.skickaITrad(g.id, rot.id, { text: "Hej", av: "bo" }, { onLokal: (/** @type {any} */ m) => { hande.push("lokal"); lokal = m; } });
    expect(hande[0]).toBe("lokal");
    expect(lokal).toMatchObject({ id: ny.id, text: "Hej", av: "bo", tid: ny.tid });
    expect((await s.tradmeddelanden(g.id, rot.id)).map((/** @type {any} */ m) => m.id)).toEqual([ny.id]);
  });
});

describe("märket visar det senaste svaret", { timeout: 30000 }, () => {
  it("⛔ avsändaren, utdraget och tiden på samma rad, och i beskrivningen; namnet är antalet som förut", async () => {
    const { samtal, grupp, rot, sista } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} />);
    const marke = await screen.findByRole("button", { name: "3 svar" });
    const tid = sagdTid(sista.tid);
    await waitFor(() => expect(marke.textContent).toBe(`3 svar · Ops-agenten: "Marginalen är 5,6 procent." · ${tid}`));
    expect(marke).toHaveAttribute("data-tradrot", rot.id);
    expect(marke).toHaveAccessibleDescription(`Meddelande från Cecilia Berg: Budgeten för Q3, hur ser den ut? Senaste svaret från Ops-agenten, ${tid}: Marginalen är 5,6 procent.`);
    // En rad som kortas, aldrig två: utdraget står i samma span som antalet och bär `truncate` och `min-w-0`.
    const rad = /** @type {HTMLElement} */ (within(marke).getByText(/Ops-agenten/));
    expect(rad.className.split(/\s+/)).toEqual(expect.arrayContaining(["min-w-0", "truncate"]));
    expect(marke.className.split(/\s+/)).toContain("max-w-full");
  });

  it("⛔ ett långt svar kortas till 60 tecken, och det egna heter Du", async () => {
    const { samtal, grupp, rot } = await underlag();
    const lang = `Starkaste öppningen vi haft i år, men vi behöver prata om andra halvan av setet ${"och lite till ".repeat(10)}`;
    const mitt = await samtal.skickaITrad(grupp.id, rot.id, { text: lang, av: "anna" });
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} />);
    const marke = await screen.findByRole("button", { name: "4 svar" });
    const kort = synligText(mitt, 60);
    expect(kort.length).toBe(60);
    expect(kort.endsWith("…")).toBe(true);
    await waitFor(() => expect(marke.textContent).toBe(`4 svar · Du: "${kort}" · ${sagdTid(mitt.tid)}`));
    expect(marke.textContent).not.toContain(lang.trim());
  });

  it("⛔ utan senasteSvar i källan är märket som före 0.203.0", async () => {
    const { samtal, grupp } = await underlag();
    const utan = /** @type {any} */ ({ ...samtal, senasteSvar: undefined });
    render(<OpsMeddelanden kalla={utan} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} />);
    const marke = await screen.findByRole("button", { name: "3 svar" });
    await waitFor(() => expect(marke.textContent).toBe("3 svar"));
    expect(marke).toHaveAccessibleDescription("Meddelande från Cecilia Berg: Budgeten för Q3, hur ser den ut?");
  });

  it("⛔ ett senaste svar som saknas eller inte har något att visa ger ingen rad, inte en tom", async () => {
    for (const senaste of [null, { id: "x", av: "bo", tid: Date.now(), text: "   " }]) {
      const { samtal, grupp } = await underlag();
      const k = /** @type {any} */ ({ ...samtal, senasteSvar: async () => senaste });
      const { unmount } = render(<OpsMeddelanden kalla={k} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} />);
      const marke = await screen.findByRole("button", { name: "3 svar" });
      await new Promise((r) => setTimeout(r, 50));
      expect(marke.textContent).toBe("3 svar");
      expect(marke.textContent).not.toContain(":");
      unmount();
    }
  });
});

describe("det egna svaret i tråden", { timeout: 30000 }, () => {
  it("⛔ står direkt med Skickas… medan skrivningen väntar, och en gång när den är klar", async () => {
    const bas = createMemorySource({});
    let halla = /** @type {null | ReturnType<typeof sparr>} */ (null);
    const kalla = /** @type {any} */ ({
      ...bas,
      create: async (/** @type {string} */ c, /** @type {any} */ d) => {
        if (halla && c.includes("/tradar/") && c.endsWith("/meddelanden")) await halla.p;
        return bas.create(c, d);
      },
    });
    const { samtal, grupp, rot } = await underlag({ kalla });
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} valtTrad={rot.id} />);
    const logg = await screen.findByRole("log", { name: "Budgeten för Q3, hur ser den ut?" });
    await within(logg).findByText("Marginalen är 5,6 procent.");
    halla = sparr();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), "Jag tar den{Enter}");
    // Medan skrivningen väntar: svaret står i tråden, med Skickas…, och utan åtgärder som pekar på ett meddelande som inte finns än.
    const bubbla = await within(logg).findByText("Jag tar den");
    const rad = /** @type {HTMLElement} */ (bubbla.closest("[data-meddelande]"));
    expect(rad).toHaveAttribute("data-vantar");
    expect(within(rad).getByRole("status")).toHaveTextContent("Skickas…");
    expect(rad.querySelector("[data-reagera], [data-fast], [data-citera]")).toBeNull();
    expect(within(logg).getByText("4 svar")).toBeInTheDocument();
    await act(async () => {
      halla?.slapp();
    });
    await waitFor(() => expect(logg.querySelector("[data-skickas]")).toBeNull());
    expect(within(logg).getAllByText("Jag tar den")).toHaveLength(1);
    expect(logg.querySelector("[data-vantar]")).toBeNull();
    expect((await samtal.tradmeddelanden(grupp.id, rot.id)).filter((/** @type {any} */ m) => m.text === "Jag tar den")).toHaveLength(1);
  });

  it("⛔ med en lyssnare: står en gång, före och efter att källans rad kommit, i båda ordningarna", async () => {
    for (const ordning of ["lyssnaren-forst", "svaret-forst"]) {
      const bas = createMemorySource({});
      /** @type {Set<() => void>} */
      const lyssnare = new Set();
      const signal = () => {
        for (const l of [...lyssnare]) l();
      };
      let halla = /** @type {null | ReturnType<typeof sparr>} */ (null);
      /** @type {null | (() => void)} */
      let signalera = null;
      // "lyssnaren-forst" är Firestores ordning: den lokala skrivningen når lyssnaren innan servern svarat. "svaret-forst": skrivningen
      // svarar, och lyssnaren hör av sig först när provet säger till (`signalera`).
      const kalla = /** @type {any} */ ({
        ...bas,
        /** @param {string} c @param {any} q @param {{ onData: (r: any[]) => void, onError: (e: Error) => void }} l */
        subscribe(c, q, l) {
          let oppen = true;
          const las = () => {
            bas.list(c, q).then((r) => oppen && l.onData(r), (e) => oppen && l.onError(e));
          };
          lyssnare.add(las);
          las();
          return () => {
            oppen = false;
            lyssnare.delete(las);
          };
        },
        create: async (/** @type {string} */ c, /** @type {any} */ d) => {
          const rad = await bas.create(c, d);
          if (!halla || !c.includes("/tradar/") || !c.endsWith("/meddelanden")) {
            signal();
            return rad;
          }
          if (ordning === "lyssnaren-forst") signal();
          else signalera = signal;
          await halla.p;
          return rad;
        },
      });
      const { samtal, grupp, rot } = await underlag({ kalla });
      const { unmount } = render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} valtTrad={rot.id} />);
      const logg = await screen.findByRole("log", { name: "Budgeten för Q3, hur ser den ut?" });
      await within(logg).findByText("Marginalen är 5,6 procent.");
      halla = sparr();
      const falt = screen.getByRole("textbox", { name: "Skriv ett meddelande" });
      fireEvent.change(falt, { target: { value: `Svar ${ordning}` } });
      fireEvent.keyDown(falt, { key: "Enter" });
      await within(logg).findByText(`Svar ${ordning}`);
      expect(within(logg).getAllByText(`Svar ${ordning}`)).toHaveLength(1);
      await act(async () => {
        halla?.slapp();
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(within(logg).getAllByText(`Svar ${ordning}`)).toHaveLength(1);
      if (signalera) {
        await act(async () => {
          /** @type {() => void} */ (/** @type {unknown} */ (signalera))();
          await new Promise((r) => setTimeout(r, 20));
        });
      }
      await waitFor(() => expect(logg.querySelector("[data-skickas]")).toBeNull());
      expect(within(logg).getAllByText(`Svar ${ordning}`)).toHaveLength(1);
      unmount();
    }
  });

  it("⛔ föll skrivningen står svaret inte kvar som skickat, och felet sägs", async () => {
    const bas = createMemorySource({});
    let neka = false;
    const kalla = /** @type {any} */ ({
      ...bas,
      create: async (/** @type {string} */ c, /** @type {any} */ d) => {
        if (neka && c.includes("/tradar/") && c.endsWith("/meddelanden")) throw new Error("permission-denied");
        return bas.create(c, d);
      },
    });
    const { samtal, grupp, rot } = await underlag({ kalla });
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} valtTrad={rot.id} />);
    const logg = await screen.findByRole("log", { name: "Budgeten för Q3, hur ser den ut?" });
    await within(logg).findByText("Marginalen är 5,6 procent.");
    neka = true;
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), "Nekat svar{Enter}");
    await within(logg).findByText("permission-denied");
    expect(within(logg).queryByText("Nekat svar")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Skriv ett meddelande" })).toHaveValue("Nekat svar");
  });

  it("⛔ märket i chatten visar svaret direkt efter tillbaka, ett mer och som det senaste, innan det räknats om", async () => {
    const { samtal, grupp } = await underlag();
    /** @type {null | ReturnType<typeof sparr>} */
    let halla = null;
    const k = /** @type {any} */ ({
      ...samtal,
      antalSvar: async (/** @type {string} */ sid, /** @type {string} */ tid) => {
        if (halla) await halla.p;
        return samtal.antalSvar(sid, tid);
      },
    });
    render(<OpsMeddelanden kalla={k} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "3 svar" }));
    const logg = await screen.findByRole("log", { name: "Budgeten för Q3, hur ser den ut?" });
    await within(logg).findByText("Marginalen är 5,6 procent.");
    await user.type(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), "Mitt svar{Enter}");
    await waitFor(() => expect(within(logg).getAllByText("Mitt svar")).toHaveLength(1));
    await waitFor(() => expect(logg.querySelector("[data-skickas]")).toBeNull());
    halla = sparr();
    await user.click(screen.getByRole("button", { name: "Alfa AB" }));
    const marke = await screen.findByRole("button", { name: "4 svar" });
    expect(marke.textContent).toMatch(/^4 svar · Du: "Mitt svar" · /);
    await act(async () => {
      halla?.slapp();
    });
    await waitFor(() => expect(marke.textContent).toMatch(/^4 svar · Du: "Mitt svar" · /));
    expect(screen.getByRole("button", { name: "4 svar" })).toBe(marke);
  });
});

describe("pilen bredvid N svar hovrar som märket", () => {
  /** Klasser som fyller en bakgrund vid hovring. @param {string} klass */
  const fyllning = (klass) => klass.split(/\s+/).filter((k) => /^(?:[a-z-]+:)*hover:bg-/.test(k));
  /** De klasser märket har för hovring, fokus, rundning och övergång. */
  const markets = tradknappKlass(false)
    .split(/\s+/)
    .filter((k) => /^(?:hover:text-|focus-visible:|rounded-|transition-|duration-|ease-)/.test(k));

  it("⛔ Svara med citat: ingen fylld cirkel, och samma färgbyte, fokusram, rundning och övergång som märket", async () => {
    expect(markets.length).toBeGreaterThanOrEqual(6); // golv: jämförelsen har något att jämföra
    const s = /** @type {any} */ (createSamtalskalla({ kalla: createMemorySource({}), citat: true }));
    const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
    await s.skicka(p.id, { text: "Lunch i morgon?", av: "bo" });
    render(<OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo Lind" namnFor={(/** @type {string} */ u) => (u === "bo" ? "Bo Lind" : "Anna Ek")} medlemmar={MEDLEMMAR} />);
    await screen.findByText("Lunch i morgon?");
    const pil = /** @type {HTMLElement} */ (document.querySelector("[data-citera]"));
    expect(pil).not.toBeNull();
    expect(fyllning(pil.className)).toEqual([]);
    expect(pil.className.split(/\s+/)).toEqual(expect.arrayContaining(markets));
    // Träffytan står kvar: 44 px, och bara på dator.
    expect(pil.className.split(/\s+/)).toEqual(expect.arrayContaining(["size-11", "hidden", "md:inline-flex"]));
  });

  it("⛔ gästens N svar är medlemmens märke, med samma klasser, inte en knapp som fyller en ruta", async () => {
    const T = (/** @type {number} */ m) => Date.UTC(2026, 9, 19, 9, m);
    const meddelanden = [
      { id: "m1", av: { namn: "Agda Ägare" }, text: "Välkommen", tid: T(0), svar: 2 },
      { id: "m2", av: { namn: "Maja Medlem" }, text: "Hej alla", tid: T(5) },
    ];
    const api = Object.fromEntries(
      GASTGRUPPATGARDER.map((a) => [a, vi.fn(async () => (a === "chatt" ? { ok: true, meddelanden, fler: false } : { ok: false, orsak: "nej" }))]),
    );
    render(<OpsGastGrupp grupp={{ namn: "Källan", funktioner: ["chatt"] }} api={api} intervallMs={0} idag={new Date(2026, 9, 20)} />);
    const flik = screen.queryByRole("tab", { name: "Chatt" });
    if (flik) {
      await act(async () => {
        fireEvent.mouseDown(flik, { button: 0 });
      });
    }
    await screen.findByText("Välkommen", { selector: "[data-bubbla] *" });
    const svar = /** @type {HTMLElement} */ (document.querySelector("[data-gast-chatt-svar='m1']"));
    expect(svar.tagName).toBe("BUTTON");
    expect(svar.className).toBe(tradknappKlass(true));
    expect(fyllning(svar.className)).toEqual([]);
    expect(svar).toHaveTextContent("2 svar");
  });
});
