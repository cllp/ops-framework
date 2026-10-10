/**
 * Generell hjälp: grundfunktionerna som alltid finns (0.92.0).
 *
 * ⛔ TEXTEN ÄR RAMVERKETS. Appens egna appar bär sin hjälp i modulens `hjalp`.
 * Här står bara det som finns utan någon installerad modul: Idag, kalender,
 * ärenden, grupper, medlemskap, inställningar och konto.
 *
 * ⛔ SVENSKA FÖRST. LIFE Hub och ops-apparna har svensk UI-text. Engelska
 * läggs till när översättningen finns, inte som en tom spegel.
 */

/** Id på grundsektionen i djuplänken `#hjalp/grund`. */
export const GRUND_ID = "grund";

/**
 * @typedef {import("../lib/modilhjalp.js").HjalpAvsnitt} HjalpAvsnitt
 */

/**
 * @typedef {object} HjalpOmrade
 * @property {string} id
 * @property {string} rubrik
 * @property {ReadonlyArray<HjalpAvsnitt>} avsnitt
 */

/**
 * @param {string} id
 * @param {string} fraga
 * @param {string} svar
 * @param {string[]} [sokord]
 * @returns {HjalpAvsnitt}
 */
function a(id, fraga, svar, sokord = []) {
  return Object.freeze({ id, fraga, svar, sokord: Object.freeze(sokord) });
}

/** @type {ReadonlyArray<HjalpOmrade>} */
export const GENERELL_OMRADEN = Object.freeze([
  Object.freeze({
    id: "kom-igang",
    rubrik: "Kom igång",
    avsnitt: Object.freeze([
      a(
        "idag-oversikt",
        "Vad är Idag och Översikt?",
        `**Idag** svarar på vad som kräver dig nu. **Översikt** (eller hubben) visar gruppens appar och genvägar.

Det är två frågor. En sida som försöker svara på båda svarar sämre på den ena.`,
        ["hem", "startsida", "hubb", "appar"],
      ),
      a(
        "navigering",
        "Hur hittar jag runt?",
        `Bottenraden på telefonen (och menyn på större skärm) tar dig till Idag, kalender, inkorg, appar och mer.

**Appar** öppnar gruppens installerade appar. En app du inte installerat syns inte där, och har ingen hjälp heller.

Plusknappen (**Ny**) skapar något: ett ärende, en anteckning, en inspelning eller det modulerna erbjuder.`,
        ["meny", "botten", "plus", "ny"],
      ),
    ]),
  }),
  Object.freeze({
    id: "kalender",
    rubrik: "Kalender",
    avsnitt: Object.freeze([
      a(
        "kalender-vy",
        "Vad visar kalendern?",
        `Kalendern samlar händelser från gruppen och från dig: möten, uppgifter med datum och det apparna lägger in.

Du kan byta mellan månad, vecka och dag. En dag utan poster är tom med flit, inte ett fel.`,
        ["månad", "vecka", "dag", "händelse"],
      ),
      a(
        "kalender-egna",
        "Gruppens kalender och mina kalendrar",
        `**Gruppens kalendrar** syns för alla i gruppen. En händelse hamnar i den förvalda om inget annat väljs.

**Dina egna kalendrar** syns bara för dig. Poster i dem kan blockera din tillgänglighet när andra bokar.`,
        ["tillgänglighet", "frånvaro", "förvald"],
      ),
    ]),
  }),
  Object.freeze({
    id: "arenden",
    rubrik: "Ärenden och inkorg",
    avsnitt: Object.freeze([
      a(
        "inkorg",
        "Vad är inkorgen?",
        `Inkorgen samlar det som väntar på dig: nya poster, saker att godkänna och det apparna skickar in.

När du tar hand om en post lämnar den inkorgen. Det betyder att den är omvandlad eller avklarad enligt sorten, inte alltid att hela arbetet är slut.`,
        ["ärende", "kö", "hanterad", "ny"],
      ),
      a(
        "arende-svar",
        "Svara på ett ärende",
        `Öppna posten och skriv i tråden. Vissa sorter går vidare till ett externt ärende (till exempel GitHub). Då står det vart kommentaren tar vägen innan du skickar.

En post utan förfallodatum syns i inkorgen men blir inte en kalenderhändelse.`,
        ["kommentar", "tråd", "förfallodatum"],
      ),
    ]),
  }),
  Object.freeze({
    id: "grupper",
    rubrik: "Grupper och medlemmar",
    avsnitt: Object.freeze([
      a(
        "grupper-byta",
        "Byta grupp",
        `Gruppmärket högst upp (eller i menyn) byter aktiv grupp. Allt du ser: appar, inkorg, kalender och meddelanden, gäller den gruppen.

En grupp du lämnat eller inte är med i syns inte i listan.`,
        ["gruppväxlare", "aktiv", "medlemskap"],
      ),
      a(
        "inbjudan",
        "Bjuda in och gå med",
        `Ägare och admin skickar inbjudningar. Den inbjudna öppnar länken, loggar in och blir medlem.

Har du tidigare varit med och sedan avslutat medlemskapet kan en ny inbjudan ta in dig igen.`,
        ["invite", "länk", "ägare", "admin"],
      ),
      a(
        "roller",
        "Roller i gruppen",
        `**Ägare** styr gruppen och kan överlåta ägarskap. **Admin** kan installera appar och ändra inställningar. **Medlem** använder det som finns.

Vem som får läsa och skriva appens egen data bestämmer appen. Ramverket skyddar medlemskap, konfiguration och sina egna samlingar.`,
        ["behörighet", "ägare", "admin", "medlem"],
      ),
    ]),
  }),
  Object.freeze({
    id: "installningar",
    rubrik: "Inställningar och konto",
    avsnitt: Object.freeze([
      a(
        "installningar-vy",
        "Var hittar jag inställningarna?",
        `**Inställningar** i menyn täcker språk, tema, notiser och gruppens gemensamma val.

Varje installerad app har dessutom egna inställningar bakom kugghjulet i appens huvud. Där sätter du om appen syns i huvudet, kopplingar och appens egna fält.`,
        ["kugghjul", "tema", "språk", "notiser"],
      ),
      a(
        "mitt-konto",
        "Mitt konto",
        `Under profilen ligger namn, bild och hur du syns i gruppen. Utloggning finns i samma meny.

Kontot är ditt. Byter du grupp tar du med dig dig själv, inte gruppens data.`,
        ["profil", "utloggning", "konto"],
      ),
      a(
        "ai-nycklar",
        "AI-nycklar",
        `Egna nycklar till språkmodeller ligger på **dig**, i identitetens valv. De syns aldrig i klartext i en appvy.

**Agenter** hör till **gruppen**: namn, roll och vad de får göra. Nyckeln de anropar med är fortfarande din (eller gruppens kopplade nyckel via valvet), inte något som sparas i chatten.`,
        ["byok", "valv", "openai", "grok", "nyckel", "agent"],
      ),
    ]),
  }),
]);

/**
 * Grundfunktionernas sektion, som hjälpsidan ritar först.
 *
 * @type {{ id: string, rubrik: string, omraden: ReadonlyArray<HjalpOmrade> }}
 */
export const GENERELL_HJALP = Object.freeze({
  id: GRUND_ID,
  rubrik: "Grundfunktioner",
  omraden: GENERELL_OMRADEN,
});
