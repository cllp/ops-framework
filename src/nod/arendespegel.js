/**
 * Spegling av ett ärendesystem till en ögonblicksbild.
 *
 * ══ ⛔ VARFÖR DEN HÄR FILEN INTE FÅR NÅ WEBBLÄSAREN ══════════════════════
 *
 * Speglingen kräver en token med läsrätt på repot. En token i klienten är en
 * token i varje besökares JS-fil, och det finns ingen variant av det som är
 * säker. Därför bor filen under `src/nod/`, som INTE ingår i webbundeln:
 * `scripts/build.mjs` buntar bara vad `src/index.js` når.
 *
 * ⛔ DEN GRÄNSEN ÄR EN VAKT OCH INTE EN KONVENTION. `scripts/check-nodsida.mjs`
 * gör det till rött bygge om något under `src/` utanför `src/nod/` importerar
 * härifrån. Utan vakten är gränsen ett löfte, och ett löfte om att en hemlighet
 * inte läcker är värt exakt vad den som råkar bryta det råkar minnas.
 *
 * ══ ⛔ VAD SOM ÄR RAMVERK OCH VAD SOM ÄR APP ═════════════════════════════
 *
 * Ramverket äger MEKANIKEN: hur man hämtar öppna ärenden med en etikett, att
 * pull requests inte är ärenden, sorteringen, och formen på en post.
 *
 * Appen äger VÄRDENA: vilket repo, vilken etikett, och hur en sammanfattning
 * plockas ur brödtexten. Det sista är en funktion och inte ett mönster i
 * konfigurationen, av samma skäl som `krav` på en ärendesort: ett reguljärt
 * uttryck i konfigurationen hade tvingat ramverket att veta att just den här
 * verksamheten skriver en rubrik som heter "Varför" i sina ärenden.
 */

/**
 * @typedef {object} Spegelkonfig
 * @property {string} agare Kontot eller organisationen.
 * @property {string} repo
 * @property {string} etikett Bara ärenden med den här etiketten speglas.
 * @property {(brodtext: string) => string} [sammanfattning] Plockar en kort text ur
 *   brödtexten. Utan den blir `summary` tom sträng, aldrig en gissning ur första raden.
 * @property {(post: Post, rat: any) => Record<string, unknown>} [extraFalt] App-egna fält
 *   per post. ⛔ En funktion och inte flaggor: appen vet vad dess fält betyder, ramverket
 *   ska inte kunna nämna dem.
 * @property {typeof fetch} [hamtare] Injiceras av proven. ⛔ Utan den vore varje prov
 *   tvunget att nå GitHub, alltså långsamt, opålitligt och beroende av en token.
 */

/*
 * ⛔ KONTRAKTET IMPORTERAS FRÅN WEBBSIDAN, INTE DEFINIERAT HÄR.
 *
 * `Post` och `Flode` låg i den här filen i första utkastet, och `check-nodsida`
 * blev röd. Den hade rätt: riktningen ska vara att kontraktet är webbsidans,
 * eftersom det är appen som LÄSER flödet. Den här filen skriver in i kontraktet.
 *
 * Skälet står i `src/lib/arendeflode.js`. Kort: en typberoende är också ett
 * beroende, och nästa person följer typen till sitt hem och lägger körkod intill.
 */

/** @typedef {import("../lib/arendeflode.js").Post} Post */
/** @typedef {import("../lib/arendeflode.js").Flode} Flode */

/**
 * Bygger spegeln ur appens konfiguration.
 *
 * ⛔ KONTROLLERAR KONFIGURATIONEN VID UPPSTART, precis som `skapaArendemodell`.
 * En saknad etikett ger annars en spegling av ALLA öppna ärenden, och det felet
 * ser ut som att speglingen fungerar: listan fylls, den fylls bara med fel saker.
 *
 * @param {Spegelkonfig} konfig
 */
export function skapaArendespegel(konfig) {
  for (const falt of ["agare", "repo", "etikett"]) {
    if (!konfig || !(/** @type {any} */ (konfig)[falt])) {
      throw new Error(
        `skapaArendespegel: ${falt} krävs. Utan etikett speglas varje öppet ärende, och det felet ser ut som att speglingen fungerar.`,
      );
    }
  }

  const { agare, repo, etikett, sammanfattning, extraFalt, hamtare } = konfig;
  const nat = hamtare || fetch;
  const repoSokvag = `${agare}/${repo}`;

  /** Urvalet som en människa kan öppna i en webbläsare. */
  const source = `https://github.com/${repoSokvag}/issues?q=is%3Aissue+is%3Aopen+label%3A${encodeURIComponent(etikett)}`;

  return {
    agare,
    repo,
    etikett,
    source,

    /**
     * Hämtar de öppna ärendena med etiketten.
     *
     * ⛔ KASTAR VID FEL SVAR, SVARAR ALDRIG MED EN TOM LISTA. Ett 401 eller 403
     * som blir `[]` ser exakt ut som "inga öppna ärenden", och den som läser
     * listan ser en tom lista i stället för ett trasigt anrop. Statuskoden och
     * början av svaret står i felet, eftersom GitHub förklarar sig i kroppen.
     *
     * @param {string} token
     * @returns {Promise<any[]>}
     */
    async hamta(token) {
      if (!token) throw new Error("skapaArendespegel.hamta: token krävs.");
      const url = `https://api.github.com/repos/${repoSokvag}/issues?labels=${encodeURIComponent(etikett)}&state=open&per_page=100`;
      const svar = await nat(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": `ops-framework-arendespegel/${repoSokvag}`,
        },
      });
      if (!svar.ok) {
        const detalj = await svar.text().catch(() => "");
        throw new Error(`GitHub svarade ${svar.status} på ${repoSokvag}: ${String(detalj).slice(0, 200)}`);
      }
      const rader = await svar.json();
      if (!Array.isArray(rader)) {
        // ⛔ GitHub svarar med ett OBJEKT vid vissa fel trots 200, till exempel
        // en `message`-kropp. Ett `.filter` på det kastar långt senare med ett
        // fel som inte pekar hit.
        throw new Error(`GitHub svarade med något annat än en lista för ${repoSokvag}.`);
      }
      return rader;
    },

    /**
     * En post ur ett råt ärende.
     *
     * ⛔ `summary` BLIR TOM UTAN `sammanfattning`, aldrig första raden i
     * brödtexten. Första raden är ofta en rubrik eller en tom rad, och en
     * automatiskt plockad mening ser ut som en skriven sammanfattning.
     *
     * @param {any} rat
     * @returns {Post}
     */
    toEntry(rat) {
      const post = {
        number: rat.number,
        title: rat.title,
        state: rat.state || "open",
        labels: (rat.labels || []).map((/** @type {any} */ l) => (typeof l === "string" ? l : l.name)),
        updatedAt: rat.updated_at || null,
        url: rat.html_url || `https://github.com/${repoSokvag}/issues/${rat.number}`,
        summary: typeof sammanfattning === "function" ? sammanfattning(rat.body || "") : "",
      };
      return extraFalt ? { ...post, ...extraFalt(post, rat) } : post;
    },

    /**
     * Ögonblicksbilden.
     *
     * ⛔ PULL REQUESTS FILTRERAS BORT. GitHubs issues-API returnerar dem som
     * ärenden med ett `pull_request`-fält, alltså hamnar varje öppen PR i
     * uppgiftslistan om man inte tittar efter det. Det är inte en smaksak: en PR
     * är arbete som redan är gjort och väntar på granskning, inte en uppgift.
     *
     * ⛔ SORTERAS PÅ `updatedAt` OCH SEDAN PÅ NUMMER. Numret ensamt sorterar på
     * när något SKAPADES, vilket säger mindre om vad som är aktuellt. Numret är
     * kvar som andrahandsnyckel eftersom två ärenden kan dela tidsstämpel, och
     * en ostabil ordning ger en diff i ögonblicksbilden varje körning.
     *
     * ⛔ INGET `live`-FÄLT. Det stod `live: true` här förut och skrevs omedelbart
     * över med `false` av den som anropade. Ett fält som sätts av två parter med
     * motsatta värden är inte ett fält, det är en fråga ingen bestämt vem som
     * äger. Ramverket vet inte om flödet är live, så det påstår ingenting.
     *
     * @param {any[]} rader
     * @param {{ nu?: () => string }} [sammanhang]
     * @returns {Flode}
     */
    tillFlode(rader, { nu = () => new Date().toISOString().slice(0, 10) } = {}) {
      const items = (rader || [])
        .filter((r) => r && !r.pull_request)
        .map((r) => this.toEntry(r))
        .sort((a, b) => {
          const ta = a.updatedAt || "";
          const tb = b.updatedAt || "";
          return tb.localeCompare(ta) || b.number - a.number;
        });
      return { updated: nu(), source: source, label: etikett, items };
    },
  };
}
