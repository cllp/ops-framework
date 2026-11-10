/**
 * Ärendets form. Strukturen är ramverkets, taxonomin är appens.
 *
 * ══ ⛔ VAR GRÄNSEN GÅR, OCH VARFÖR DEN GÅR DÄR ═══════════════════════════
 *
 * Ramverket äger MEKANIKEN: att en post har en sort och en prioritet, att den
 * bär vem som skickade in den och när, att `status` och `resultat` tillhör
 * servern och aldrig klienten, att etiketterna är basen plus sorten plus prion,
 * och att validering svarar med SKÄL i stället för ett ja eller nej.
 *
 * Appen äger VÄRDENA: vilka sorter som finns, vad de heter, vad de är till för,
 * vilken etikett de får, vilka extra fält just den sorten kräver, och vilken
 * text som visas när något saknas.
 *
 * ⛔ ETT ORD SOM "KVITTO" FÅR ALDRIG STÅ I DEN HÄR FILEN. Ett kvitto är ett
 * bokföringsbegrepp i en viss verksamhet, inte en egenskap hos ärenden. Står det
 * här har ramverket tagit ställning till vad plattformen handlar om, och nästa
 * app som vill ha en femte sort måste antingen leva med vår vokabulär eller
 * bygga sin egen modell vid sidan av. Det är precis den duplicering gränsen
 * finns för att stoppa.
 *
 * ══ ⛔ VAD SOM INTE FLYTTADE HIT, OCH VARFÖR ═════════════════════════════
 *
 * Fältet `kvitto` med belopp, datum och moms stannar i appen, som `extraFields`.
 * Samma sak med taket för bilagan: det följer av LAGRINGEN (ett Firestore-
 * dokument får vara 1 048 576 byte) och inte av vad ett ärende är. En app som
 * lagrar i Postgres har ett helt annat tak, och en konstant här hade gällt båda.
 */

/**
 * @typedef {object} Kind
 * @property {string} value Nyckeln som lagras.
 * @property {string} label Vad människor kallar den.
 * @property {string} externalLabel Vad som skickas vidare, till exempel till ett ärendesystem.
 * @property {(draft: any) => string[]} [requirements] Extra villkor för just den här sorten.
 *   Returnerar skälen som saknas, tom lista när allt är på plats.
 *   ⛔ EN FUNKTION OCH INTE FLAGGOR. Flaggor (`kraverBelopp: true`) tvingar ramverket
 *   att veta vad ett belopp är, och då står appens ord här igen.
 * @property {(draft: any) => Record<string, unknown>} [extraFields] App-specifika fält
 *   som ska med i dokumentet för just den sorten.
 */

/**
 * @typedef {object} Prio
 * @property {string} value
 * @property {string} label
 * @property {string} externalLabel
 */

/**
 * @typedef {object} Arendekonfig
 * @property {Kind[]} kinds
 * @property {Prio[]} priorities
 * @property {string} baseLabel Etiketten varje ärende bär, oavsett sort.
 * @property {number} [maxTitle] Standard 120.
 */

/** Rubriken blir en titel i en lista, och en titel som inte ryms är ingen titel. */
const MAX_TITLE_DEFAULT = 120;

/**
 * De statusar en post kan ha: två öppna (`ny`, `pagar`), en åt sidan (`parkerad`) och två slut.
 *
 * ⛔ "PAGAR" ÄR EN STATUS OCH INGEN TAGG (CP 2026-11-03, "KÖR på pagar som riktigt
 * läge"). En tagg hade gett två sanningar om samma sak: ett ärende som är hanterat
 * och samtidigt märkt pågår (regel 2). "pagar" är ett ÖPPET läge, inget slutläge:
 * `missingAtClose` och avslut är oförändrade, och `OPEN_STATES` är den enda listan
 * över vad som räknas som öppet, så att ingen yta behöver skriva "ny" ensam.
 *
 * ⛔ "PARKERAD" ÄR OCKSÅ EN STATUS, OCH DEN ÄR VARKEN ÖPPEN ELLER ETT SLUT
 * (lifehub.app#725). Någon vill komma ihåg ärendet men inte göra det just nu.
 * I `OPEN_STATES` hade varje yta som läser den listan räknat det som arbete att
 * ta tag i, och då tar raden plats i Idag, i räknemärket och i gästens Markera
 * klar. Som slutläge hade det krävt en not om att något gjordes eller att inget
 * skulle göras, och det är inte det beslutet. `avskriven` är "inget ska göras".
 * `parkerad` är "inte nu".
 *
 * ⛔ TVÅ SLUTSTATUSAR, INTE EN. "Hanterad" betyder att något gjordes,
 * "avskriven" att någon tagit ställning till att inget skulle göras. Utan den
 * andra blir en medveten nedprioritering omöjlig att skilja från en glömska,
 * och båda ser ut som en post som slutat röra sig.
 *
 * ⛔ VÄRDENA ÄNDRAS INTE. "ny", "hanterad" och "avskriven" står i Firestore på
 * varje post som finns, "pagar" (utan å, som alla nycklar) kom 0.181.0 och
 * "parkerad" med lifehub.app#725. Ett ordbyte i gränssnittet är inte en datamigrering,
 * och den dagen de två blandas ihop blir bytet av ett ord ett fält som inte
 * går att läsa (CP 2026-09-25, cllp/bolag-ops#359).
 */
const STATES = Object.freeze({ NEW: "ny", IN_PROGRESS: "pagar", PARKED: "parkerad", HANDLED: "hanterad", DISMISSED: "avskriven" });

/**
 * Statusarna där en post är öppen. Ordningen är flödets. `parkerad` är inte med:
 * den är inte avslutad, men den ska inte räknas som arbete att ta tag i.
 *
 * ⛔ EN LISTA, och `isOpen` läser den. En yta som skriver `status === "ny"` räknar
 * en post som någon börjat på som stängd.
 */
const OPEN_STATES = Object.freeze([STATES.NEW, STATES.IN_PROGRESS]);

/**
 * Vilka övergångar som finns, på ETT ställe. Ny till pågår och tillbaka, öppen till
 * parkerad och tillbaka, öppen eller parkerad till ett slutläge (kräver not, se
 * `missingAtClose`), och ett slutläge öppnas igen till "ny". Ett slutläge går
 * aldrig direkt till "pagar" eller "parkerad": då hade en avskriven post hoppat
 * över att någon först tog ställning till att den lever igen.
 */
const TRANSITIONS = Object.freeze({
  [STATES.NEW]: Object.freeze([STATES.IN_PROGRESS, STATES.PARKED, STATES.HANDLED, STATES.DISMISSED]),
  [STATES.IN_PROGRESS]: Object.freeze([STATES.NEW, STATES.PARKED, STATES.HANDLED, STATES.DISMISSED]),
  [STATES.PARKED]: Object.freeze([STATES.NEW, STATES.IN_PROGRESS, STATES.HANDLED, STATES.DISMISSED]),
  [STATES.HANDLED]: Object.freeze([STATES.NEW]),
  [STATES.DISMISSED]: Object.freeze([STATES.NEW]),
});

/**
 * Är statusen öppen? Samma sak som `modell.isOpen`, för ytor utan en modell (gästens ärenden på servern och i vyn).
 *
 * @param {string | null | undefined} state
 */
export function isOpenCase(state) {
  return OPEN_STATES.includes(/** @type {any} */ (state));
}
const isOpenState = isOpenCase;

/** @param {string | null | undefined} from @param {string} to */
function canMoveInternal(from, to) {
  const lista = /** @type {Record<string, readonly string[]>} */ (TRANSITIONS)[String(from ?? "")];
  return Array.isArray(lista) && lista.includes(to);
}

/**
 * Bygger en övergång som inte är ett avslut, eller kastar med skälet.
 *
 * @param {string | null | undefined} from
 * @param {string} to
 * @param {string} verb
 */
function assertMove(from, to, verb) {
  if (!canMoveInternal(from, to)) {
    throw new Error(`${verb}: en post med status "${String(from)}" går inte till "${to}".`);
  }
}

/** Ett dygn i millisekunder. */
const DAY_MS = 86400000;

/**
 * Vad som saknas för att en post ska gå att avsluta.
 *
 * ⛔ MODULNIVÅ OCH INTE EN METOD SOM ANROPAR `this`. `buildClose` behöver samma
 * kontroll, och en metod som når en annan via `this` går sönder i samma sekund
 * någon skriver `const { buildClose } = modell`. Destrukturering är normalt, och
 * ett fel som bara uppstår då hittas inte av ett prov som anropar modellen helt.
 *
 * @param {string} state
 * @param {{ url?: string, not?: string } | null} [resultat]
 * @returns {string[]}
 */
function missingAtCloseInternal(state, resultat) {
  const error = [];
  if (state !== STATES.HANDLED && state !== STATES.DISMISSED) {
    error.push(`Avslut kräver statusen "${STATES.HANDLED}" eller "${STATES.DISMISSED}".`);
    return error;
  }
  const not = String((resultat || {}).not || "").trim();
  if (!not) {
    error.push(
      state === STATES.DISMISSED
        ? "Skriv varför inget gjordes. En avskrivning utan skäl läses som att någon glömde."
        : "Skriv vad som gjordes. Ett avslut utan text säger inte om något hänt.",
    );
  }
  return error;
}

/**
 * Bygger modellen ur appens konfiguration.
 *
 * ⛔ KONTROLLERAR KONFIGURATIONEN VID UPPSTART, inte vid första användningen.
 * En sort utan `externalLabel` ger annars ett ärende som saknar sin märkning, och det
 * felet syns först i ärendesystemet: posten skapades, den hamnade bara aldrig
 * där någon letar. Samma skäl som `createDataSource` kontrollerar sin adapter.
 *
 * @param {Arendekonfig} config
 */
export function createCaseModel(config) {
  if (!config || !Array.isArray(config.kinds) || config.kinds.length === 0) {
    throw new Error("createCaseModel: minst en sort krävs. Sorterna är appens taxonomi, inte ramverkets.");
  }
  if (!Array.isArray(config.priorities) || config.priorities.length === 0) {
    throw new Error("createCaseModel: minst en prio krävs.");
  }
  if (!config.baseLabel) {
    throw new Error(
      "createCaseModel: baseLabel krävs. Utan den saknar ärendet den märkning som gör att det syns där någon letar, och det felet ser ut som att ärendet aldrig skapades.",
    );
  }

  for (const list of [
    { name: "kinds", rows: config.kinds },
    { name: "priorities", rows: config.priorities },
  ]) {
    for (const row of /** @type {Record<string, any>[]} */ (list.rows)) {
      for (const falt of ["value", "label", "externalLabel"]) {
        if (!row || !row[falt]) {
          throw new Error(`createCaseModel: ${list.name} saknar "${falt}" på ${JSON.stringify(row)}.`);
        }
      }
    }
  }

  const maxTitle = config.maxTitle ?? MAX_TITLE_DEFAULT;
  /** @param {string | undefined} v */
  const sort = (v) => config.kinds.find((s) => s.value === v);
  /** @param {string | undefined} v */
  const prio = (v) => config.priorities.find((p) => p.value === v);

  return {
    kinds: config.kinds,
    priorities: config.priorities,
    baseLabel: config.baseLabel,
    maxTitle,

    /**
     * Etiketterna ett ärende ska bära: basen, sorten, prion.
     *
     * ⛔ EN FUNKTION OCH INTE EN LISTA I DOKUMENTATIONEN. Vyn visar dem och den
     * som skapar ärendet sätter dem. Står de på två ställen glider de isär den
     * dag en sort läggs till.
     */
    /** @param {{ typ?: string, prio?: string } | null | undefined} entry @returns {string[]} */
    labelsFor(entry) {
      const out = [config.baseLabel];
      const s = sort((entry || {}).typ);
      if (s) out.push(s.externalLabel);
      const p = prio((entry || {}).prio);
      if (p) out.push(p.externalLabel);
      return out;
    },

    /** Sortens namn för människor. Tom sträng när sorten är okänd, aldrig en gissning. */
    /** @param {string | undefined} v */
    kindName(v) {
      return (sort(v) || {}).label || "";
    },

    /** Prions namn för människor. */
    /** @param {string | undefined} v */
    priorityName(v) {
      return (prio(v) || {}).label || "";
    },

    /**
     * Vad som saknas för att posten ska gå att skicka.
     *
     * ⛔ RETURNERAR SKÄLEN, inte ett booleskt värde. Ett formulär som bara säger
     * "kan inte sparas" tvingar användaren att gissa vilket fält som är fel, och
     * det är den sortens gissning som gör att folk slutar rapportera saker.
     *
     * ⛔ SORTENS EGNA KRAV LÄSES UR SORTEN och står inte som en gren här. En ny
     * sort med egna villkor blir då en rad i appens register, inte en ändring i
     * ramverket som någon måste be om.
     */
    /** @param {Record<string, any>} [draft] @returns {string[]} */
    missing(draft = {}) {
      const error = [];
      const s = sort(draft.typ);
      if (!s) error.push("Välj vad det gäller.");

      const rubrik = String(draft.rubrik || "").trim();
      if (!rubrik) error.push("Skriv en rubrik.");
      else if (rubrik.length > maxTitle) error.push(`Rubriken får vara högst ${maxTitle} tecken.`);

      if (!prio(draft.prio)) error.push("Välj hur bråttom det är.");

      if (s && typeof s.requirements === "function") {
        const own = s.requirements(draft);
        if (Array.isArray(own)) error.push(...own);
      }

      return error;
    },

    /**
     * Bygger dokumentet som skrivs. Ren funktion, så formen går att prova utan
     * databas.
     *
     * ⛔ FÄLTEN PLOCKAS ETT OCH ETT, posten sprids inte in med `...`. En
     * filväljare eller ett formulär får gärna lägga till ett fält i sin retur,
     * och då ska det inte tyst hamna i databasen utan att någon bestämt att det
     * hör hemma där.
     *
     * ⛔ `status` SÄTTS EN GÅNG, TILL "ny". Därefter är fältet serverns, precis
     * som `resultat`. Skrev båda sidor samma fält vore det två sanningar om
     * samma sak, och den som förlorar är den som skrev sist.
     */
    /**
     * ⛔ `skapare` VINNER ÖVER `email`, OCH BÅDA FINNS KVAR.
     *
     * Fältet bar en fri e-poststräng, och en adress går inte att kontrollera i
     * en Firestore-regel: regeln har bara `request.auth.uid` att jämföra med.
     * Den nya formen är `byggSkapare({ uid, namn, typ, kalla })`
     * (cllp/ops-framework#106).
     *
     * `email` togs inte bort, eftersom migreringsordningen kräver att båda
     * fungerar samtidigt: en konsument som ännu inte bytt ska inte gå sönder av
     * en ramverksuppgradering. `laesSkapare` läser båda formerna.
     *
     * @param {Record<string, any>} draft
     * @param {{ skapare?: import("./skapare.js").Skapare, email?: string, nu?: () => string }} [context]
     */
    buildEntry(draft, { skapare, email = "", nu = () => new Date().toISOString() } = {}) {
      const s = sort(draft.typ);
      return {
        typ: draft.typ,
        prio: draft.prio,
        rubrik: String(draft.rubrik || "").trim(),
        text: String(draft.text || "").trim(),
        bilaga: draft.bilaga
          ? {
              dataUrl: draft.bilaga.dataUrl,
              namn: draft.bilaga.namn,
              typ: draft.bilaga.typ,
              tecken: draft.bilaga.tecken,
              bredd: draft.bilaga.bredd ?? null,
              hojd: draft.bilaga.hojd ?? null,
            }
          : null,
        // ⛔ Appens extra fält skrivs BARA för en sort som har dem. Ett tomt
        // fältblock på en sort som inte handlar om det ser ut som något någon
        // glömt fylla i.
        ...(s && typeof s.extraFields === "function" ? s.extraFields(draft) : {}),
        skapad: nu(),
        skapadAv: skapare || email,
        status: "ny",
        resultat: null,
      };
    },

    /** Statusnamnen, så appen slipper skriva strängarna själv. */
    STATUS: STATES,

    /** Statusarna där en post är öppen (`ny` och `pagar`). `parkerad` står inte här. Appens "öppna"-filter, räknemärken och Idag läser den här. */
    OPEN_STATES,

    /** Övergångstabellen: status till de statusar posten får gå till. */
    TRANSITIONS,

    /** Är posten öppen? Falskt för en okänd status, aldrig en gissning. @param {string | null | undefined} state */
    isOpen(state) {
      return isOpenState(state);
    },

    /** Får en post gå från `from` till `to`? @param {string | null | undefined} from @param {string} to */
    canMove(from, to) {
      return canMoveInternal(from, to);
    },

    /**
     * Sätter pågår: från "ny" eller "parkerad". Returnerar fälten som skrivs, inget mer.
     *
     * ⛔ APPEN, API:T OCH AGENTEN ANVÄNDER DENNA, och ingen av dem skriver "pagar" för
     * hand (regel 2). `resultat` och `closed` rörs inte: en öppen post har inget av dem.
     * En parkerad post som någon tar tag i går hit direkt, utan ett mellanläge i "ny".
     *
     * @param {string} from Postens nuvarande status.
     * @returns {{ status: string }}
     */
    buildStart(from) {
      assertMove(from, STATES.IN_PROGRESS, "byggPagar");
      return { status: STATES.IN_PROGRESS };
    },

    /**
     * Parkerar: från "ny" eller "pagar". Returnerar fälten som skrivs, inget mer.
     *
     * ⛔ SAMMA SAK SOM `buildStart`: appen skriver inte "parkerad" för hand.
     * `resultat` och `closed` rörs inte. Det här är inget avslut.
     *
     * @param {string} from Postens nuvarande status.
     * @returns {{ status: string }}
     */
    buildPark(from) {
      assertMove(from, STATES.PARKED, "byggParkera");
      return { status: STATES.PARKED };
    },

    /**
     * Tar tillbaka en parkerad post till "ny".
     *
     * ⛔ BARA FRÅN "parkerad". Från "pagar" är vägen `buildStop`. Hade den här
     * läst övergångstabellen ensam hade "pagar" till "ny" släppts igenom, och
     * två byggare hade skrivit samma fält.
     *
     * @param {string} from Postens nuvarande status.
     * @returns {{ status: string }}
     */
    buildUnpark(from) {
      if (from !== STATES.PARKED) throw new Error(`byggAvParkera: bara en parkerad post kan tas tillbaka, den här är "${String(from)}".`);
      return { status: STATES.NEW };
    },

    /**
     * Tar bort pågår: bara från "pagar", tillbaka till "ny".
     *
     * @param {string} from Postens nuvarande status.
     * @returns {{ status: string }}
     */
    buildStop(from) {
      if (from !== STATES.IN_PROGRESS) throw new Error(`byggAvPagar: bara en post som pågår kan sättas tillbaka, den här är "${String(from)}".`);
      return { status: STATES.NEW };
    },

    /**
     * Öppnar en avslutad post igen. Går till "ny" och tömmer avslutet, så att en öppen
     * post aldrig bär ett resultat och en stängningstid från förra gången.
     *
     * @param {string} from Postens nuvarande status, "hanterad" eller "avskriven".
     * @returns {{ status: string, resultat: null, closed: null }}
     */
    buildReopen(from) {
      if (from !== STATES.HANDLED && from !== STATES.DISMISSED) {
        throw new Error(`byggOppnaIgen: bara en avslutad post kan öppnas igen, den här är "${String(from)}".`);
      }
      return { status: STATES.NEW, resultat: null, closed: null };
    },

    /**
     * @deprecated Heter `STATUS` sedan cllp/ops-framework#94. Tas bort tidigast
     * när bolag-ops pekar på en tagg som har bytt (cllp/bolag-ops#362).
     *
     * ⛔ ALIASET ÄR SAMMA FRUSNA OBJEKT, inte en kopia. Två objekt hade kunnat
     * glida isär, och då hade "samma lista" varit ett påstående i stället för
     * en identitet.
     */
    STATES,

    /**
     * Vad som saknas för att posten ska gå att avsluta.
     *
     * ⛔ ETT AVSLUT UTAN RESULTAT ÄR DET VÄRSTA UTFALLET, och det är mätt. En
     * post stod som "hanterad" med tomt resultat, och vyn visade en grön bricka
     * utan ett ord om vad som gjorts. Den som skickade in såg inte om något
     * hänt, bara att någon tryckt på en knapp.
     *
     * ⛔ `not` KRÄVS, `url` GÖR DET INTE. Allt som görs lämnar inte en länk
     * efter sig: en siffra kan ha förts in i ett register, en fråga kan ha
     * besvarats. Men det ska alltid gå att läsa VAD som hände, och en mening
     * kostar ingenting att skriva.
     *
     * ⛔ RETURNERAR SKÄLEN, som `missing`. Samma form för samma sorts fråga.
     */
    /** @param {string} state @param {{ url?: string, not?: string } | null} [resultat] @returns {string[]} */
    missingAtClose(state, resultat) {
      return missingAtCloseInternal(state, resultat);
    },

    /**
     * Bygger avslutet, eller kastar med skälen.
     *
     * ⛔ KASTAR I STÄLLET FÖR ATT RETURNERA NÅGOT HALVT. Den som avslutar en
     * post gör det i ett skript eller en serverfunktion, inte i ett formulär,
     * och där är ett tyst halvt resultat värre än ett stopp: det skrivs till
     * databasen och ser klart ut.
     */
    /**
     * @param {string} state
     * @param {{ url?: string, not?: string }} resultat
     * @param {{ nu?: () => string }} [context]
     */
    buildClose(state, resultat, { nu = () => new Date().toISOString() } = {}) {
      const error = missingAtCloseInternal(state, resultat);
      if (error.length) throw new Error(`byggAvslut: ${error.join(" ")}`);
      return {
        status: state,
        resultat: { url: (resultat || {}).url || null, not: String(resultat.not).trim() },
        closed: nu(),
      };
    },

    /**
     * Hur många hela dygn posten legat i "ny". Null när den inte är ny.
     *
     * ⛔ "PAGAR" OCH "PARKERAD" GER NULL MED FLIT. Larmet betyder "ingen har rört
     * den", och en post någon tagit sig an eller parkerat är rörd. Att den ligger
     * länge i "pagar" eller "parkerad" är ett annat larm, med en annan klocka,
     * som ingen har bett om.
     *
     * ⛔ EN GAMMAL "NY" ÄR ETT LARM, INTE ETT TILLSTÅND. Ligger inskick kvar
     * orörda betyder det att kedjan är trasig någonstans, och den sortens fel
     * ser likadant ut som en lugn vecka. Talet finns här så vyn kan säga ifrån
     * utan att själv veta vad som räknas som länge.
     */
    /** @param {{ status?: string, skapad?: string }} entry @param {Date | number} [nu] @returns {number | null} */
    daysInNew(entry, nu = Date.now()) {
      if (!entry || entry.status !== STATES.NEW) return null;
      const skapad = Date.parse(String(entry.skapad || ""));
      if (!Number.isFinite(skapad)) return null;
      const went = (nu instanceof Date ? nu.getTime() : Number(nu)) - skapad;
      return went > 0 ? Math.floor(went / DAY_MS) : 0;
    },
  };
}
