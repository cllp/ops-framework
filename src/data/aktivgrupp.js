/**
 * Datakällan insvept med den aktiva gruppen: EN regel för varje läsväg.
 *
 * ══ ⛔ HÄNDELSEN (0.35.0, #190) ═════════════════════════════════════════
 *
 * CP 2026-09-30: en ny grupp, Travel, valdes, och Idag visade fortfarande CPS
 * AB:s rader (Adavo, attest, bank). Appen svepte redan in sin datakälla så
 * att `list` och `subscribe` fick `where: { groupId }`, men `read` gick orörd
 * igenom: ett dokument pekat ut med id kom tillbaka oavsett vilken grupp det
 * tillhörde. Den som är medlem i båda grupperna fick alltså grupp A:s dokument
 * när B var aktiv, eftersom reglerna bara frågar om personen är MEDLEM i
 * radens grupp, inte om gruppen är den aktiva. Det är en fråga reglerna inte
 * kan ställa: den aktiva gruppen är ett val i klienten, inte ett faktum i
 * databasen.
 *
 * CP samma dag: "det som ska gälla för alla (bolag-ops, SessionStudio, varje
 * app på ramverket), en regel i ops-framework, inte per app." Insvepningen
 * flyttar därför hit, och täpper luckan i `read`.
 *
 * ══ ⛔ KONTRAKTET, OPERATION FÖR OPERATION ═════════════════════════════
 *
 * Bara samlingar appen pekat ut som gruppade (`gruppade`) berörs. Ramverket
 * känner aldrig samlingsnamnen: appen skickar in dem (arbetsreglerna, "Vad som
 * inte är regler här"). Första ledet i sökvägen avgör, så `inkorg/<id>/kommentarer`
 * är gruppad när `inkorg` är det.
 *
 *   list        `where.groupId` läggs på. En annan grupp i frågan KASTAR.
 *               Varje rad i svaret prövas: saknat `groupId` kastar, en annan
 *               grupps rad kastar (källan höll inte filtret).
 *   subscribe   samma som list, och ett brott går till `onError`, aldrig till
 *               `onData`.
 *   read        en rad ur en annan grupp ger `null`, alltså "finns inte" i den
 *               aktiva gruppen (kontraktets regel 3). En rad UTAN `groupId`
 *               kastar: den kan inte avgöras, och att gissa åt något håll är
 *               att antingen läcka eller tappa data i tysthet.
 *   create      `groupId` sätts till den aktiva. En annan grupp i posten kastar.
 *   update      en ändring av `groupId` till en annan grupp kastar. I övrigt
 *               orörd, se nedan.
 *   remove      orörd, se nedan.
 *   batch       varje del som create och update ovan.
 *
 * ⛔ VARFÖR `null` OCH INTE ETT FEL FÖR EN ANNAN GRUPPS DOKUMENT. Sett från den
 * aktiva gruppen finns dokumentet inte, och det är precis vad `null` betyder i
 * kontraktet. Ett kast hade gjort varje vy som läser ett känt dokument-id
 * (`read("data", "kundfakturor")`) till en röd banderoll i varje grupp utom en,
 * fast det enda som hänt är att gruppen saknar dokumentet. Vyn ritar redan sitt
 * tomma läge för `null`, och det är rätt besked.
 *
 * ⛔ VARFÖR ETT FEL FÖR EN RAD UTAN `groupId`. CP:s punkt 2: "En rad utan
 * `groupId` är ett fel och sorteras inte bort tyst." En sådan rad är en
 * bakfyllnad som inte gjorts, och `null` hade dolt den bakom ett tomt läge.
 *
 * ⛔ `update` OCH `remove` LÄSER INTE FÖRST. Att slå upp raden före varje
 * skrivning vore en läs-sedan-skriv-kontroll (arbetsreglernas punkt 2) och en
 * extra läsning per skrivning. Skrivvägarna till en rad går i praktiken genom
 * en rad som redan LÄSTS genom den här källan, och den läsningen är stängd för
 * andra grupper. Reglerna vaktar resten: `gruppenOandrad()` hindrar flytt, och
 * gruppade samlingar har `delete: if false`.
 *
 * ══ ⛔ EN NY KÄLLA PER GRUPP, INTE ETT MUTERBART ID ════════════════════
 *
 * Läscachen (`readCache.js`) är nycklad på källan och frågan, och frågan bär
 * inte `groupId` (den läggs på här inne). Bytte en källa grupp under samma
 * objekt fick en vy som redan läst "ledger_items" den förra gruppens rader ur
 * cachen. Bygg därför källan med `useMemo(() => medAktivGrupp(kalla, {...}),
 * [kalla, groupId])` och ge `OpsDataProvider` den nya.
 *
 * ══ ⛔ INGEN VÄG FÖRBI DEN AKTIVA GRUPPEN ══════════════════════════════
 *
 * Det finns ingen läsning över flera grupper. CP 2026-09-30: "Det är ingen
 * privat grupp. Jag har en grupp som heter bolaget, men jag måste ha
 * privatekonomi där för att få en total översikt. Det är bara en grupp.
 * Ekonomimodulen bor där." Privat, Företag och Samlat är flikar över data i
 * EN grupp, och en samlad vy är en fråga till den gruppen, inte till flera.
 */

/**
 * @param {unknown} v
 * @returns {boolean}
 */
const saknas = (v) => v === undefined || v === null || v === "";

/**
 * @param {Record<string, any>} rad
 * @param {string} samling
 * @param {string} groupId
 * @param {string} vem
 */
function provaRad(rad, samling, groupId, vem) {
  if (saknas(rad?.groupId)) {
    throw new Error(
      `medAktivGrupp.${vem}: raden "${rad?.id}" i "${samling}" saknar groupId. En rad utan grupp i en gruppad samling är ett fel och sorteras inte bort tyst: bakfyll fältet.`,
    );
  }
  if (rad.groupId !== groupId) {
    throw new Error(
      `medAktivGrupp.${vem}: raden "${rad.id}" i "${samling}" tillhör gruppen "${rad.groupId}", men den aktiva gruppen är "${groupId}". Källan höll inte gruppfiltret, och raden visas inte.`,
    );
  }
}

/**
 * Datakällan med den aktiva gruppen pålagd på varje läsväg.
 *
 * @template {{ id: string }} T
 * @param {import("./contract.js").DataSource<T> & Record<string, any>} kalla Källan UTAN gruppinsvepning.
 * @param {object} arg
 * @param {string} arg.groupId Den aktiva gruppen, ur `aktivGrupp`.
 * @param {ReadonlyArray<string>} arg.gruppade Samlingarna som bär `groupId`. Appens namn, aldrig ramverkets.
 * @returns {import("./contract.js").DataSource<T> & { aktivGrupp: string }}
 */
export function medAktivGrupp(kalla, { groupId, gruppade } = /** @type {any} */ ({})) {
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.list !== "function") {
    throw new Error("medAktivGrupp: en datakälla krävs (ur createDataSource eller en av adaptrarna).");
  }
  const grupp = typeof groupId === "string" ? groupId.trim() : "";
  if (!grupp) {
    /*
     * ⛔ EN TOM GRUPP ÄR ETT STOPP OCH INTE ETT FÖRVAL. Med `groupId: undefined`
     * i filtret avvisar Firestore frågan med samma text som ett behörighetsfel,
     * och letandet börjar på fel ställe. Har personen inga grupper finns ingen
     * källa att svepa in: appen visar sin tomma vy.
     */
    throw new Error("medAktivGrupp: groupId krävs och får inte vara tomt. Det finns alltid exakt en aktiv grupp; utan grupp finns inget att läsa.");
  }
  if (!Array.isArray(gruppade) || gruppade.length === 0) {
    /*
     * ⛔ EN TOM LISTA ÄR ETT GOLV SOM INTE BÄR (arbetsreglernas punkt 4). En
     * insvepning utan gruppade samlingar gör ingenting och ser ändå ut som ett
     * skydd. En app utan grupper ska inte svepa in sin källa alls.
     */
    throw new Error("medAktivGrupp: gruppade krävs, en lista med minst en samling. En insvepning som inte gäller någon samling ser ut som ett skydd och är inget.");
  }
  const gruppadeMangd = new Set(gruppade.map((s) => String(s).split("/")[0]));
  /** @param {string} samling */
  const arGruppad = (samling) => gruppadeMangd.has(String(samling).split("/")[0]);

  /**
   * @param {import("./contract.js").Query | undefined} fraga
   * @param {string} samling
   * @param {string} vem
   */
  const medGruppIFragan = (fraga, samling, vem) => {
    const onskad = fraga?.where?.groupId;
    if (onskad !== undefined && onskad !== grupp) {
      throw new Error(
        `medAktivGrupp.${vem}: frågan mot "${samling}" ber om groupId "${onskad}", men den aktiva gruppen är "${grupp}". Gruppen sätts av källan och inte av vyn, och det finns ingen läsning förbi den aktiva gruppen.`,
      );
    }
    return { ...(fraga ?? {}), where: { ...(fraga?.where ?? {}), groupId: grupp } };
  };

  /**
   * @param {Record<string, any>} data
   * @param {string} samling
   * @param {string} vem
   */
  const medGruppIPosten = (data, samling, vem) => {
    if (!saknas(data?.groupId) && data.groupId !== grupp) {
      throw new Error(
        `medAktivGrupp.${vem}: posten i "${samling}" bär groupId "${data.groupId}", men den aktiva gruppen är "${grupp}". Allt som skapas hamnar i den aktiva gruppen.`,
      );
    }
    return { ...data, groupId: grupp };
  };

  /**
   * @param {Record<string, any>} data
   * @param {string} samling
   */
  const provaUppdatering = (data, samling) => {
    if (data && Object.prototype.hasOwnProperty.call(data, "groupId") && data.groupId !== grupp) {
      throw new Error(
        `medAktivGrupp.update: ändringen i "${samling}" sätter groupId "${data.groupId}", men den aktiva gruppen är "${grupp}". En rad flyttas inte mellan grupper.`,
      );
    }
  };

  /** @type {any} */
  const svept = {
    // ⛔ SVEPER IN OCH ÄRVER INTE: `name`, `canSubscribe` och `sourceFor` följer med, och `canSubscribe` är det ramverket frågar innan det strömmar.
    ...kalla,
    aktivGrupp: grupp,

    /** @param {string} samling @param {string} id */
    async read(samling, id) {
      const rad = await kalla.read(samling, id);
      if (!arGruppad(samling) || rad === null || rad === undefined) return rad ?? null;
      const r = /** @type {Record<string, any>} */ (rad);
      if (saknas(r.groupId)) {
        throw new Error(
          `medAktivGrupp.read: dokumentet "${samling}/${id}" saknar groupId. En rad utan grupp i en gruppad samling är ett fel och sorteras inte bort tyst: bakfyll fältet.`,
        );
      }
      // ⛔ EN ANNAN GRUPPS DOKUMENT FINNS INTE I DEN AKTIVA GRUPPEN. Se filhuvudet för varför det är `null` och inte ett kast.
      return r.groupId === grupp ? rad : null;
    },

    /** @param {string} samling @param {import("./contract.js").Query} [fraga] */
    async list(samling, fraga) {
      if (!arGruppad(samling)) return kalla.list(samling, fraga);
      const rader = await kalla.list(samling, medGruppIFragan(fraga, samling, "list"));
      for (const rad of rader) provaRad(/** @type {any} */ (rad), samling, grupp, "list");
      return rader;
    },

    /** @param {string} samling @param {Partial<T>} data */
    create(samling, data) {
      return kalla.create(samling, arGruppad(samling) ? /** @type {any} */ (medGruppIPosten(/** @type {any} */ (data), samling, "create")) : data);
    },

    /** @param {string} samling @param {string} id @param {Partial<T>} data */
    update(samling, id, data) {
      if (arGruppad(samling)) provaUppdatering(/** @type {any} */ (data), samling);
      return kalla.update(samling, id, data);
    },

  };

  if (typeof kalla.subscribe === "function") {
    const prenumerera = kalla.subscribe;
    /**
     * @param {string} samling
     * @param {import("./contract.js").Query | undefined} fraga
     * @param {import("./contract.js").Listener<T>} lyssnare
     */
    svept.subscribe = (samling, fraga, lyssnare) => {
      if (!arGruppad(samling)) return prenumerera(samling, fraga, lyssnare);
      return prenumerera(samling, medGruppIFragan(fraga, samling, "subscribe"), {
        onData: (rader) => {
          try {
            for (const rad of rader) provaRad(/** @type {any} */ (rad), samling, grupp, "subscribe");
          } catch (fel) {
            // ⛔ ETT BROTT GÅR TILL `onError`, ALDRIG TILL `onData`. En lista med en annan grupps rad är värre än ingen lista.
            lyssnare.onError(fel instanceof Error ? fel : new Error(String(fel)));
            return;
          }
          lyssnare.onData(rader);
        },
        onError: (fel) => lyssnare.onError(fel),
      });
    };
  }

  if (typeof kalla.batch === "function") {
    const batcha = kalla.batch;
    /** @param {ReadonlyArray<import("./contract.js").BatchOp<T>>} ops */
    svept.batch = (ops) =>
      batcha(
        ops.map((op) => {
          if (!arGruppad(op.collection)) return op;
          if (op.op === "create") return { ...op, data: /** @type {any} */ (medGruppIPosten(/** @type {any} */ (op.data), op.collection, "batch")) };
          if (op.op === "update") provaUppdatering(/** @type {any} */ (op.data), op.collection);
          return op;
        }),
      );
  }

  return svept;
}
