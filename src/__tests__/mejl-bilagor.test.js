import { describe, expect, it } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { ICS_MIME, byggIcs } from "../node/ics.js";
import {
  MEJL_BILAGA_MAX_BYTES,
  MEJL_BILAGETYPER,
  MEJL_BILAGOR_MAX,
  byggMejl,
  createMailQueue,
  createMailSender,
  createMockMailTransport,
  createNodemailerTransport,
  kontrolleraMejlbilagor,
} from "../node/mejl.js";

/**
 * Bilagor i mejlkön (0.148.0, cllp/ops-framework#453): `bilagor: [{ filnamn, innehall, typ }]` genom byggMejl, kön, utskicket och
 * nodemailer-adaptern.
 *
 * Utan nätverk. Kön skrivs i minneskällan och utskicket går genom mocken eller genom nodemailer-adapterns `skapa`.
 * ⛔ VARJE PROV HAR BEVISATS I BÅDA RIKTNINGARNA (arbetsreglerna, punkt 4): rött utan ändringen i `src/lib/mejl.js` och
 * `src/node/mejl.js`, grönt med. Provet "ett mejl utan bilagor" är undantaget i en riktning: det ska vara grönt åt båda håll, eftersom
 * det mäter att ingenting ändrats för den som inte använder bilagor.
 */

const SAMLING = "utkorgen";

const STAMPEL = Date.UTC(2026, 9, 26, 12, 0, 0);
const MOTE = { id: "h-mote", titel: "Möte", plats: "Salen, Visby", datum: "2026-12-02", tid: "18:00", slutTid: "20:00" };
const ICS = byggIcs({ handelse: MOTE, sekvens: 0, domän: "my.life-hub.app", tidszon: "Europe/Stockholm", stampel: STAMPEL });
const BILAGA = { filnamn: "inbjudan.ics", innehall: ICS, typ: ICS_MIME };

/** @param {Record<string, unknown>} [over] */
const brev = (over = {}) => ({
  till: "vanja@staiger.se",
  amne: "Du är inbjuden",
  text: "Hej",
  html: "<p>Hej</p>",
  sprak: "sv",
  kategori: "inbjudan",
  ...over,
});

/**
 * @param {{ send: (brev: any) => Promise<any> }} transport
 */
const koOchUtskicket = (transport) => {
  const kalla = createMemorySource({ [SAMLING]: [] });
  const ko = createMailQueue({ kalla, samling: SAMLING });
  const utskick = createMailSender({ kalla, samling: SAMLING, transport });
  return { kalla, ko, utskick };
};

/** En transport som bara antecknar exakt vad den fick, nyckel för nyckel. */
function antecknande() {
  /** @type {any[]} */
  const fick = [];
  return {
    fick,
    /** @param {any} b */
    async send(b) {
      fick.push(b);
      return { accepted: [b.till], rejected: [], response: "250 OK", messageId: "<a@test>" };
    },
  };
}

describe("bilagor genom hela kedjan", () => {
  it("en .ics når transporten med rätt filnamn, innehåll och typ, och raden töms när brevet gått", async () => {
    const transport = createMockMailTransport();
    const { kalla, ko, utskick } = koOchUtskicket(transport);
    const koad = await ko.koa(brev({ bilagor: [BILAGA] }));

    // Kön har skrivit bilagan på raden.
    expect(koad.bilagor).toEqual([{ filnamn: "inbjudan.ics", innehall: ICS, typ: ICS_MIME }]);

    const sparad = await utskick.skicka(koad);
    expect(sparad.status).toBe("skickad");

    const skickade = transport.skickade();
    expect(skickade).toHaveLength(1);
    expect(skickade[0].bilagor).toHaveLength(1);
    expect(skickade[0].bilagor?.[0].filnamn).toBe("inbjudan.ics");
    expect(skickade[0].bilagor?.[0].typ).toBe("text/calendar; charset=utf-8");
    expect(skickade[0].bilagor?.[0].innehall).toBe(ICS);
    expect(skickade[0].bilagor?.[0].innehall).toContain("BEGIN:VCALENDAR");

    // Bilagan bär händelsens rubrik och tid och töms när brevet gått, i samma skrivning som kvittot.
    const igen = await kalla.read(SAMLING, koad.id);
    expect(igen.status).toBe("skickad");
    expect(igen.bilagor).toEqual([]);
    expect(JSON.stringify(igen)).not.toContain("BEGIN:VCALENDAR");
  });

  it("ett mejl som inte kom fram behåller sin bilaga: fel och hoppad", async () => {
    const avvisar = createMockMailTransport({ utfall: () => ({ accepted: [], rejected: ["vanja@staiger.se"] }) });
    const a = koOchUtskicket(avvisar);
    const fel = await a.ko.koa(brev({ bilagor: [BILAGA] }));
    expect((await a.utskick.skicka(fel)).status).toBe("fel");
    expect((await a.kalla.read(SAMLING, fel.id)).bilagor).toEqual([BILAGA]);

    const b = koOchUtskicket(createMockMailTransport());
    const hoppad = await b.ko.koa(brev({ till: "x@example.com", bilagor: [BILAGA] }));
    expect((await b.utskick.skicka(hoppad)).status).toBe("hoppad");
    expect((await b.kalla.read(SAMLING, hoppad.id)).bilagor).toEqual([BILAGA]);
  });

  it("flera bilagor behåller ordningen, och filnamn och typ trimmas", async () => {
    const transport = createMockMailTransport();
    const { ko, utskick } = koOchUtskicket(transport);
    const koad = await ko.koa(
      brev({
        bilagor: [
          { filnamn: " a.ics ", innehall: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", typ: " text/calendar " },
          { filnamn: "b.ics", innehall: ICS, typ: "TEXT/CALENDAR; method=REQUEST; charset=utf-8" },
        ],
      }),
    );
    await utskick.skicka(koad);
    const b = transport.skickade()[0].bilagor ?? [];
    expect(b.map((x) => x.filnamn)).toEqual(["a.ics", "b.ics"]);
    expect(b[0].typ).toBe("text/calendar");
    expect(b[1].typ).toBe("TEXT/CALENDAR; method=REQUEST; charset=utf-8");
  });
});

describe("ett mejl utan bilagor är byte för byte som förut", () => {
  const GAMMAL_RAD =
    '{"till":"vanja@staiger.se","amne":"Du är inbjuden","text":"Hej","html":"<p>Hej</p>","sprak":"sv","kategori":"inbjudan","groupId":null,"status":"koad"}';

  it("byggMejl ger exakt den gamla raden, utan någon bilagenyckel", () => {
    expect(JSON.stringify(byggMejl(brev()))).toBe(GAMMAL_RAD);
    expect(Object.keys(byggMejl(brev()))).toEqual(["till", "amne", "text", "html", "sprak", "kategori", "groupId", "status"]);
    // En tom lista är ingen bilaga: samma rad, ingen tom nyckel.
    expect(JSON.stringify(byggMejl(brev({ bilagor: [] })))).toBe(GAMMAL_RAD);
  });

  it("transporten får exakt de fyra fälten och raden får exakt kvittots fält", async () => {
    const transport = antecknande();
    const { kalla, ko, utskick } = koOchUtskicket(transport);
    const koad = await ko.koa(brev());
    expect(Object.keys(koad).sort()).toEqual(["amne", "groupId", "html", "id", "kategori", "sprak", "status", "text", "till"]);

    const sparad = await utskick.skicka(koad);
    expect(transport.fick).toHaveLength(1);
    expect(Object.keys(transport.fick[0]).sort()).toEqual(["amne", "html", "text", "till"]);
    expect(transport.fick[0]).toStrictEqual({ till: "vanja@staiger.se", amne: "Du är inbjuden", text: "Hej", html: "<p>Hej</p>" });

    expect(sparad.status).toBe("skickad");
    const rad = await kalla.read(SAMLING, koad.id);
    expect("bilagor" in rad).toBe(false);
  });

  it("mocken antecknar fyra fält, och nodemailer får varken attachments eller något annat nytt", async () => {
    const mock = createMockMailTransport();
    await mock.send({ till: "a@unik-doman.test", amne: "Hej", text: "t", html: "<p>t</p>" });
    expect(mock.skickade()).toStrictEqual([{ till: "a@unik-doman.test", amne: "Hej", text: "t", html: "<p>t</p>" }]);

    /** @type {any[]} */
    const post = [];
    const nod = createNodemailerTransport({
      host: "smtp.example.invalid",
      port: 465,
      secure: true,
      auth: { user: "u", pass: "p" },
      from: "LifeHub <hello@life-hub.app>",
      skapa: () => ({
        async sendMail(mail) {
          post.push(mail);
          return { accepted: [/** @type {any} */ (mail).to], rejected: [], response: "250 OK", messageId: "<id@test>" };
        },
      }),
    });
    await nod.send({ till: "a@unik-doman.test", amne: "Hej", text: "t", html: "<p>t</p>" });
    expect(post[0]).toStrictEqual({ from: "LifeHub <hello@life-hub.app>", to: "a@unik-doman.test", subject: "Hej", text: "t", html: "<p>t</p>" });
  });
});

describe("nodemailer-adaptern ger bilagorna vidare som attachments", () => {
  /** @param {any[]} post */
  const adapter = (post) =>
    createNodemailerTransport({
      host: "smtp.example.invalid",
      port: 465,
      secure: true,
      auth: { user: "u", pass: "p" },
      from: "LifeHub <hello@life-hub.app>",
      skapa: () => ({
        async sendMail(mail) {
          post.push(mail);
          return { accepted: [/** @type {any} */ (mail).to], rejected: [], response: "250 OK", messageId: "<id@test>" };
        },
      }),
    });

  it("filnamn, innehåll och typ blir filename, content och contentType", async () => {
    /** @type {any[]} */
    const post = [];
    await adapter(post).send({ till: "a@unik-doman.test", amne: "Hej", text: "t", html: "<p>t</p>", bilagor: [BILAGA] });
    expect(post[0].attachments).toStrictEqual([{ filename: "inbjudan.ics", content: ICS, contentType: ICS_MIME }]);
    expect(post[0]).toMatchObject({ to: "a@unik-doman.test", subject: "Hej", text: "t", html: "<p>t</p>" });
  });

  it("en bilaga utanför taket kastar före sendMail", async () => {
    /** @type {any[]} */
    const post = [];
    await expect(
      adapter(post).send({ till: "a@unik-doman.test", amne: "Hej", text: "t", html: "", bilagor: [{ filnamn: "k.exe", innehall: "MZ", typ: "application/x-msdownload" }] }),
    ).rejects.toThrow(/typen "application\/x-msdownload" är inte tillåten/);
    expect(post).toEqual([]);
  });
});

describe("taken: en bilaga utanför taket ger ett fel och skickas aldrig tyst utan", () => {
  it("de tre taken står där de ska", () => {
    expect(MEJL_BILAGOR_MAX).toBe(5);
    expect(MEJL_BILAGA_MAX_BYTES).toBe(32768);
    expect(MEJL_BILAGETYPER).toEqual(["text/calendar"]);
    expect(Object.isFrozen(MEJL_BILAGETYPER)).toBe(true);
  });

  const ok = (/** @type {number} */ n) => Array.from({ length: n }, (_, i) => ({ filnamn: `${i}.ics`, innehall: "BEGIN:VCALENDAR", typ: "text/calendar" }));

  it("antal: fem går, sex kastar", () => {
    expect(byggMejl(brev({ bilagor: ok(5) })).bilagor).toHaveLength(5);
    expect(() => byggMejl(brev({ bilagor: ok(6) }), "koa")).toThrow("koa: högst 5 bilagor i ett brev, 6 gavs.");
  });

  it("storlek: räknas i UTF-8-byte, inte i tecken", () => {
    const pa = (/** @type {string} */ s) => ({ filnamn: "a.ics", innehall: s, typ: "text/calendar" });
    expect(byggMejl(brev({ bilagor: [pa("x".repeat(MEJL_BILAGA_MAX_BYTES))] })).bilagor).toHaveLength(1);
    expect(() => byggMejl(brev({ bilagor: [pa("x".repeat(MEJL_BILAGA_MAX_BYTES + 1))] }), "koa")).toThrow(/bilaga 1: innehall är 32769 byte, högst 32768 byte per bilaga/);
    // 16 385 tecken men 32 770 byte.
    const flerbyte = "ä".repeat(MEJL_BILAGA_MAX_BYTES / 2 + 1);
    expect(flerbyte.length).toBeLessThan(MEJL_BILAGA_MAX_BYTES);
    expect(() => byggMejl(brev({ bilagor: [pa(flerbyte)] }), "koa")).toThrow(/32770 byte/);
  });

  it("typ: text/calendar med eller utan parametrar går, allt annat kastar", () => {
    const med = (/** @type {string} */ typ) => byggMejl(brev({ bilagor: [{ filnamn: "a.ics", innehall: "x", typ }] }), "koa");
    for (const typ of ["text/calendar", "text/calendar; charset=utf-8", "Text/Calendar; method=REQUEST"]) expect(med(typ).bilagor).toHaveLength(1);
    for (const typ of ["application/pdf", "text/html", "text/calendarx", "text/calendar-evil", "application/zip; x=text/calendar", "calendar"]) {
      expect(() => med(typ), typ).toThrow(/är inte tillåten. Tillåtna: text\/calendar/);
    }
    // Radbrytning i typen är en brevhuvudsinjektion.
    expect(() => med("text/calendar\r\nBcc: x@y.se")).toThrow(/typ får inte ha radbrytning/);
    expect(() => med("")).toThrow(/typ krävs/);
  });

  it("filnamn: krävs, ingen sökväg, inga citattecken eller styrtecken, högst 120 tecken", () => {
    const med = (/** @type {string} */ filnamn) => byggMejl(brev({ bilagor: [{ filnamn, innehall: "x", typ: "text/calendar" }] }), "koa");
    expect(() => med("")).toThrow(/filnamn krävs/);
    expect(() => med("   ")).toThrow(/filnamn krävs/);
    expect(() => med("../hemligt.ics")).toThrow(/sökväg/);
    expect(() => med("a\\b.ics")).toThrow(/sökväg/);
    expect(() => med('a".ics')).toThrow(/citattecken/);
    expect(() => med("a\r\nb.ics")).toThrow(/styrtecken/);
    expect(() => med(`${"a".repeat(117)}.ics`)).toThrow(/över 120 tecken/);
    expect(med(`${"a".repeat(116)}.ics`).bilagor).toHaveLength(1);
  });

  it("formen: en lista, objekt, bara tre fält, innehållet en icke-tom sträng", () => {
    const med = (/** @type {unknown} */ bilagor) => byggMejl(brev({ bilagor }), "koa");
    expect(() => med("inbjudan.ics")).toThrow(/bilagor är en lista eller utelämnad/);
    expect(() => med(null)).toThrow(/bilagor är en lista eller utelämnad/);
    expect(() => med([null])).toThrow(/bilaga 1 är inte en bilaga/);
    expect(() => med([[]])).toThrow(/bilaga 1 är inte en bilaga/);
    // Appens gamla form (namn) och nodemailers (filename, content, contentType) tappar inte tyst sitt innehåll.
    expect(() => med([{ namn: "a.ics", typ: "text/calendar", innehall: "x" }])).toThrow(/bilaga 1 har fältet "namn"/);
    expect(() => med([{ filename: "a.ics", content: "x", contentType: "text/calendar" }])).toThrow(/bilaga 1 har fältet "filename", "content", "contentType"/);
    expect(() => med([{ filnamn: "a.ics", typ: "text/calendar" }])).toThrow(/innehall är en sträng/);
    expect(() => med([{ filnamn: "a.ics", typ: "text/calendar", innehall: 5 }])).toThrow(/innehall är en sträng/);
    expect(() => med([{ filnamn: "a.ics", typ: "text/calendar", innehall: "  \r\n" }])).toThrow(/innehall är tomt/);
    // Felet säger vilken bilaga det är.
    expect(() => med([...ok(1), { filnamn: "", innehall: "x", typ: "text/calendar" }])).toThrow(/koa: bilaga 2: filnamn krävs/);
  });

  it("kontrolleraMejlbilagor: utelämnad och tom lista ger en tom lista, och en giltig lista kommer tillbaka i formen", () => {
    expect(kontrolleraMejlbilagor(undefined)).toEqual([]);
    expect(kontrolleraMejlbilagor([])).toEqual([]);
    expect(kontrolleraMejlbilagor([BILAGA])).toEqual([BILAGA]);
  });

  it("kön skriver ingenting när en bilaga är utanför taket", async () => {
    const { kalla, ko } = koOchUtskicket(createMockMailTransport());
    await expect(ko.koa(brev({ bilagor: [{ filnamn: "a.pdf", innehall: "x", typ: "application/pdf" }] }))).rejects.toThrow(/koa: bilaga 1: typen "application\/pdf"/);
    expect(await kalla.list(SAMLING)).toEqual([]);
  });

  it("utskicket: en rad med en bilaga utanför taket skickas inte alls och blir fel på raden", async () => {
    const transport = antecknande();
    const { kalla, utskick } = koOchUtskicket(transport);
    // En rad som kön inte skrivit: skriven för hand, eller av en annan version.
    const rad = await kalla.create(SAMLING, { ...byggMejl(brev()), bilagor: [{ filnamn: "a.exe", innehall: "MZ", typ: "application/x-msdownload" }] });

    const sparad = await utskick.skicka(rad.id);
    expect(sparad.status).toBe("fel");
    expect(sparad.fel).toMatch(/skicka: bilaga 1: typen "application\/x-msdownload" är inte tillåten/);
    expect(transport.fick).toEqual([]);
    expect((await kalla.read(SAMLING, rad.id)).status).toBe("fel");

    // Samma för en bilaga som inte är en lista.
    const rad2 = await kalla.create(SAMLING, { ...byggMejl(brev()), bilagor: "inbjudan.ics" });
    const sparad2 = await utskick.skicka(rad2.id);
    expect(sparad2.status).toBe("fel");
    expect(sparad2.fel).toMatch(/bilagor är en lista/);
    expect(transport.fick).toEqual([]);
  });

  it("mocken är lika sträng som adaptern", async () => {
    await expect(createMockMailTransport().send({ till: "a@unik-doman.test", amne: "Hej", text: "t", html: "", bilagor: [{ filnamn: "a.zip", innehall: "x", typ: "application/zip" }] })).rejects.toThrow(
      /createMockMailTransport: bilaga 1: typen "application\/zip" är inte tillåten/,
    );
  });
});
