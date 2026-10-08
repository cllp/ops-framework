/**
 * Mejlkö och utskick på nodsidan (ops-framework#101, lifehub.app#103 lane 18A).
 *
 * ⛔ RAMVERKET KÄNNER INGA ADRESSER. Samlingsnamn, SMTP-värd, port, secure,
 * auth och avsändare skickar appen in. En förvald värd hade varit LifeHubs
 * Gmail inbakad i ett paket bolag-ops också får.
 *
 * ⛔ HEMLIGHETERNA LÄSES INTE HÄR, OCH INTE NÄR MODULEN LADDAS. Appens funktion
 * binder dem och läser dem i anropet, och skickar in `auth`. En läsning i den
 * här filen hade kört innan funktionen fått dem, eller fångat ett tomt värde
 * vid kallstart.
 *
 * ⛔ KVITTOT SKRIVS PÅ SAMMA DOKUMENT. SessionStudio svarade "sent" så fort
 * anropet återvände, och kunde sedan inte säga om mottagarservern sagt ja.
 * Här betyder `skickad` att servern accepterade minst en mottagare och avvisade
 * ingen. Allt annat är `fel`, med serverns svar, eller `hoppad` när vi aldrig
 * frågade (spärrad domän). Ett fel som inte får en rad är ett fel som ser ut
 * som att allt gick bra.
 *
 * ⛔ INGEN RIKTIG SMTP I PROV. `createMockMailTransport` tar emot utskicket.
 * `createNodemailerTransport` är adaptern appen använder i funktionen.
 *
 * ⛔ VARJE MEJL SKICKAS EN GÅNG (0.76.2, granskningen av PR 294). `onDocumentCreated`
 * levereras minst en gång, och händelsens dokument står alltid på `koad`. Före 0.76.2
 * läste utskicket aldrig dokumentets status, och ett prov gav tre utskick av samma
 * dokument. Nu läser `skicka(id)` dokumentet ur källan och tar det med ett atomärt
 * anspråk (`updateIf`, `koad` till `skickas`, med `paborjad`) INNAN transporten
 * anropas. Står dokumentet inte på `koad` skickas inget, och dokumentet returneras.
 *
 * ⛔ DÖR PROCESSEN MELLAN ANSPRÅK OCH KVITTO står dokumentet kvar på `skickas`, och
 * det skickas INTE om automatiskt. Det är medvetet: mellan anspråket och kvittot kan
 * servern ha tagit emot mejlet, och en automatisk omkörning hade då skickat det två
 * gånger, vilket är just felet den här ordningen finns för att stänga. Raden är inte
 * tyst: `status: "skickas"` med en gammal `paborjad` är ett fastnat utskick som en
 * app kan lista och visa. Att skicka om är ett beslut, inte en automat.
 *
 * ⛔ NODEMAILER LADDAS FÖRST VID UTSKICK. Det är ett valfritt peer-beroende och
 * importeras dynamiskt i `createNodemailerTransport().send`. En statisk import här
 * hade laddat SMTP-klienten i varje app som importerar `ops-framework/node`, också
 * de utan mejl (granskningen av PR 294, B2).
 */

// @ts-expect-error Noden har crypto. Ramverket har inga Node-typer: lib är DOM, för webben.
import { createHash } from "node:crypto";
import {
  byggMejl,
  kontrolleraMejlsamling,
  normaliseraMejlsprak,
  sparradMejldoman,
} from "../lib/mejl.js";

export {
  SPARRADA_MEJLDOMANER,
  byggMejl,
  losMejlsprak,
  mejlregelfragment,
  normaliseraMejlsprak,
} from "../lib/mejl.js";

/** Serverns svarsrad kan bli lång. Ett dokument ska inte växa fritt. Samma tak som SessionStudio. */
const MAX_SVAR = 200;

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function kortaSvar(v) {
  if (typeof v !== "string") return null;
  const text = v.trim();
  return text ? text.slice(0, MAX_SVAR) : null;
}

/**
 * @param {unknown} v
 * @returns {string[]}
 */
function adresser(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.length > 0);
}

/**
 * Loggraden, samma innehåll som SessionStudios `logMailEvent`: hashat
 * mottagarnamn, antal accepterade och avvisade, serverns svar, Message-ID.
 * Adressen själv står på köns dokument, som klienten inte kan läsa, och inte
 * i loggen.
 *
 * @param {object} [b]
 * @param {"skickad" | "fel" | "hoppad" | string} [b.handling]
 * @param {string} [b.kategori]
 * @param {string} [b.till]
 * @param {string | null} [b.groupId]
 * @param {string} [b.mejlId]
 * @param {number} [b.millisekunder]
 * @param {string | null} [b.fel]
 * @param {string | null} [b.skal]
 * @param {readonly string[]} [b.accepterade]
 * @param {readonly string[]} [b.avvisade]
 * @param {string | null} [b.svar]
 * @param {string | null} [b.messageId]
 */
export function byggMejlhandelse(b = {}) {
  const till = typeof b.till === "string" ? b.till.trim().toLowerCase() : "";
  return {
    typ: "mejl",
    handling: typeof b.handling === "string" && b.handling ? b.handling : "fel",
    kategori: typeof b.kategori === "string" && b.kategori ? b.kategori : "okand",
    mottagarhash: till ? mottagarhash(till) : null,
    groupId: typeof b.groupId === "string" && b.groupId ? b.groupId : null,
    mejlId: typeof b.mejlId === "string" && b.mejlId ? b.mejlId : null,
    millisekunder: typeof b.millisekunder === "number" && Number.isFinite(b.millisekunder) ? b.millisekunder : null,
    fel: typeof b.fel === "string" && b.fel ? b.fel : null,
    skal: typeof b.skal === "string" && b.skal ? b.skal : null,
    antalAccepterade: Array.isArray(b.accepterade) ? b.accepterade.length : null,
    antalAvvisade: Array.isArray(b.avvisade) ? b.avvisade.length : null,
    svar: kortaSvar(b.svar),
    messageId: typeof b.messageId === "string" && b.messageId.trim() ? b.messageId.trim() : null,
    tid: new Date().toISOString(),
  };
}

/**
 * Hashen en adress står under i loggen: sha256 av adressen i gemener, de tolv första hextecknen. EN funktion, så att
 * `mottagarhash` i en händelse och hashen i ett maskat fel är samma tal och går att para ihop (regel 2).
 * @param {string} adress
 * @returns {string}
 */
function mottagarhash(adress) {
  return createHash("sha256").update(adress.trim().toLowerCase()).digest("hex").slice(0, 12);
}

/**
 * En e-postadress var som helst i en text: delen före och efter `@` utan blanksteg, vinkelparenteser, citattecken eller
 * skiljetecken som brukar omge en adress i ett SMTP-svar.
 */
const ADRESS_I_TEXT = /[^\s<>()"'[\],;:@]+@[^\s<>()"'[\],;:@]+/g;

/**
 * Byter varje e-postadress i en text mot `<adress hash>` (0.84.0, #317).
 *
 * ⛔ FÖR TEXT SOM LÄMNAR RAMVERKET SOM ETT KASTAT FEL. Ett fel loggas av appen som ett ohanterat fel, förbi den maskning
 * appen gör i sin egen logg, och ett SMTP-svar bär ofta mottagarens adress ("550 5.1.1 <namn@doman>: ..."). Mätt i
 * granskningen av cllp/lifehub.app#117. Kvittot i källan maskas INTE: det är ägarens underlag, och läses bakom regler.
 *
 * @param {string} text
 * @returns {string}
 */
function maskaAdresser(text) {
  return text.replace(ADRESS_I_TEXT, (a) => `<adress ${mottagarhash(a)}>`);
}

/**
 * Statusen ett dokument står på medan det skickas. Anspråket sätter den, kvittot ersätter den.
 */
const SKICKAS = "skickas";

/**
 * @param {"skickad" | "fel" | "hoppad"} status
 * @param {{ accepterade?: string[], avvisade?: string[], svar?: string | null, messageId?: string | null, skal?: string | null, fel?: string | null }} [falt]
 */
function kvitto(status, falt = {}) {
  return {
    status,
    accepterade: falt.accepterade ?? [],
    avvisade: falt.avvisade ?? [],
    svar: kortaSvar(falt.svar),
    messageId: typeof falt.messageId === "string" && falt.messageId.trim() ? falt.messageId.trim() : null,
    tid: new Date().toISOString(),
    skal: typeof falt.skal === "string" && falt.skal ? falt.skal : null,
    fel: typeof falt.fel === "string" && falt.fel ? falt.fel : null,
  };
}

/**
 * @param {unknown} info
 */
function kvittoUrSvar(info) {
  const src = info && typeof info === "object" ? /** @type {Record<string, unknown>} */ (info) : {};
  const rawAvvisade = Array.isArray(src.rejected) ? src.rejected : [];
  const accepterade = adresser(src.accepted);
  const avvisade = adresser(rawAvvisade);
  const svar = kortaSvar(src.response);
  const messageId = typeof src.messageId === "string" ? src.messageId : null;
  const bas = { accepterade, avvisade, svar, messageId };
  if (avvisade.length > 0 || rawAvvisade.length > 0) {
    return kvitto("fel", { ...bas, skal: "Mottagaren avvisades av servern." });
  }
  if (accepterade.length === 0) {
    return kvitto("fel", { ...bas, skal: "Servern accepterade ingen mottagare." });
  }
  return kvitto("skickad", bas);
}

/**
 * Kö i datalagret. Appen skickar in samlingens namn.
 *
 * @param {object} [konfig]
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla
 * @param {string} konfig.samling
 */
export function createMailQueue(konfig) {
  const { kalla, samling } = konfig ?? {};
  if (!kalla || typeof kalla.create !== "function") {
    throw new Error("createMailQueue: en datakälla med create krävs. Ramverket känner ingen databas.");
  }
  const SAMLING = kontrolleraMejlsamling(samling, "createMailQueue");

  return {
    /**
     * @param {object} falt
     * @param {string} falt.till
     * @param {string} falt.amne
     * @param {string} [falt.text]
     * @param {string} [falt.html]
     * @param {"sv" | "en"} falt.sprak
     * @param {string} falt.kategori
     * @param {string} [falt.groupId]
     */
    async koa(falt) {
      return kalla.create(SAMLING, byggMejl(falt, "koa"));
    },
  };
}

/**
 * Tar ett köat dokument, skickar det och skriver kvittot på samma dokument.
 *
 * ⛔ KÄLLAN MÅSTE KUNNA `read` OCH `updateIf`. Anspråket är det enda som hindrar att
 * samma dokument skickas två gånger, och en källa som bara kan läsa och sedan skriva
 * kan inte ge det löftet (kontraktets regel 7).
 *
 * @param {object} [konfig]
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla
 * @param {string} konfig.samling
 * @param {{ send: (brev: { till: string, amne: string, text: string, html: string }) => Promise<any> }} konfig.transport
 * @param {(handelse: ReturnType<typeof byggMejlhandelse>) => void} [konfig.logg]
 * @param {readonly string[]} [konfig.sparradeDomaner] Lägg till domäner. De fyra inbyggda gäller alltid.
 */
export function createMailSender(konfig) {
  const { kalla, samling, transport, logg, sparradeDomaner } = konfig ?? {};
  if (!kalla || typeof kalla.update !== "function" || typeof kalla.read !== "function") {
    throw new Error("createMailSender: en datakälla med read och update krävs. Ramverket känner ingen databas.");
  }
  if (typeof kalla.updateIf !== "function") {
    throw new Error(
      "createMailSender: datakällan saknar updateIf. Utan ett atomärt anspråk (koad till skickas) kan samma mejl skickas två gånger när händelsen levereras igen. Med Admin SDK är updateIf en db.runTransaction, se README om mejl.",
    );
  }
  const villkorad = kalla.updateIf;
  const kallan = kalla;
  const SAMLING = kontrolleraMejlsamling(samling, "createMailSender");
  if (!transport || typeof transport.send !== "function") {
    throw new Error("createMailSender: en transport med send krävs. Proven skickar in mocken, appen skickar in nodemailer-adaptern.");
  }
  if (logg !== undefined && typeof logg !== "function") {
    throw new Error("createMailSender: logg är en funktion eller utelämnad.");
  }
  if (sparradeDomaner !== undefined && !Array.isArray(sparradeDomaner)) {
    throw new Error("createMailSender: sparradeDomaner är en lista eller utelämnad.");
  }
  const extra = sparradeDomaner ?? [];

  return {
    /**
     * Tar dokumentets id (eller ett dokument med `id`). Innehållet läses alltid ur källan,
     * aldrig ur argumentet: händelsens kopia är en bild av när dokumentet skapades.
     *
     * @param {string | { id?: string }} idEllerDokument
     */
    async skicka(idEllerDokument) {
      const rawId = typeof idEllerDokument === "string" ? idEllerDokument : idEllerDokument?.id;
      const id = typeof rawId === "string" ? rawId.trim() : "";
      if (!id) {
        throw new Error("skicka: dokumentets id saknas. Kvittot skrivs på samma dokument, och utan id finns det ingenstans att skriva det.");
      }
      const start = Date.now();

      // Anspråket. Bara den körning som flyttar dokumentet från koad till skickas
      // anropar transporten. Alla andra får dokumentet tillbaka som det står.
      const ansprak = await villkorad.call(kallan, SAMLING, id, { status: "koad" }, { status: SKICKAS, paborjad: new Date().toISOString() });
      if (!ansprak || !ansprak.row) {
        throw new Error(`skicka: "${SAMLING}/${id}" finns inte. Ett mejl som inte finns kan inte skickas, och det ska inte se ut som att det gick.`);
      }
      if (!ansprak.updated) return ansprak.row;
      const dokument = /** @type {{ till?: unknown, amne?: unknown, text?: unknown, html?: unknown, sprak?: unknown, kategori?: unknown, groupId?: string | null }} */ (ansprak.row);

      const till = typeof dokument.till === "string" ? dokument.till.trim().toLowerCase() : "";
      const amne = typeof dokument.amne === "string" ? dokument.amne.trim() : "";
      const text = typeof dokument.text === "string" ? dokument.text : "";
      const html = typeof dokument.html === "string" ? dokument.html : "";
      const kategori = typeof dokument.kategori === "string" ? dokument.kategori.trim() : "";

      /**
       * @param {ReturnType<typeof kvitto>} rad
       */
      async function skriv(rad) {
        try {
          return await kallan.update(SAMLING, id, rad);
        } catch (e) {
          const orsak = e instanceof Error ? e.message : String(e);
          const vad = rad.fel || rad.skal || rad.status;
          // ⛔ MASKAT (0.84.0, #317): både kvittots fel och källans svar kan bära mottagarens adress, se `maskaAdresser`.
          throw new Error(maskaAdresser(`skicka: kvittot för "${SAMLING}/${id}" (${rad.status}: ${vad}) kunde inte skrivas. ${orsak}`));
        }
      }

      /**
       * @param {any} sparad
       */
      function logga(sparad) {
        if (typeof logg !== "function") return;
        logg(
          byggMejlhandelse({
            handling: sparad.status,
            kategori,
            till,
            groupId: dokument.groupId,
            mejlId: id,
            millisekunder: Date.now() - start,
            fel: sparad.fel,
            skal: sparad.skal,
            accepterade: sparad.accepterade,
            avvisade: sparad.avvisade,
            svar: sparad.svar,
            messageId: sparad.messageId,
          }),
        );
      }

      /**
       * @param {ReturnType<typeof kvitto>} rad
       */
      async function avsluta(rad) {
        const sparad = await skriv(rad);
        logga(sparad);
        return sparad;
      }

      if (!till || !amne) return avsluta(kvitto("fel", { fel: "till och amne krävs." }));
      if (!text.trim() && !html.trim()) return avsluta(kvitto("fel", { fel: "text eller html krävs." }));
      if (!normaliseraMejlsprak(dokument.sprak)) return avsluta(kvitto("fel", { fel: "sprak måste vara sv eller en." }));

      const block = sparradMejldoman(till, extra);
      if (block.sparrad) {
        return avsluta(kvitto("hoppad", { skal: `Spärrad domän: ${block.doman}` }));
      }

      // Bara transporten. Kvittots skrivning och loggen ligger utanför, så ett fel
      // där inte skrivs över kvittot och inte försvinner i den här fångsten.
      let info;
      try {
        info = await transport.send({ till, amne, text, html });
      } catch (e) {
        const fel = e instanceof Error ? e.message : String(e);
        return avsluta(kvitto("fel", { fel }));
      }
      return avsluta(kvittoUrSvar(info));
    },
  };
}

/**
 * nodemailer mot den SMTP appen skickar in. Laddar inte nodemailer och ansluter
 * inte förrän första `send`.
 *
 * ⛔ NODEMAILER ÄR ETT VALFRITT PEER-BEROENDE. Appen som skickar mejl installerar
 * det. Saknas det kastar första `send` med det beskedet, och felet blir `fel` på
 * köns dokument, inte ett tyst bortfall.
 *
 * @param {object} [konfig]
 * @param {string} konfig.host
 * @param {number} konfig.port
 * @param {boolean} konfig.secure
 * @param {{ user: string, pass: string }} konfig.auth
 * @param {string} konfig.from
 * @param {(opts: object) => { sendMail: (mail: object) => Promise<any> }} [konfig.skapa]
 *   Ersätter nodemailers fabriksanrop i prov. Appen utelämnar den.
 */
export function createNodemailerTransport(konfig) {
  const { host, port, secure, auth, from, skapa } = konfig ?? {};
  if (typeof host !== "string" || !host.trim()) {
    throw new Error("createNodemailerTransport: host krävs. Appen skickar in SMTP-värden, ramverket känner inga adresser.");
  }
  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("createNodemailerTransport: port krävs, ett heltal mellan 1 och 65535.");
  }
  if (typeof secure !== "boolean") {
    throw new Error("createNodemailerTransport: secure krävs, true eller false.");
  }
  const user = auth && typeof auth === "object" && typeof auth.user === "string" ? auth.user : "";
  const pass = auth && typeof auth === "object" && typeof auth.pass === "string" ? auth.pass : "";
  if (!user || !pass) {
    throw new Error("createNodemailerTransport: auth.user och auth.pass krävs. Appen läser dem i funktionen, aldrig när modulen laddas.");
  }
  if (typeof from !== "string" || !from.trim()) {
    throw new Error("createNodemailerTransport: from krävs. Appen skickar in avsändaren.");
  }
  if (skapa !== undefined && typeof skapa !== "function") {
    throw new Error("createNodemailerTransport: skapa är en funktion eller utelämnad.");
  }
  const opts = { host: host.trim(), port, secure, auth: { user, pass } };
  /** @param {object} o @returns {Promise<{ sendMail: (mail: object) => Promise<any> }>} */
  const standard = async (o) => {
    let modul;
    try {
      // Variabeln håller buntare och typkontrollen borta från en modul ramverket inte kräver.
      const namn = "nodemailer";
      modul = await import(namn);
    } catch (e) {
      const orsak = e instanceof Error ? e.message : String(e);
      throw new Error(`createNodemailerTransport: nodemailer saknas. Installera nodemailer i appen för att skicka mejl (npm install nodemailer). ${orsak}`);
    }
    const fabrik = modul?.default?.createTransport ?? modul?.createTransport;
    if (typeof fabrik !== "function") {
      throw new Error("createNodemailerTransport: nodemailer saknar createTransport. Installera nodemailer i appen för att skicka mejl.");
    }
    return fabrik.call(modul?.default ?? modul, o);
  };
  /** @type {Promise<{ sendMail: (mail: object) => Promise<any> }> | null} */
  let laddad = null;
  const avsandare = from.trim();
  return {
    /**
     * @param {{ till: string, amne: string, text: string, html: string }} brev
     */
    async send(brev) {
      // Ett misslyckat försök sparas inte: installerar appen paketet ska nästa utskick lyckas.
      laddad ??= Promise.resolve((skapa ?? standard)(opts)).catch((e) => {
        laddad = null;
        throw e;
      });
      const transport = await laddad;
      if (!transport || typeof transport.sendMail !== "function") {
        laddad = null;
        throw new Error("createNodemailerTransport: transporten saknar sendMail.");
      }
      const info = await transport.sendMail({
        from: avsandare,
        to: brev.till,
        subject: brev.amne,
        text: brev.text ?? "",
        html: brev.html ?? "",
      });
      return {
        accepted: Array.isArray(info?.accepted) ? info.accepted : [],
        rejected: Array.isArray(info?.rejected) ? info.rejected : [],
        response: typeof info?.response === "string" ? info.response : "",
        messageId: typeof info?.messageId === "string" ? info.messageId : "",
      };
    },
  };
}

/**
 * Mock för prov och för ett läge där inget ska lämna maskinen.
 * Utan argument accepteras varje mottagare och inget lämnar processen.
 *
 * @param {object} [konfig]
 * @param {(brev: { till: string, amne: string, text: string, html: string }) => any | Promise<any>} [konfig.utfall]
 *   Ersätter serverns svar. Kastas felet blir det `fel` på dokumentet.
 */
export function createMockMailTransport(konfig) {
  const { utfall } = konfig ?? {};
  /** @type {{ till: string, amne: string, text: string, html: string }[]} */
  const skickade = [];
  return {
    skickade() {
      return skickade.map((b) => ({ ...b }));
    },
    rensa() {
      skickade.length = 0;
    },
    /**
     * @param {{ till: string, amne: string, text: string, html: string }} brev
     */
    async send(brev) {
      const extra = typeof utfall === "function" ? await utfall(brev) : {};
      const info = {
        accepted: Array.isArray(extra?.accepted) ? extra.accepted : [brev.till],
        rejected: Array.isArray(extra?.rejected) ? extra.rejected : [],
        response: typeof extra?.response === "string" ? extra.response : "250 2.0.0 OK mock",
        messageId: typeof extra?.messageId === "string" ? extra.messageId : `<mock-${skickade.length + 1}@test>`,
      };
      skickade.push({ till: brev.till, amne: brev.amne, text: brev.text, html: brev.html });
      return info;
    },
  };
}
