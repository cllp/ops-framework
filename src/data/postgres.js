import { createDataSource } from "./contract.js";

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
 * import { createPostgresSource } from "@staiger/ops-framework";
 *
 * const pool = new Pool({ ... });
 * const kalla = createPostgresSource({
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
 * @param {string} name @returns {string}
 */
function identifier(name) {
  if (typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(
      `postgres: "${name}" duger inte som tabell- eller kolumnnamn. Endast bokstäver, siffror och understreck, och inte inledande siffra. ` +
        "Namn kan inte skickas som parametrar, så ett namn som släpps igenom är en väg in för SQL-injektion.",
    );
  }
  return `"${name}"`;
}

/**
 * @template {{ id: string }} T
 * @param {{ query: (sql: string, params: unknown[]) => Promise<any[]>, idColumn?: string }} config
 * @returns {import("./contract.js").DataSource<T>}
 */
export function createPostgresSource(config) {
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
  const { query, idColumn = "id" } = config ?? /** @type {any} */ ({});
  if (typeof query !== "function") {
    throw new Error("createPostgresSource: fraga krävs och ska vara en funktion (sql, params) => Promise<rader>.");
  }
  const ID = identifier(idColumn);

  return createDataSource({
    name: "postgres",

    async read(collectionName, id) {
      const rows = await query(`SELECT * FROM ${identifier(collectionName)} WHERE ${ID} = $1 LIMIT 1`, [id]);
      // ⛔ `?? null` och inte `|| null`: ett tomt objekt eller nollvärde är ett
      // giltigt svar och ska inte förvandlas till "finns inte".
      return rows[0] ?? null;
    },

    async list(collectionName, queryArg) {
      const params = [];
      let sql = `SELECT * FROM ${identifier(collectionName)}`;

      if (queryArg?.where) {
        const delar = Object.entries(queryArg.where).map(([field, value]) => {
          params.push(value);
          return `${identifier(field)} = $${params.length}`;
        });
        if (delar.length > 0) sql += ` WHERE ${delar.join(" AND ")}`;
      }

      if (queryArg?.sortBy) {
        // Riktningen är en sluten mängd, aldrig inskickad text.
        sql += ` ORDER BY ${identifier(queryArg.sortBy)} ${queryArg.direction === "desc" ? "DESC" : "ASC"}`;
      }

      if (typeof queryArg?.limit === "number") {
        params.push(queryArg.limit);
        sql += ` LIMIT $${params.length}`;
      }

      return query(sql, params);
    },

    async create(collectionName, data) {
      const poster = Object.entries(/** @type {any} */ (data));
      if (poster.length === 0) throw new Error("postgres: skapa utan fält. En tom rad är nästan alltid ett programfel.");

      const columns = poster.map(([k]) => identifier(k)).join(", ");
      const placeholders = poster.map((_, i) => `$${i + 1}`).join(", ");
      const rows = await query(
        `INSERT INTO ${identifier(collectionName)} (${columns}) VALUES (${placeholders}) RETURNING *`,
        poster.map(([, v]) => v),
      );
      // RETURNING, inte en gissning: databasen kan sätta id, tidsstämplar och
      // standardvärden som appen inte känner till.
      return rows[0];
    },

    async update(collectionName, id, data) {
      const poster = Object.entries(/** @type {any} */ (data)).filter(([k]) => k !== idColumn);
      if (poster.length === 0) throw new Error("postgres: uppdatera utan fält att ändra.");

      const satt = poster.map(([k], i) => `${identifier(k)} = $${i + 1}`).join(", ");
      const params = [...poster.map(([, v]) => v), id];
      const rows = await query(
        `UPDATE ${identifier(collectionName)} SET ${satt} WHERE ${ID} = $${params.length} RETURNING *`,
        params,
      );

      // ⛔ Noll rader betyder att posten inte fanns. Att returnera undefined
      // hade låtit anropsstället tro att uppdateringen lyckades.
      if (rows.length === 0) throw new Error(`postgres: ${collectionName}/${id} finns inte. Ingen rad uppdaterades.`);
      return rows[0];
    },

    async remove(collectionName, id) {
      const rows = await query(`DELETE FROM ${identifier(collectionName)} WHERE ${ID} = $1 RETURNING ${ID}`, [id]);
      if (rows.length === 0) throw new Error(`postgres: ${collectionName}/${id} finns inte. Ingen rad togs bort.`);
    },
  });
}
