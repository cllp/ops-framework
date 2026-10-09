import { afterAll, describe, expect, it, vi } from "vitest";
import { act, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import userEvent from "@testing-library/user-event";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla, harTradar } from "../data/samtalskalla.js";
import { createFirestoreSource } from "../data/firestore.js";
import { AUTONAMN_LANGD, MAX_TRADNAMN, NAMNLOS_TRAD, TRADFALT, autonamn, byggTrad, kravTradnamn, rensaForNamn, tradensNamn } from "../lib/samtal.js";
import { samtalsregelfragment } from "../lib/regler.js";
import * as nod from "../node/index.js";

/**
 * Trådar i gruppchatten (0.68.0, cllp/lifehub.app#60): namnregeln, källan och vyn, mot minnesadaptern.
 *
 * ⛔ HÄR MÄTS BETEENDE: vilket namn en tråd får, att tråden skapas med det första svaret och inte när den öppnas, att märket
 * visar antal och namn, att omdöpning och återgång fungerar, och att trådar bara finns i gruppchatten. Hur det SER UT mäts i
 * Chromium av `check-skalyta` avsnitt 29 (e). Reglerna mäts i `rules/__tests__/tradar.test.mjs`.
 *
 * ⛔ FINDBY-GRÄNSEN (#282). Testing Librarys `asyncUtilTimeout` är 1000 ms, och det är den som löper ut, inte Vitests
 * `testTimeout`. Mätt 2026-10-06: 7 av 8 körningar av den här filen föll på "Found multiple elements" eller tidsgränsen
 * för `findByRole`, och `--testTimeout=30000` ändrade ingenting. Med 15 sekunder blev tre av tre gröna. Gränsen sätts
 * här och inte i `setup.js`: en misslyckad `findBy` i en annan fil ska inte vänta en kvart. Vitests eget tak för de
 * två suiterna som ritar vyn ligger över den, annars dödar det väntan innan den får löpa ut.
 */
configure({ asyncUtilTimeout: 15000 });
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

describe("namnregeln: ett begripligt namn ur frågan, ingen modell", () => {
  it("⛔ rotmeddelandet utan @-nämnanden, länkar och markdowntecken", () => {
    expect(autonamn([{ text: "@Agent kan du **sammanfatta** budgeten för Q3? https://example.com/x" }])).toBe("Kan du sammanfatta budgeten för Q3?");
    expect(rensaForNamn("\n\n  # Rubrik\nandra raden")).toBe("Rubrik");
    expect(rensaForNamn("kalle@agent.se skrev")).toBe("Kalle@agent.se skrev");
  });
  it("⛔ ett för kort rotmeddelande får nästa till hjälp, ett långt nog gör det inte", () => {
    expect(autonamn([{ text: "Kolla här" }, { text: "Avtalet med hyresvärden löper ut" }, { text: "tredje" }])).toBe("Kolla här / Avtalet med hyresvärden löper ut");
    expect(autonamn([{ text: "Budgeten för Q3, hur ser den ut?" }, { text: "Tight" }])).toBe("Budgeten för Q3, hur ser den ut?");
  });
  it("⛔ kortas vid ett ordslut, aldrig längre än gränsen", () => {
    const lang = "Vi behöver bestämma hur vi gör med resan till Göteborg nästa månad och vem som bokar hotellet";
    const n = autonamn([{ text: lang }]);
    expect(n.length).toBeLessThanOrEqual(AUTONAMN_LANGD);
    expect(n.endsWith("…")).toBe(true);
    expect(lang.startsWith(n.slice(0, -1))).toBe(true);
    expect(autonamn([{ text: "x".repeat(200) }])).toHaveLength(AUTONAMN_LANGD);
  });
  it("⛔ tomhet är ett svar: inget namn blir ett utskrivet namn (regel 5)", () => {
    expect(autonamn([])).toBe(NAMNLOS_TRAD);
    expect(autonamn([{ text: "@Agent" }, { text: "https://x.se" }, { text: undefined }])).toBe(NAMNLOS_TRAD);
  });
  it("⛔ ett satt namn vinner, ett tomt ger det härledda igen", () => {
    const ms = [{ text: "Budgeten för Q3, hur ser den ut?" }];
    expect(tradensNamn({ namn: "Q3-budget" }, ms)).toBe("Q3-budget");
    expect(tradensNamn({ namn: "   " }, ms)).toBe("Budgeten för Q3, hur ser den ut?");
    expect(tradensNamn(null, ms)).toBe("Budgeten för Q3, hur ser den ut?");
  });
  it("byggTrad och kravTradnamn: nyckeln är roten, inga fält utöver modellens, taket gäller", () => {
    const t = byggTrad({ rot: "m1", skapadAv: "anna", skapad: 5 });
    expect(t).toEqual({ id: "m1", skapad: 5, skapadAv: "anna" });
    expect(Object.keys(byggTrad({ rot: "m1", skapadAv: "anna", skapad: 5, namn: "x" })).filter((k) => k !== "id").every((k) => TRADFALT.includes(/** @type {any} */ (k)))).toBe(true);
    expect(() => byggTrad({ rot: "", skapadAv: "anna" })).toThrow(/rot krävs/);
    expect(() => kravTradnamn("y".repeat(MAX_TRADNAMN + 1))).toThrow(/taket/);
    expect(kravTradnamn("  ")).toBeNull();
  });
  it("⛔ node-delen exporterar samma regel, så att appens agent kallar tråden samma sak", () => {
    expect(nod.autonamn).toBe(autonamn);
    expect(nod.tradensNamn).toBe(tradensNamn);
  });
  it("⛔ BÖR 1: utan tradar är regeltexten byte för byte 0.67.0", () => {
    const fil = path.resolve(__dirname, "..", "..", "rules", "__fixturer__", "samtalsregelfragment-0.67.0.rules");
    const gammal = fs.readFileSync(fil, "utf8");
    expect(gammal.length).toBeGreaterThan(3000); // golv: fixturen är inte tom
    expect(samtalsregelfragment()).toBe(gammal);
    expect(samtalsregelfragment()).not.toContain("tradar");
    expect(samtalsregelfragment({ tradar: "tradar" })).not.toBe(gammal);
  });
  it("⛔ KAN 7: ett trådnamn som krockar med meddelanden eller last kastar, i reglerna och i källan", () => {
    expect(() => samtalsregelfragment({ tradar: "meddelanden" })).toThrow(/krockar/);
    expect(() => samtalsregelfragment({ tradar: "last" })).toThrow(/krockar/);
    expect(() => createSamtalskalla({ kalla: createMemorySource({}), tradar: "last" })).toThrow(/krockar/);
    expect(() => createSamtalskalla({ kalla: createMemorySource({}), meddelanden: "m", tradar: "m" })).toThrow(/krockar/);
  });
  it("regelfragmentets fält och tak kommer ur modellen, och samlingsnamnet skickas in", () => {
    const r = samtalsregelfragment({ tradar: "tradar" });
    expect(r).toContain(`hasOnly([${TRADFALT.map((f) => `"${f}"`).join(", ")}])`);
    expect(r).toContain(`d.namn.size() <= ${MAX_TRADNAMN}`);
    expect(samtalsregelfragment({ tradar: "tradarna" })).toContain("match /tradarna/{tid}");
    expect(() => samtalsregelfragment({ tradar: "a/b" })).toThrow();
  });
});

/**
 * En minneskälla som räknar läsningar som Firestore fakturerar dem: `read` en per anrop, `list` en per rad (minst en),
 * `count` en per anrop. Med `count: true` har den en aggregatfråga, som Firestore-adaptern med `getCountFromServer`.
 * @param {{ count?: boolean }} [val]
 */
function raknandeKalla(val = {}) {
  const bas = createMemorySource({});
  // `tradar` är läsningarna för trådarna (sökvägar med /tradar), `lasningar` allt, chattens egna läsningar medräknade.
  const r = { lasningar: 0, tradar: 0 };
  const lagg = (/** @type {string} */ c, /** @type {number} */ n) => {
    r.lasningar += n;
    if (c.includes("/tradar")) r.tradar += n;
  };
  const k = /** @type {any} */ ({
    ...bas,
    read: async (/** @type {string} */ c, /** @type {string} */ id) => {
      lagg(c, 1);
      return bas.read(c, id);
    },
    list: async (/** @type {string} */ c, /** @type {any} */ q) => {
      const rader = await bas.list(c, q);
      lagg(c, Math.max(1, rader.length));
      return rader;
    },
    ...(val.count
      ? {
          count: async (/** @type {string} */ c) => {
            lagg(c, 1);
            return (await bas.list(c)).length;
          },
        }
      : {}),
  });
  delete k.subscribe;
  return { k, r, bas };
}

async function underlag({ tradar = "tradar" } = {}) {
  let t = Date.now() - 600000;
  const kalla = createMemorySource({});
  const samtal = createSamtalskalla({ kalla, klocka: () => (t += 1000), ...(tradar ? { tradar } : {}) });
  const g = await samtal.oppnaGrupp({ groupId: "g", uid: "anna" });
  const rot = await samtal.skicka(g.id, { text: "Budgeten för Q3, hur ser den ut?", av: "cecilia" });
  const utan = await samtal.skicka(g.id, { text: "Fika på fredag?", av: "bo" });
  if (harTradar(samtal)) {
    await samtal.skickaITrad(g.id, rot.id, { text: "Den ser tight ut", av: "bo" });
    await samtal.skickaITrad(g.id, rot.id, { text: "@Agent kan du sammanfatta?", av: "anna" });
    await samtal.skickaITrad(g.id, rot.id, { text: "Marginalen är 5,6 procent.", av: "ops" });
  }
  const p = await samtal.oppnaPrivat({ groupId: "g", uid: "bo", annan: "anna" });
  await samtal.skicka(p.id, { text: "Privat fråga", av: "bo" });
  return { kalla, samtal, grupp: g, rot, utan, privat: p };
}

/** @param {any} s */
const medT = (s) => /** @type {any} */ (s);

describe("Firestore-adapterns count (0.68.0)", () => {
  const bas = () => ({
    collection: (/** @type {any} */ _d, /** @type {string} */ c) => ({ c }), doc: () => ({}), getDoc: async () => ({ exists: () => false }), getDocs: async () => ({ docs: [] }),
    addDoc: async () => ({ id: "x" }), setDoc: async () => {}, updateDoc: async () => {}, deleteDoc: async () => {},
    query: (/** @type {any} */ q) => ({ q }), where: () => ({}), orderBy: () => ({}), limit: () => ({}), onSnapshot: () => () => {},
  });
  it("⛔ finns bara när sdk:n har getCountFromServer, och använder aggregatfrågan", async () => {
    expect("count" in createFirestoreSource({ db: {}, sdk: bas() })).toBe(false);
    const getCountFromServer = vi.fn(async () => ({ data: () => ({ count: 7 }) }));
    const k = /** @type {any} */ (createFirestoreSource({ db: {}, sdk: { ...bas(), getCountFromServer } }));
    expect(await k.count("samtal/s/tradar/t/meddelanden")).toBe(7);
    expect(getCountFromServer).toHaveBeenCalledTimes(1);
  });
});

describe("createSamtalskalla: trådarna", () => {
  it("⛔ BÖR 1: utan tradar har källan inga trådfunktioner", async () => {
    const { samtal } = await underlag({ tradar: "" });
    expect(harTradar(samtal)).toBe(false);
    for (const f of ["trad", "oppnaTrad", "tradarFor", "antalSvar", "skickaITrad", "dopOm"]) expect(f in samtal).toBe(false);
  });
  it("⛔ en tråd skapas med det första svaret, under gruppchatten, med roten som nyckel", async () => {
    const { kalla, samtal, grupp, rot, utan } = await underlag();
    const s = medT(samtal);
    expect(await s.trad(grupp.id, utan.id)).toBeNull();
    expect(await s.trad(grupp.id, rot.id)).toMatchObject({ id: rot.id, skapadAv: "bo" });
    expect(await kalla.list(`samtal/${grupp.id}/tradar`)).toHaveLength(1);
    expect((await s.tradmeddelanden(grupp.id, rot.id)).map((/** @type {any} */ m) => m.text)).toEqual(["Den ser tight ut", "@Agent kan du sammanfatta?", "Marginalen är 5,6 procent."]);
  });
  it("⛔ oppnaTrad två gånger ger samma tråd, och skaparen byts inte", async () => {
    const { samtal, grupp, rot } = await underlag();
    expect((await medT(samtal).oppnaTrad({ sid: grupp.id, rot: rot.id, uid: "anna" })).skapadAv).toBe("bo");
  });
  it("⛔ ett tomt svar lämnar ingen tom tråd efter sig", async () => {
    const { samtal, grupp, utan } = await underlag();
    await expect(medT(samtal).skickaITrad(grupp.id, utan.id, { text: "  ", av: "anna" })).rejects.toThrow(/tom/);
    expect(await medT(samtal).trad(grupp.id, utan.id)).toBeNull();
  });
  it("tradarFor ger bara de rötter som har en tråd, och kräver rötterna", async () => {
    const { samtal, grupp, rot, utan } = await underlag();
    expect((await medT(samtal).tradarFor(grupp.id, [rot.id, utan.id])).map((/** @type {any} */ t) => t.id)).toEqual([rot.id]);
    await expect(medT(samtal).tradarFor(grupp.id)).rejects.toThrow(/rotter krävs/);
  });
  it("⛔ antalSvar är en aggregatfråga där källan kan, och en lista med tak annars", async () => {
    for (const count of [true, false]) {
      const { k, r } = raknandeKalla({ count });
      const s = medT(createSamtalskalla({ kalla: k, tradar: "tradar" }));
      const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
      const rot = await s.skicka(g.id, { text: "Rot", av: "anna" });
      for (let i = 0; i < 5; i += 1) await s.skickaITrad(g.id, rot.id, { text: `svar ${i}`, av: "bo" });
      r.lasningar = 0;
      expect(await s.antalSvar(g.id, rot.id)).toEqual({ antal: 5, fler: false });
      expect(r.lasningar).toBe(count ? 1 : 5);
    }
  });
  it("⛔ dopOm sätter namnet, och null tar bort det så att det härledda gäller", async () => {
    const { samtal, grupp, rot } = await underlag();
    await medT(samtal).dopOm(grupp.id, rot.id, "Q3-budget");
    expect((await medT(samtal).trad(grupp.id, rot.id))?.namn).toBe("Q3-budget");
    await medT(samtal).dopOm(grupp.id, rot.id, null);
    expect(await medT(samtal).trad(grupp.id, rot.id)).not.toHaveProperty("namn");
  });
});

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "cecilia", namn: "Cecilia Berg", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];

describe("OpsMeddelanden: trådar i gruppchatten", { timeout: 20000 }, () => {
  it("⛔ BÖR 2: utan tradar i källan finns varken Svara i tråd, märken eller trådvy", async () => {
    const { samtal, grupp, rot } = await underlag({ tradar: "" });
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} valtTrad={rot.id} />);
    const logg = await screen.findByRole("log", { name: "Alfa AB" });
    await waitFor(() => expect(within(logg).getByText("Fika på fredag?")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Svara i tråd/ })).toBeNull();
    expect(document.querySelector("[data-tradmarke], [data-ops-trad]")).toBeNull();
  });

  it("⛔ med tradar: märket visar antal, och namnet bara när det inte är rotens egen rad (KAN 9)", async () => {
    const { samtal, grupp, rot } = await underlag();
    const { unmount } = render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} />);
    const marke = await screen.findByRole("button", { name: "3 svar" });
    expect(marke).toHaveAttribute("data-tradrot", rot.id);
    expect(screen.getAllByRole("button", { name: "Svara i tråd" })).toHaveLength(1);
    unmount();
    await medT(samtal).dopOm(grupp.id, rot.id, "Q3-budget");
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} />);
    await screen.findByRole("button", { name: "3 svar · Q3-budget" });
  });

  it("⛔ KAN 6: Svara i tråd säger vems meddelande det gäller", async () => {
    const { samtal, grupp } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} />);
    const knapp = await screen.findByRole("button", { name: "Svara i tråd" });
    expect(knapp).toHaveAccessibleDescription("Meddelande från Bo Lind: Fika på fredag?");
  });

  it("⛔ märket öppnar tråden; Tillbaka leder till chatten och fokus går tillbaka till märket (KAN 6)", async () => {
    const { samtal, grupp } = await underlag();
    const onValjTrad = vi.fn();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} onValjTrad={onValjTrad} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "3 svar" }));
    const logg = await screen.findByRole("log", { name: "Budgeten för Q3, hur ser den ut?" });
    await waitFor(() => expect(within(logg).getByText("@Agent kan du sammanfatta?")).toBeInTheDocument());
    expect(within(logg).queryByText("Fika på fredag?")).toBeNull();
    expect(screen.getByText("Alla i gruppen ser tråden")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Alfa AB" }));
    expect(onValjTrad).toHaveBeenLastCalledWith(null);
    const marke = await screen.findByRole("button", { name: "3 svar" });
    await waitFor(() => expect(marke).toHaveFocus());
  });

  it("⛔ KAN 9: agentens svar i tråden bär agentens ikon, inte initialer", async () => {
    const { samtal, grupp, rot } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} valtTrad={rot.id} />);
    const logg = await screen.findByRole("log", { name: "Budgeten för Q3, hur ser den ut?" });
    const svar = await within(logg).findByText("Marginalen är 5,6 procent.");
    const rad = /** @type {HTMLElement} */ (svar.closest("[data-meddelande]"));
    expect(rad.querySelector("svg")).not.toBeNull();
    expect(within(rad).queryByText("OA")).toBeNull();
  });

  it("⛔ Svara i tråd skapar ingen tråd förrän något skickas; efteråt räknas märket om", async () => {
    const { samtal, grupp, utan } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Svara i tråd" }));
    await screen.findByText("Inga svar än. Skriv det första.");
    expect(await medT(samtal).trad(grupp.id, utan.id)).toBeNull();
    expect(screen.queryByRole("button", { name: "Döp om" })).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), "Ja gärna{Enter}");
    await screen.findByText("1 svar");
    await user.click(screen.getByRole("button", { name: "Alfa AB" }));
    await screen.findByRole("button", { name: "1 svar" });
  });

  it("⛔ döp om: Spara behåller fokus i rubriken, Escape avbryter, och det automatiska namnet kommer tillbaka (KAN 6)", async () => {
    const { samtal, grupp, rot } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} valtTrad={rot.id} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Döp om" }));
    const falt = screen.getByRole("textbox", { name: "Trådens namn" });
    await user.clear(falt);
    await user.type(falt, "Q3-budget{Enter}");
    await screen.findByRole("heading", { name: "Q3-budget" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Döp om" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Döp om" }));
    await user.type(screen.getByRole("textbox", { name: "Trådens namn" }), " ändrat{Escape}");
    expect(screen.queryByRole("textbox", { name: "Trådens namn" })).toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: "Döp om" })).toHaveFocus());
    expect((await medT(samtal).trad(grupp.id, rot.id))?.namn).toBe("Q3-budget");
    await user.click(screen.getByRole("button", { name: "Döp om" }));
    await user.click(screen.getByRole("button", { name: "Använd det automatiska namnet" }));
    await screen.findByRole("heading", { name: "Budgeten för Q3, hur ser den ut?" });
  });

  it("⛔ ett privat samtal har inga trådar, och ett trådval gäller inte där", async () => {
    const { samtal, privat, rot } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={privat.id} valtTrad={rot.id} />);
    const logg = await screen.findByRole("log", { name: "Bo Lind" });
    await waitFor(() => expect(within(logg).getByText("Privat fråga")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Svara i tråd" })).toBeNull();
    expect(document.querySelector("[data-ops-trad]")).toBeNull();
  });

  it("⛔ BÖR 4: när någon annan svarar når det märket när fönstret får fokus", async () => {
    const { samtal, grupp, rot } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} />);
    await screen.findByRole("button", { name: "3 svar" });
    await medT(samtal).skickaITrad(grupp.id, rot.id, { text: "Ett svar från Bo", av: "bo" });
    act(() => {
      fireEvent(window, new Event("focus"));
    });
    await screen.findByRole("button", { name: "4 svar" });
  });

  it("⛔ okänt trådläge ritas inte som Svara i tråd (#282)", async () => {
    const { samtal, grupp } = await underlag();
    let slapp = () => {};
    const vanta = new Promise((r) => {
      slapp = r;
    });
    const langsam = /** @type {any} */ ({
      ...samtal,
      tradarFor: async (/** @type {string} */ sid, /** @type {string[]} */ rotter) => {
        await vanta;
        return medT(samtal).tradarFor(sid, rotter);
      },
    });
    render(<OpsMeddelanden kalla={langsam} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} />);
    const logg = await screen.findByRole("log", { name: "Alfa AB" });
    await waitFor(() => expect(within(logg).getByText("Fika på fredag?")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Svara i tråd/ })).toBeNull();
    expect(logg.querySelectorAll("[data-tradmarke='okand']").length).toBeGreaterThan(0);
    expect(within(logg).getAllByText("Tråden hämtas").length).toBeGreaterThan(0);
    slapp();
    await screen.findByRole("button", { name: "Svara i tråd" });
    expect(logg.querySelector("[data-tradmarke='okand']")).toBeNull();
  });

  it("⛔ KAN 5: föll läsningen av trådarna står det en rad, den sväljs inte", async () => {
    const { samtal, grupp } = await underlag();
    const trasig = /** @type {any} */ ({ ...samtal, tradarFor: async () => { throw new Error("nekad"); } });
    render(<OpsMeddelanden kalla={trasig} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} />);
    await screen.findByText("Trådarna kunde inte hämtas.");
  });
});

/**
 * ⛔ BÖR 4: läsningarna med 50 meddelanden och 20 trådar, mätta med en källa som räknar som Firestore fakturerar.
 * Siffrorna skrivs ut, och taken är de som ska hålla: att öppna chatten, ett nytt meddelande, och att gå tillbaka från en tråd.
 */
describe("läsningar för märkena (BÖR 4)", { timeout: 20000 }, () => {
  it("50 meddelanden och 20 trådar: öppna, nytt meddelande, tillbaka från en tråd", async () => {
    const { k, r } = raknandeKalla({ count: true });
    let t = Date.now() - 3_600_000;
    const s = medT(createSamtalskalla({ kalla: k, tradar: "tradar", klocka: () => (t += 1000) }));
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    /** @type {string[]} */
    const ids = [];
    for (let i = 0; i < 50; i += 1) ids.push((await s.skicka(g.id, { text: `Meddelande ${i}`, av: i % 2 ? "bo" : "cecilia" })).id);
    for (let i = 0; i < 20; i += 1) for (let j = 0; j < 3; j += 1) await s.skickaITrad(g.id, ids[i * 2], { text: `svar ${j}`, av: "bo" });
    const onValjTrad = vi.fn();
    r.lasningar = 0;
    r.tradar = 0;
    const { rerender } = render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={g.id} onValjTrad={onValjTrad} />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "3 svar" })).toHaveLength(20));
    await new Promise((x) => setTimeout(x, 50));
    const oppna = { alla: r.lasningar, tradar: r.tradar };

    r.lasningar = 0;
    r.tradar = 0;
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), "Ett till{Enter}");
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Svara i tråd" })).toHaveLength(31));
    await new Promise((x) => setTimeout(x, 50));
    const nytt = { alla: r.lasningar, tradar: r.tradar };

    await user.click(screen.getAllByRole("button", { name: "3 svar" })[0]);
    await screen.findByText("3 svar");
    r.lasningar = 0;
    r.tradar = 0;
    await user.click(screen.getByRole("button", { name: "Alfa AB" }));
    // 19 och inte 20: chatten visar de senaste 50, och det nya meddelandet sköt ut den äldsta roten.
    await waitFor(() => expect(screen.getAllByRole("button", { name: "3 svar" })).toHaveLength(19));
    await new Promise((x) => setTimeout(x, 50));
    const tillbaka = { alla: r.lasningar, tradar: r.tradar };

    r.lasningar = 0;
    r.tradar = 0;
    act(() => {
      fireEvent(window, new Event("focus"));
    });
    await new Promise((x) => setTimeout(x, 100));
    const fokus = { alla: r.lasningar, tradar: r.tradar };
    rerender(<></>);

    // eslint-disable-next-line no-console
    console.log(`LÄSNINGAR (trådar/alla): öppna ${oppna.tradar}/${oppna.alla}, nytt meddelande ${nytt.tradar}/${nytt.alla}, tillbaka från tråd ${tillbaka.tradar}/${tillbaka.alla}, fokus ${fokus.tradar}/${fokus.alla}`);
    // Taken gäller trådarnas läsningar. Öppna: 50 rötter och 20 antal. Nytt meddelande: den nya roten. Tillbaka: det som
    // tråden kan ha ändrat, alltså inget när ingen svarat. Fokus: 19 antal och de senaste rötterna utan tråd.
    expect(oppna.tradar).toBeLessThanOrEqual(70);
    expect(nytt.tradar).toBeLessThanOrEqual(1);
    expect(tillbaka.tradar).toBe(0);
    expect(fokus.tradar).toBeLessThanOrEqual(30);
  });
});
