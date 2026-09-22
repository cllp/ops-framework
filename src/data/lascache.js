/**
 * Läscachen: en läsning per unik fråga och källa, för sessionen.
 *
 * ══ ⛔ VARFÖR DEN FINNS, MÄTT OCH INTE ANTAGET ═══════════════════════════
 *
 * bolag-ops #256, CP 2026-09-22: Ekonomi öppnade med en helsidesspinner tills
 * alla läsningar var klara, och `data/pension` hämtades TVÅ gånger på samma
 * mount: en gång av översiktens hook och en gång av pensionshooken. Ingen av
 * dem gjorde fel. De visste bara inte om varandra.
 *
 * Två skilda problem gömde sig bakom samma symptom, och båda löses här:
 *
 *   1. SAMTIDIGA IDENTISKA LÄSNINGAR. Två hookar som monteras i samma
 *      renderpass frågar efter samma sak och betalar två gånger.
 *   2. OMMONTERING. Man byter vy och kommer tillbaka, och allt hämtas om fast
 *      ingenting hunnit ändras.
 *
 * ══ ⛔ VAD SOM CACHAS OCH VAD SOM INTE GÖR DET ══════════════════════════
 *
 * ⛔ FEL CACHAS ALDRIG. En misslyckad läsning tas bort ur cachen igen, så nästa
 * försök verkligen är ett försök. Cachade man felet skulle en enda nätverksstöt
 * göra resten av sessionen trasig, och den som trycker "försök igen" skulle få
 * samma fel utan att något faktiskt provats.
 *
 * ⛔ `useSamlingLive` RÖR INTE CACHEN, varken läser eller skriver. En ström är
 * sin egen sanning och uppdaterar sig själv; att blanda in en ögonblicksbild
 * hade gett två svar på samma fråga, och det svar man ser hade berott på vilken
 * hook som råkade montera först.
 *
 * ══ ⛔ CACHEN HÖR TILL KÄLLAN, INTE TILL MODULEN ════════════════════════
 *
 * Nyckeln är `Datakalla`-instansen, i en `WeakMap`. Det ger tre saker gratis:
 *
 *   - En app som skapar sin källa en gång vid uppstart får en SESSIONSCACHE,
 *     vilket är precis vad som efterfrågades.
 *   - Två källor kan inte förorena varandra. En routande källa och en
 *     minneskälla i samma process har var sin låda.
 *   - Prov isoleras av sig själva: varje prov som bygger en ny minneskälla får
 *     en tom cache utan att någon behöver komma ihåg att rensa. En global
 *     modulcache hade gjort provordningen till en dold beroendekedja, och den
 *     sortens fel dyker upp först när någon lägger till ett prov någon
 *     annanstans.
 *
 * ══ ⛔ FÄRSKHET ÄR EN ANNAN FRÅGA, OCH DEN ÄR INTE LÖST HÄR ═════════════
 *
 * Kommentaren i `useData.jsx` sade "ingen cache, med avsikt", och den avsikten
 * gällde FÄRSKHET: ett arbetsverktyg ska visa det som gäller nu. Den meningen
 * står kvar, för den handlar om något annat än dubbletter i samma renderpass.
 *
 * Så här ser färskheten ut med cachen på plats:
 *
 *   - `uppdatera()` glömmer nyckeln och hämtar på riktigt. Det är vägen tillbaka
 *     till servern, och den som skriver något ska anropa den.
 *   - En omladdning av sidan ger en ny källa och därmed en tom cache.
 *   - Det som INTE finns är en automatisk invalidering när någon annan skrivit.
 *     I bolag-ops synkar banken ett par gånger per dygn, och nästa steg där är
 *     en revisionsflagga som synken bumpar (#256, «lätt D»). Tills den finns är
 *     en vy som stått öppen i timmar lika gammal som när den öppnades.
 *
 * ⛔ INGEN TIDSGRÄNS, MED FLIT. En `maxAlder` på fem minuter hade sett
 * förnuftig ut och varit ett tal taget ur luften: ingen mätning säger fem, och
 * en siffra som ingen kan härleda blir kvar för alltid. Antingen vet man när
 * datan ändrades, och då är revisionsflaggan svaret, eller så vet man det inte,
 * och då är sessionen den ärliga gränsen.
 */

/**
 * @typedef {object} Lada
 * @property {Map<string, any>} varden Färdiga svar, för den synkrona titten.
 * @property {Map<string, Promise<any>>} loften Läsningar som är ute just nu.
 */

/** @type {WeakMap<object, Lada>} */
const LADOR = new WeakMap();

/** @param {object} kalla @returns {Lada} */
function lada(kalla) {
  let l = LADOR.get(kalla);
  if (!l) {
    l = { varden: new Map(), loften: new Map() };
    LADOR.set(kalla, l);
  }
  return l;
}

/**
 * Nyckeln för en listning. Frågan ingår, eftersom två urval ur samma samling är
 * två olika svar.
 *
 * ⛔ `JSON.stringify` PÅ FRÅGAN OCH INTE PÅ OBJEKTET SOM SÅDANT. Ett
 * objektliteral i en vy är en ny referens vid varje rendering, så en
 * referensnyckel hade gett en ny cachepost per rendering, alltså en cache som
 * växer och aldrig träffar. Samma jämförelse som hookarna redan gör i sina
 * beroendelistor.
 *
 * @param {string} samling
 * @param {unknown} fraga
 */
export function listnyckel(samling, fraga) {
  return `lista:${samling}:${JSON.stringify(fraga ?? null)}`;
}

/**
 * Nyckeln för ett dokument.
 *
 * @param {string} samling
 * @param {string} id
 */
export function dokumentnyckel(samling, id) {
  return `las:${samling}:${id}`;
}

/**
 * Det cachade svaret, synkront.
 *
 * ⛔ RETURNERAR `{ har, varde }` OCH INTE BARA VÄRDET. `las` svarar `null` för
 * "dokumentet finns inte", och det är ett giltigt svar som ska cachas. Ett
 * returvärde som blandar ihop "inget cachat" med "cachat null" hade gjort att
 * just de dokumenten hämtades om varje gång, alltså precis de som kostar mest
 * att leta efter.
 *
 * @param {object} kalla
 * @param {string} nyckel
 * @returns {{ har: boolean, varde: any }}
 */
export function cachat(kalla, nyckel) {
  const l = LADOR.get(kalla);
  if (!l || !l.varden.has(nyckel)) return { har: false, varde: undefined };
  return { har: true, varde: l.varden.get(nyckel) };
}

/**
 * Läser genom cachen: delar en pågående läsning, eller startar en.
 *
 * @template T
 * @param {object} kalla
 * @param {string} nyckel
 * @param {() => Promise<T>} hamta Vad som ska göras när svaret inte finns.
 * @returns {Promise<T>}
 */
export function genomCachen(kalla, nyckel, hamta) {
  const l = lada(kalla);

  if (l.varden.has(nyckel)) return Promise.resolve(l.varden.get(nyckel));

  const pagaende = l.loften.get(nyckel);
  if (pagaende) return pagaende;

  const loftet = hamta()
    .then((varde) => {
      l.varden.set(nyckel, varde);
      l.loften.delete(nyckel);
      return varde;
    })
    .catch((fel) => {
      // ⛔ Felet lämnar inget spår i cachen. Se filens huvud: ett cachat fel
      // gör en tillfällig störning permanent för resten av sessionen.
      l.loften.delete(nyckel);
      throw fel;
    });

  l.loften.set(nyckel, loftet);
  return loftet;
}

/**
 * Glömmer en nyckel, så nästa läsning går till källan.
 *
 * ⛔ GLÖMMER BÅDE SVARET OCH DEN PÅGÅENDE LÄSNINGEN. Lämnades löftet kvar skulle
 * ett `uppdatera()` mitt under en hämtning få tillbaka exakt det svar man bad om
 * att slippa, och knappen hade sett ut att fungera medan ingenting hände.
 *
 * @param {object} kalla
 * @param {string} nyckel
 */
export function glom(kalla, nyckel) {
  const l = LADOR.get(kalla);
  if (!l) return;
  l.varden.delete(nyckel);
  l.loften.delete(nyckel);
}
