/**
 * Mejlkö och utskick på nodsidan (ops-framework#101, lifehub.app#103 lane 18 A).
 *
 * ══ ⛔ VARFÖR NODSIDAN ═════════════════════════════════════════════════
 *
 * Kön bär mottagaradresser, och utskicket bär ett lösenord till en SMTP-server.
 * Ingendera får ligga i en fil som webbläsaren laddar. `check-node-side` gör
 * den gränsen till ett rött bygge, inte till en kommentar.
 *
 * ⛔ TRANSPORTEN ÄR EN ADAPTER. Appen skickar in `host`, `port`, `secure`,
 * `auth` och `from`. Ramverket läser inte `MAIL_USER`, `MAIL_PASS` eller någon
 * annan variabel, varken vid laddning eller vid anropet: en läsning här hade
 * döpt appens hemligheter åt den. Prov och CI använder `createMockTransport`
 * och skickar inget riktigt mejl.
 *
 * ⛔ ETT FEL SKRIVS PÅ SAMMA DOKUMENT. Saknad transport, spärrad domän, kast
 * från servern och en avvisad mottagare blir alla `status: "fel"` med `orsak`.
 * Funktionen kastar bara när det inte finns ett dokument att skriva på.
 */

import {
  byggMejl,
  granskaMejl,
  kvittoAvTransport,
  mejlKvitto,
  mejlsamlingsnamn,
  sparradMejldoman,
} from "../lib/mejl.js";

/**
 * @param {unknown} konfig
 * @returns {{ from: string, sendMail: (meddelande: { to: string, subject: string, text: string, html: string, from?: string }) => Promise<unknown>, skickade: unknown[] }}
 */
export function createMockTransport(konfig) {
  const { from, sendMail } = /** @type {{ from?: unknown, sendMail?: unknown }} */ (
    konfig && typeof konfig === "object" ? konfig : {}
  );
  if (typeof from !== "string" || !from.trim()) {
    throw new Error("createMockTransport: from krävs. Ramverket känner ingen avsändare, appen eller provet skickar in den.");
  }
  /** @type {unknown[]} */
  const skickade = [];
  return {
    from: from.trim(),
    skickade,
    /**
     * @param {{ to: string, subject: string, text: string, html: string, from?: string }} meddelande
     */
    async sendMail(meddelande) {
      skickade.push(meddelande);
      if (typeof sendMail === "function") return sendMail(meddelande);
      return {
        accepted: [meddelande.to],
        rejected: [],
        response: "250 2.0.0 OK mock",
        messageId: `<mock-${skickade.length}@prov>`,
      };
    },
  };
}

/**
 * Nodemailer mot den server appen namnger. Ingenting skickas förrän
 * `sendMail` anropas, och paketet laddas då, inte när den här modulen laddas.
 *
 * @param {unknown} konfig
 * @returns {{ from: string, sendMail: (meddelande: { to: string, subject: string, text: string, html: string, from?: string }) => Promise<unknown> }}
 */
export function createNodemailerTransport(konfig) {
  const { host, port, secure, auth, from } = /** @type {{ host?: unknown, port?: unknown, secure?: unknown, auth?: unknown, from?: unknown }} */ (
    konfig && typeof konfig === "object" ? konfig : {}
  );
  if (typeof host !== "string" || !host.trim()) {
    throw new Error("createNodemailerTransport: host krävs. Ramverket känner ingen server.");
  }
  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("createNodemailerTransport: port krävs och ska vara ett heltal. Ramverket känner ingen port.");
  }
  if (typeof secure !== "boolean") {
    throw new Error("createNodemailerTransport: secure krävs och ska vara true eller false.");
  }
  const user = auth && typeof auth === "object" ? /** @type {{ user?: unknown, pass?: unknown }} */ (auth).user : undefined;
  const pass = auth && typeof auth === "object" ? /** @type {{ user?: unknown, pass?: unknown }} */ (auth).pass : undefined;
  if (typeof user !== "string" || !user) {
    throw new Error("createNodemailerTransport: auth.user krävs. Appen läser hemligheten i anropet, inte när modulen laddas.");
  }
  if (typeof pass !== "string" || !pass) {
    throw new Error("createNodemailerTransport: auth.pass krävs. Appen läser hemligheten i anropet, inte när modulen laddas.");
  }
  if (typeof from !== "string" || !from.trim()) {
    throw new Error("createNodemailerTransport: from krävs. Ramverket känner ingen avsändare.");
  }

  const installningar = { host: host.trim(), port, secure, auth: { user, pass } };
  const avsandare = from.trim();
  /** @type {{ sendMail: (meddelande: Record<string, unknown>) => Promise<Record<string, unknown>> } | null} */
  let transporter = null;

  return {
    from: avsandare,
    /**
     * @param {{ to: string, subject: string, text: string, html: string, from?: string }} meddelande
     */
    async sendMail(meddelande) {
      if (!transporter) {
        const mod = await import("nodemailer");
        const skapa = mod.createTransport ?? mod.default?.createTransport;
        if (typeof skapa !== "function") {
          throw new Error("createNodemailerTransport: nodemailer.createTransport saknas.");
        }
        transporter = skapa(installningar);
      }
      return transporter.sendMail({
        from: meddelande.from ?? avsandare,
        to: meddelande.to,
        subject: meddelande.subject,
        text: meddelande.text,
        html: meddelande.html,
      });
    },
  };
}

/**
 * @typedef {object} Mejlkalla
 * @property {(samling: string, id: string) => Promise<any>} read
 * @property {(samling: string, data: any) => Promise<any>} create
 * @property {(samling: string, id: string, data: any) => Promise<any>} update
 */

/**
 * Kön och utskickaren, mot samma samling.
 *
 * @param {unknown} konfig
 * @returns {{ koa: (inmatning: unknown) => Promise<any>, skicka: (id: string, val?: { transport?: unknown }) => Promise<any> }}
 */
export function createMailService(konfig) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN. I parameterlistan kastar Node innan
   * valideringen hinner säga vilken fabrik som saknar vad
   * (`check-config-requirements`).
   */
  const { kalla, samling, nu } = /** @type {{ kalla?: Mejlkalla, samling?: unknown, nu?: unknown }} */ (
    konfig && typeof konfig === "object" ? konfig : {}
  );
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.create !== "function" || typeof kalla.update !== "function") {
    throw new Error("createMailService: en datakälla med read, create och update krävs. Ramverket känner ingen databas.");
  }
  const namn = mejlsamlingsnamn(samling, "createMailService");
  const klocka = nu ?? (() => new Date().toISOString());
  if (typeof klocka !== "function") {
    throw new Error("createMailService: nu måste vara en funktion som ger tiden, eller utelämnas.");
  }

  /**
   * @param {string} id
   * @param {ReturnType<typeof mejlKvitto>} kvitto
   */
  const skriv = (id, kvitto) => kalla.update(namn, id, kvitto);

  return {
    /**
     * Lägger ett mejl i kön. Skriver inte kvittot: utskickaren gör det när den
     * har ett svar, eller ett skäl att inte skicka.
     *
     * @param {unknown} inmatning
     */
    async koa(inmatning) {
      const mejl = byggMejl(inmatning);
      return kalla.create(namn, mejl);
    },

    /**
     * Tar ett köat dokument, skickar det och skriver kvittot på samma dokument.
     *
     * Ett dokument som redan är `skickad` eller `fel` rörs inte och skickas
     * inte igen. Ett nytt försök är ett nytt dokument, så varje försök har
     * sitt eget kvitto.
     *
     * @param {string} id
     * @param {{ transport?: unknown }} [val]
     *   `transport` är antingen adaptern eller en funktion som bygger den.
     *   Funktionen anropas här, inne i utskicket, så appen kan läsa sina
     *   hemligheter då och inte när funktionsmodulen laddas.
     */
    async skicka(id, val) {
      const dokumentId = typeof id === "string" ? id.trim() : "";
      if (!dokumentId) throw new Error("createMailService: skicka kräver dokumentets id.");
      const dok = await kalla.read(namn, dokumentId);
      if (!dok) {
        throw new Error(`createMailService: "${dokumentId}" finns inte i "${namn}". Kvittot kan inte skrivas på ett dokument som saknas.`);
      }
      if (dok.status === "skickad" || dok.status === "fel") return dok;
      if (dok.status != null && dok.status !== "koad") {
        return skriv(dokumentId, mejlKvitto({ status: "fel", tid: klocka(), orsak: `Okänd status: ${dok.status}` }));
      }

      const granskad = granskaMejl(dok);
      if (!granskad.ok) {
        return skriv(dokumentId, mejlKvitto({ status: "fel", tid: klocka(), orsak: granskad.orsak }));
      }
      const mejl = granskad.mejl;

      const sparr = sparradMejldoman(mejl.till);
      if (sparr.sparrad) {
        return skriv(
          dokumentId,
          mejlKvitto({ status: "fel", tid: klocka(), orsak: `Spärrad domän: ${sparr.doman}` }),
        );
      }

      /** @type {{ from?: unknown, sendMail?: unknown } | null | undefined} */
      let transport;
      try {
        const given = val?.transport;
        transport = typeof given === "function" ? await given() : given;
      } catch (e) {
        const meddelande = e instanceof Error ? e.message : String(e);
        return skriv(dokumentId, mejlKvitto({ status: "fel", tid: klocka(), orsak: meddelande || "Transporten kunde inte skapas." }));
      }
      if (!transport || typeof transport.sendMail !== "function" || typeof transport.from !== "string" || !transport.from.trim()) {
        return skriv(
          dokumentId,
          mejlKvitto({
            status: "fel",
            tid: klocka(),
            orsak: "Transporten saknar from eller sendMail. Ramverket känner ingen avsändare och ingen server.",
          }),
        );
      }

      const brev = {
        from: transport.from.trim(),
        to: /** @type {string} */ (mejl.till),
        subject: /** @type {string} */ (mejl.amne),
        text: /** @type {string} */ (mejl.text),
        html: /** @type {string} */ (mejl.html),
      };
      try {
        const info = await transport.sendMail(brev);
        return skriv(dokumentId, kvittoAvTransport(info, klocka()));
      } catch (e) {
        const meddelande = e instanceof Error ? e.message : String(e);
        return skriv(dokumentId, kvittoAvTransport(e, klocka(), meddelande || "Utskicket kastade utan meddelande."));
      }
    },
  };
}
