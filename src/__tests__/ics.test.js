import { describe, expect, it } from "vitest";
import { ICS_MIME, andringsnyckel, byggIcs, nastaSekvens } from "../node/ics.js";

/**
 * Kalenderposten till en gäst (0.146.0, cllp/ops-framework#445, skiva 1): `byggIcs` är en ren funktion, och `nastaSekvens` avgör när SEQUENCE stiger.
 *
 * ⛔ "GILTIG" MÄTS MOT RFC 5545:S KRAV, INTE MOT ATT TEXTEN SER RIMLIG UT. `lasIcs` nedan är en liten, sträng läsare som provet äger: CRLF-radslut, rader högst 75 oktetter, vikta rader, BEGIN/END i rätt ordning och
 * de egenskaper en VEVENT måste ha (UID, DTSTAMP, DTSTART). En närvarokontroll av ordet "SEQUENCE" hade stått grön genom en post som ingen kalender läser. Posten är dessutom läst av en oberoende läsare
 * (Pythons `icalendar`) när provet skrevs; det står i PR-texten, och provet här beror inte på den.
 * ⛔ VARJE PROV HAR BEVISATS I BÅDA RIKTNINGARNA (arbetsreglerna, punkt 4): rött utan modulen, och för vakterna rött med koden muterad.
 */

const STAMPEL = Date.UTC(2026, 9, 26, 12, 0, 0);

/**
 * Läser en kalenderpost strikt. Kastar på det som RFC 5545 inte tillåter, annars ger den egenskaperna per komponent.
 * @param {string} text
 */
function lasIcs(text) {
  expect(text.endsWith("\r\n"), "slutar med CRLF").toBe(true);
  expect(text.replace(/\r\n/g, ""), "bara CRLF som radslut").not.toMatch(/[\r\n]/);
  const fysiska = text.slice(0, -2).split("\r\n");
  const enc = new TextEncoder();
  for (const rad of fysiska) expect(enc.encode(rad).length, `rad över 75 oktetter: ${rad}`).toBeLessThanOrEqual(75);
  // Vikning: en rad som börjar med blanksteg fortsätter den förra.
  /** @type {string[]} */
  const logiska = [];
  for (const rad of fysiska) {
    if (rad.startsWith(" ")) {
      expect(logiska.length, "fortsättning utan rad").toBeGreaterThan(0);
      logiska[logiska.length - 1] += rad.slice(1);
    } else logiska.push(rad);
  }
  /** @type {Array<{ namn: string, egenskaper: Array<{ namn: string, param: string, varde: string }> }>} */
  const komponenter = [];
  /** @type {string[]} */
  const stack = [];
  for (const rad of logiska) {
    const m = /^([A-Za-z0-9-]+)((?:;[^:]+)*):(.*)$/.exec(rad);
    expect(m, `ingen egenskap: ${rad}`).not.toBeNull();
    const [, namn, param, varde] = /** @type {RegExpExecArray} */ (m);
    if (namn === "BEGIN") {
      stack.push(varde);
      komponenter.push({ namn: varde, egenskaper: [] });
    } else if (namn === "END") {
      expect(stack.pop(), `END:${varde} utan matchande BEGIN`).toBe(varde);
    } else {
      expect(stack.length, `egenskap utanför komponent: ${rad}`).toBeGreaterThan(0);
      komponenter[komponenter.length - 1].egenskaper.push({ namn, param, varde });
    }
  }
  expect(stack, "alla BEGIN har ett END").toEqual([]);
  expect(komponenter.map((k) => k.namn)).toEqual(["VCALENDAR", "VEVENT"]);
  const [kal, ev] = komponenter;
  const en = (/** @type {typeof kal} */ k, /** @type {string} */ namn) => {
    const t = k.egenskaper.filter((e) => e.namn === namn);
    return t.length === 1 ? t[0] : t.length === 0 ? null : expect.fail(`${namn} förekommer ${t.length} gånger`);
  };
  for (const n of ["VERSION", "PRODID"]) expect(en(kal, n), `VCALENDAR ${n}`).not.toBeNull();
  for (const n of ["UID", "DTSTAMP", "DTSTART"]) expect(en(ev, n), `VEVENT ${n}`).not.toBeNull();
  expect(en(kal, "VERSION")?.varde).toBe("2.0");
  return { kal, ev, hamta: (/** @type {string} */ n) => en(ev, n) };
}

const MOTE = { id: "h-mote", titel: "Möte", plats: "Salen, Visby", datum: "2026-12-02", tid: "18:00", slutTid: "20:00" };
const ICS = (extra = {}, handelse = MOTE) => byggIcs({ handelse, sekvens: 0, domän: "my.life-hub.app", tidszon: "Europe/Stockholm", stampel: STAMPEL, ...extra });

describe("byggIcs: en giltig post per händelse", () => {
  it("en händelse med tid ger UID, DTSTAMP, DTSTART, DTEND, SUMMARY, LOCATION och SEQUENCE, och tiderna är UTC efter zonen", () => {
    const { hamta, kal } = lasIcs(ICS());
    expect(hamta("UID")?.varde).toBe("h-mote@my.life-hub.app");
    expect(hamta("DTSTAMP")?.varde).toBe("20261026T120000Z");
    // Stockholm i december är UTC+1: 18:00 lokal tid är 17:00Z.
    expect(hamta("DTSTART")).toMatchObject({ param: "", varde: "20261202T170000Z" });
    expect(hamta("DTEND")).toMatchObject({ param: "", varde: "20261202T190000Z" });
    expect(hamta("SUMMARY")?.varde).toBe("Möte");
    // Komma i platsen är escape-tecknat, så att det inte läses som två värden.
    expect(hamta("LOCATION")?.varde).toBe("Salen\\, Visby");
    expect(hamta("SEQUENCE")?.varde).toBe("0");
    expect(kal.egenskaper.map((e) => e.namn)).toEqual(["VERSION", "PRODID", "CALSCALE"]);
    expect(ICS_MIME).toBe("text/calendar; charset=utf-8");
  });

  it("sommartid: samma lokala klockslag ger en annan UTC-tid på sommaren (UTC+2), och övergångsdygnen kastar inte", () => {
    const sommar = lasIcs(ICS({}, { ...MOTE, datum: "2026-07-01" }));
    expect(sommar.hamta("DTSTART")?.varde).toBe("20260701T160000Z");
    // Natten klockan slås fram (2027-03-28, 02:00 blir 03:00) och tillbaka (2026-10-25, 03:00 blir 02:00): en tid som inte finns, och en som finns två gånger.
    for (const [datum, tid] of [["2027-03-28", "02:30"], ["2026-10-25", "02:30"], ["2026-10-25", "03:00"]]) {
      const ev = lasIcs(ICS({}, { ...MOTE, datum, tid, slutTid: undefined })).hamta("DTSTART")?.varde;
      expect(ev, `${datum} ${tid}`).toMatch(/^\d{8}T\d{6}Z$/);
    }
    // Före övergången (söndagen 2026-10-25 klockan 01:30 lokal tid är fortfarande sommartid, UTC+2) och efter (04:00 är vintertid, UTC+1).
    expect(lasIcs(ICS({}, { ...MOTE, datum: "2026-10-25", tid: "01:30", slutTid: undefined })).hamta("DTSTART")?.varde).toBe("20261024T233000Z");
    expect(lasIcs(ICS({}, { ...MOTE, datum: "2026-10-25", tid: "04:00", slutTid: undefined })).hamta("DTSTART")?.varde).toBe("20261025T030000Z");
  });

  it("en annan zon ger en annan tid: zonen är en indata och inget ramverket gissar", () => {
    expect(lasIcs(ICS({ tidszon: "UTC" })).hamta("DTSTART")?.varde).toBe("20261202T180000Z");
    expect(lasIcs(ICS({ tidszon: "America/New_York" })).hamta("DTSTART")?.varde).toBe("20261202T230000Z");
    expect(lasIcs(ICS({ tidszon: "Asia/Kolkata" })).hamta("DTSTART")?.varde).toBe("20261202T123000Z");
  });

  it("en heldag skrivs som datum, och slutdagen är dagen EFTER sista dagen (RFC 5545); en dag över flera dagar likaså", () => {
    const en = lasIcs(ICS({}, { id: "h-dag", titel: "Städdag", datum: "2026-12-05", heldag: true }));
    expect(en.hamta("DTSTART")).toMatchObject({ param: ";VALUE=DATE", varde: "20261205" });
    expect(en.hamta("DTEND")).toMatchObject({ param: ";VALUE=DATE", varde: "20261206" });
    const flera = lasIcs(ICS({}, { id: "h-dag", titel: "Läger", datum: "2026-12-30", slutDatum: "2027-01-02", heldag: true }));
    expect(flera.hamta("DTSTART")?.varde).toBe("20261230");
    expect(flera.hamta("DTEND")?.varde).toBe("20270103");
    // Utan klockslag är det en heldag också utan flaggan.
    expect(lasIcs(ICS({}, { id: "h-x", titel: "Dag", datum: "2026-12-05" })).hamta("DTSTART")?.param).toBe(";VALUE=DATE");
    // Ingen plats: ingen LOCATION.
    expect(en.hamta("LOCATION")).toBeNull();
  });

  it("en händelse med tid över flera dagar slutar på sista dagens slutTid, och utan slutTid slutar den där den börjar", () => {
    const flera = lasIcs(ICS({}, { ...MOTE, datum: "2026-12-02", slutDatum: "2026-12-03", tid: "22:00", slutTid: "02:00" }));
    expect(flera.hamta("DTSTART")?.varde).toBe("20261202T210000Z");
    expect(flera.hamta("DTEND")?.varde).toBe("20261203T010000Z");
    const utanSlut = lasIcs(ICS({}, { ...MOTE, slutTid: undefined }));
    expect(utanSlut.hamta("DTEND")?.varde).toBe(utanSlut.hamta("DTSTART")?.varde);
  });

  it("text med komma, semikolon, backslash, radbrytning och åäö escape-tecknas, och en lång rad viks vid 75 oktetter utan att dela ett tecken", () => {
    const lang = "Årsmöte med fika, kaffe; te och \\ bakverk\nrad två ".repeat(6) + "åäö😀".repeat(20);
    const text = ICS({}, { ...MOTE, titel: lang, plats: "Torget, Visby; \\ mitten" });
    const { hamta } = lasIcs(text);
    // Efter att läsaren fogat ihop de vikta raderna är värdet exakt den escape-tecknade texten.
    const forvantat = lang.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    expect(hamta("SUMMARY")?.varde).toBe(forvantat);
    expect(hamta("LOCATION")?.varde).toBe("Torget\\, Visby\\; \\\\ mitten");
    expect(text.split("\r\n").filter((r) => r.startsWith(" ")).length, "provet viker faktiskt något").toBeGreaterThan(3);
    // Ett tecken delas aldrig: varje fysisk rad är giltig UTF-8 (en delad emoji hade blivit ett ersättningstecken).
    expect(text).not.toContain("\uFFFD");
  });

  it("styrtecken i en rubrik tas bort, och blanksteg runt rubriken och platsen trimmas", () => {
    const { hamta } = lasIcs(ICS({}, { ...MOTE, titel: "  Mö\u0007te\u0000  ", plats: "  Salen  " }));
    expect(hamta("SUMMARY")?.varde).toBe("Möte");
    expect(hamta("LOCATION")?.varde).toBe("Salen");
  });

  it("samma indata ger samma text, byte för byte: funktionen läser ingen klocka", () => {
    expect(ICS()).toBe(ICS());
    expect(ICS({ stampel: STAMPEL + 1000 })).not.toBe(ICS());
  });

  it("SEQUENCE är det som gavs, och PRODID kan bytas", () => {
    expect(lasIcs(ICS({ sekvens: 7 })).hamta("SEQUENCE")?.varde).toBe("7");
    expect(lasIcs(ICS({ prodid: "-//lifehub//SV" })).kal.egenskaper.find((e) => e.namn === "PRODID")?.varde).toBe("-//lifehub//SV");
  });

  it("⛔ kastar för indata som inte går att skriva, och tystar ingenting", () => {
    const fel = [
      [{ handelse: { ...MOTE, datum: null } }, /inget datum/],
      [{ handelse: { ...MOTE, datum: "2026-02-30" } }, /inget datum/],
      [{ handelse: { ...MOTE, datum: "26-12-02" } }, /inget datum/],
      [{ handelse: { ...MOTE, slutDatum: "nej" } }, /slutDatum/],
      [{ handelse: { ...MOTE, slutDatum: "2026-12-01" } }, /före datum/],
      [{ handelse: { ...MOTE, tid: "25:00" } }, /klockslag/],
      [{ handelse: { ...MOTE, slutTid: "7" } }, /klockslag/],
      [{ handelse: { ...MOTE, tid: "18:00", slutTid: "17:00" } }, /slutar före/],
      [{ handelse: { ...MOTE, titel: "   " } }, /titel/],
      [{ handelse: { ...MOTE, id: "ett id" } }, /handelse\.id/],
      [{ handelse: { ...MOTE, id: "a@b" } }, /handelse\.id/],
      [{ handelse: null }, /handelse krävs/],
      [{ sekvens: -1 }, /sekvens/],
      [{ sekvens: 1.5 }, /sekvens/],
      [{ sekvens: "1" }, /sekvens/],
      [{ stampel: undefined }, /stampel/],
      [{ stampel: NaN }, /stampel/],
      [{ domän: "" }, /domän/],
      [{ domän: "my life.app" }, /domän/],
      [{ tidszon: "" }, /tidszon/],
      [{ tidszon: "Mars/Olympus" }, /finns inte/],
    ];
    for (const [extra, mot] of fel) expect(() => ICS(extra), JSON.stringify(extra)).toThrow(mot);
    // Golvet: ett fall som SKA gå går, så att kasten ovan inte är gröna av en funktion som alltid kastar.
    expect(() => ICS()).not.toThrow();
  });
});

describe("andringsnyckel och nastaSekvens: SEQUENCE stiger när tid eller plats ändrats", () => {
  it("nyckeln ändras av dag, slutdag, klockslag, sluttid, heldag och plats, men inte av rubriken eller blanksteg runt platsen", () => {
    const grund = andringsnyckel({ datum: "2026-12-02", slutDatum: null, tid: "18:00", slutTid: "20:00", heldag: false, plats: "Salen" });
    expect(grund).toMatch(/^[0-9a-f]{16}$/);
    const andra = [{ datum: "2026-12-03" }, { slutDatum: "2026-12-03" }, { tid: "19:00" }, { slutTid: "21:00" }, { heldag: true }, { plats: "Hamnen" }];
    for (const a of andra) expect(andringsnyckel({ datum: "2026-12-02", slutDatum: null, tid: "18:00", slutTid: "20:00", heldag: false, plats: "Salen", ...a }), JSON.stringify(a)).not.toBe(grund);
    expect(andringsnyckel({ datum: "2026-12-02", slutDatum: null, tid: "18:00", slutTid: "20:00", heldag: false, plats: "  Salen ", titel: "Annan rubrik" })).toBe(grund);
    // Saknad plats och tom plats är samma sak för gästen.
    expect(andringsnyckel({ datum: "2026-12-02", plats: null })).toBe(andringsnyckel({ datum: "2026-12-02", plats: undefined }));
  });

  it("första utskicket är 0, oförändrat står kvar, ändrat stiger med ett, och ändrat tillbaka stiger igen (en post som flyttats och flyttats tillbaka är två ändringar för kalendern)", () => {
    const a = nastaSekvens(null, "k1");
    expect(a).toEqual({ sekvens: 0, andringsnyckel: "k1", andrad: false });
    const b = nastaSekvens(a, "k1");
    expect(b).toEqual({ sekvens: 0, andringsnyckel: "k1", andrad: false });
    const c = nastaSekvens(b, "k2");
    expect(c).toEqual({ sekvens: 1, andringsnyckel: "k2", andrad: true });
    const d = nastaSekvens(c, "k1");
    expect(d).toEqual({ sekvens: 2, andringsnyckel: "k1", andrad: true });
    expect(nastaSekvens(undefined, "k9").sekvens).toBe(0);
  });

  it("kastar för en nyckel som saknas och för ett sparat läge som inte är ett", () => {
    expect(() => nastaSekvens(null, "")).toThrow(/nyckel/);
    expect(() => nastaSekvens(null, /** @type {any} */ (undefined))).toThrow(/nyckel/);
    expect(() => nastaSekvens({ sekvens: -1, andringsnyckel: "k" }, "k")).toThrow(/forra/);
    expect(() => nastaSekvens({ sekvens: 1.5, andringsnyckel: "k" }, "k")).toThrow(/forra/);
    expect(() => nastaSekvens(/** @type {any} */ ({ sekvens: 1 }), "k")).toThrow(/forra/);
  });

  it("⛔ tillsammans: samma post med ändrad tid får högre SEQUENCE i filen, och oförändrad får samma", () => {
    const fore = { ...MOTE };
    const efter = { ...MOTE, tid: "19:00", slutTid: "21:00" };
    const k = (h) => andringsnyckel(h);
    const forsta = nastaSekvens(null, k(fore));
    const samma = nastaSekvens(forsta, k(fore));
    const ny = nastaSekvens(samma, k(efter));
    expect(lasIcs(ICS({ sekvens: forsta.sekvens }, fore)).hamta("SEQUENCE")?.varde).toBe("0");
    expect(lasIcs(ICS({ sekvens: samma.sekvens }, fore)).hamta("SEQUENCE")?.varde).toBe("0");
    const nyIcs = lasIcs(ICS({ sekvens: ny.sekvens }, efter));
    expect(nyIcs.hamta("SEQUENCE")?.varde).toBe("1");
    // Samma UID: kalendern ersätter den gamla posten, den lägger inte en ny bredvid.
    expect(nyIcs.hamta("UID")?.varde).toBe(lasIcs(ICS({}, fore)).hamta("UID")?.varde);
    expect(nyIcs.hamta("DTSTART")?.varde).toBe("20261202T180000Z");
  });
});
