import { skapaDatakalla } from "./kontrakt.js";

/**
 * Adapter mot Postgres, till exempel Cloud SQL i Google Cloud.
 *
 * ⛔ RAMVERKET IMPORTERAR INTE NÅGON DATABASDRIVRUTIN. Appen skickar in en
 * funktion som kör en fråga.
 *
 * Det gör adaptern oberoende av HUR kopplingen ser ut: `pg` i en Cloud Function,
 * Cloud SQL Connector, en poolad klient, eller ett eget API-anrop. Ramverket
 * äger översättningen från CRUD till SQL, appen äger kopplingen.
 *
 * ```js
 * import { Pool } from "pg";
 * import { skapaPostgresKalla } from "@staiger/ops-framework";
 *
 * const pool = new Pool({ ... });
 * const kalla = skapaPostgresKalla({
 *   fraga: async (sql, params) => (await pool.query(sql, params)).rows,
 * });
 * ```
 *
 * ⛔ Adaptern hör hemma i en webbläsare ENDAST bakom ett eget API. En
 * databasuppkoppling från klienten innebär att uppgifterna finns i klienten.
 */

/**
 * ⛔ SÄKERHETSKRITISKT. Läs innan du ändrar något här.
 *
 * Värden kan skickas som parametrar (`$1`), men **tabell- och kolumnnamn kan
 * inte**. De måste in i SQL-texten, och det är exakt där SQL-injektion uppstår.
 *
 * Därför valideras varje identifierare hårt och citeras. Ett namn som inte
 * matchar avvisas med ett fel i stället för att skickas vidare, för en
 * injektion som går igenom syns inte i något testfall.
 *
 * @param {string} namn @returns {string}
 */
function identifierare(namn) {
  if (typeof namn !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(namn)) {
    throw new Error(
      `postgres: "${namn}" duger inte som tabell- eller kolumnnamn. Endast bokstäver, siffror och understreck, och inte inledande siffra. ` +
        "Namn kan inte skickas som parametrar, så ett namn som släpps igenom är en väg in för SQL-injektion.",
    );
  }
  return `"${namn}"`;
}

/**
 * @template {{ id: string }} T
 * @param {{ fraga: (sql: string, params: unknown[]) => Promise<any[]>, idKolumn?: string }} konfig
 * @returns {import("./kontrakt.js").Datakalla<T>}
 */
export function skapaPostgresKalla(konfig) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN OCH INTE I PARAMETERLISTAN (#129 punkt 5).
   *
   * Med `({ x })` i signaturen kraschar ett anrop UTAN argument på destrukturen,
   * med "Cannot destructure property 'x' of 'undefined'". Det felet nämner en
   * variabel inne i ramverket och inte vad appen glömde, och det pekar mot en fil
   * anroparen aldrig öppnat.
   *
   * ⛔ `= {}` I SIGNATUREN VAR FEL SVAR: typkontrollen avvisade det, och med rätta.
   * Typen säger att fälten krävs, och det ska den fortsätta göra, annars tappar en
   * typad anropare sitt kompileringsfel. Nu får båda vad de behöver: typen är
   * strikt, och kroppen tål ingenting så att valideringen nedan hinner tala.
   */
  const { fraga, idKolumn = "id" } = konfig ?? /** @type {any} */ ({});
  if (typeof fraga !== "function") {
    throw new Error("skapaPostgresKalla: fraga krävs och ska vara en funktion (sql, params) => Promise<rader>.");
  }
  const ID = identifierare(idKolumn);

  return skapaDatakalla({
    namn: "postgres",

    async las(samling, id) {
      const rader = await fraga(`SELECT * FROM ${identifierare(samling)} WHERE ${ID} = $1 LIMIT 1`, [id]);
      // ⛔ `?? null` och inte `|| null`: ett tomt objekt eller nollvärde är ett
      // giltigt svar och ska inte förvandlas till "finns inte".
      return rader[0] ?? null;
    },

    async lista(samling, fragaVal) {
      const params = [];
      let sql = `SELECT * FROM ${identifierare(samling)}`;

      if (fragaVal?.dar) {
        const delar = Object.entries(fragaVal.dar).map(([falt, varde]) => {
          params.push(varde);
          return `${identifierare(falt)} = $${params.length}`;
        });
        if (delar.length > 0) sql += ` WHERE ${delar.join(" AND ")}`;
      }

      if (fragaVal?.sortera) {
        // Riktningen är en sluten mängd, aldrig inskickad text.
        sql += ` ORDER BY ${identifierare(fragaVal.sortera)} ${fragaVal.riktning === "ner" ? "DESC" : "ASC"}`;
      }

      if (typeof fragaVal?.antal === "number") {
        params.push(fragaVal.antal);
        sql += ` LIMIT $${params.length}`;
      }

      return fraga(sql, params);
    },

    async skapa(samling, data) {
      const poster = Object.entries(/** @type {any} */ (data));
      if (poster.length === 0) throw new Error("postgres: skapa utan fält. En tom rad är nästan alltid ett programfel.");

      const kolumner = poster.map(([k]) => identifierare(k)).join(", ");
      const platser = poster.map((_, i) => `$${i + 1}`).join(", ");
      const rader = await fraga(
        `INSERT INTO ${identifierare(samling)} (${kolumner}) VALUES (${platser}) RETURNING *`,
        poster.map(([, v]) => v),
      );
      // RETURNING, inte en gissning: databasen kan sätta id, tidsstämplar och
      // standardvärden som appen inte känner till.
      return rader[0];
    },

    async uppdatera(samling, id, data) {
      const poster = Object.entries(/** @type {any} */ (data)).filter(([k]) => k !== idKolumn);
      if (poster.length === 0) throw new Error("postgres: uppdatera utan fält att ändra.");

      const satt = poster.map(([k], i) => `${identifierare(k)} = $${i + 1}`).join(", ");
      const params = [...poster.map(([, v]) => v), id];
      const rader = await fraga(
        `UPDATE ${identifierare(samling)} SET ${satt} WHERE ${ID} = $${params.length} RETURNING *`,
        params,
      );

      // ⛔ Noll rader betyder att posten inte fanns. Att returnera undefined
      // hade låtit anropsstället tro att uppdateringen lyckades.
      if (rader.length === 0) throw new Error(`postgres: ${samling}/${id} finns inte. Ingen rad uppdaterades.`);
      return rader[0];
    },

    async taBort(samling, id) {
      const rader = await fraga(`DELETE FROM ${identifierare(samling)} WHERE ${ID} = $1 RETURNING ${ID}`, [id]);
      if (rader.length === 0) throw new Error(`postgres: ${samling}/${id} finns inte. Ingen rad togs bort.`);
    },
  });
}
