import { OpsPanelRow } from "./OpsPanel.jsx";
import { LoggaUtIkon } from "./icons.jsx";
import { OPS_FRAMEWORK_VERSION } from "../lib/frameworkVersion.generated.js";

/**
 * Menyns INNEHÅLL: sektioner, utloggning, versionsraderna. INGEN egen
 * hamburgare längre, och ingen egen export från `src/index.js`.
 *
 * ══ ⛔ #164, ANDRA GRANSKNINGEN, RÄTTAT FRÅN "TVÅ HAMBURGARE" ════════════
 *
 * Korrigering A (se historiken i git) gav ramverket EN meny, men löste den
 * med en HELT EGEN `Popover.Root`/`Popover.Trigger` i `anvandare`-facket,
 * bredvid navigeringens EGEN hamburgare i `OpsAppShell`. Mätt mot en app som
 * byggde skalet: två hamburgare i samma toppräcke, en som öppnade
 * överflödesnavigeringen och en som öppnade `OpsMeny`. SessionStudio har EN.
 *
 * Den här filen ritar därför bara INNEHÅLLET: `OpsAppShell` äger triggern
 * (header-popovern på bred skärm, botten-Meny-arket på smal, se
 * `OpsBottomNav.jsx`) och öppning/stängningen. Innehållet är detsamma i
 * båda: appens sektioner, sedan navigeringens överflödsrader i en EGEN
 * sektion, sedan `menuExtras`, sedan Logga ut, sist de två versionsraderna.
 * Ordningen är skalets ansvar (se `OpsAppShell.jsx` och `OpsBottomNav.jsx`),
 * radrenderingen och valideringen är gemensam och ligger här, en gång, så de
 * två ytorna aldrig kan glida isär.
 *
 * ⛔ RADEN ÅTERANVÄNDER `OpsPanelRow`, INTE EN EGEN KOPIA. Notis- och
 * aktivitetspanelerna (#158) byggs redan av samma primitiv, och en app som
 * öppnar dem via en rad i menyn ska se EXAKT samma rad som panelen själv
 * ritar när den listar sina egna poster.
 *
 * ══ ⛔ TVÅ VERSIONSRADER, INTE EN MED PUNKT EMELLAN ══════════════════════
 *
 * Appens tal och ramverkets tal är två skilda fakta, och en rad som bär
 * båda går inte att peka på var för sig i ett prov eller i en skärmläsare
 * ("bolag-ops v1.4.2 · ops-framework v0.27.0" läses som en enda mening).
 */

/**
 * @typedef {object} MenyRad
 * @property {string} key
 * @property {import("react").ReactNode} etikett
 * @property {import("react").ReactNode} [ikon]
 * @property {() => void} [onClick]
 * @property {string} [href] Lämnar appen. Ritar en extern-länk-ikon i stället för
 *   en chevron. Kan inte kombineras med `chevron`.
 * @property {boolean} [chevron] Raden öppnar en panel eller en annan vy.
 * @property {number} [badge] Olästa eller liknande. Noll och under ritas inte.
 * @property {string} [badgeText] Skärmläsarord efter siffran, t.ex. "nya".
 */

/**
 * Skalets `meny`-prop, samma form på `OpsAppShell` och `OpsBottomNav` (#164,
 * andra granskningen). En typ, ett ställe: annars glider de två isär.
 * @typedef {object} MenyKonfiguration
 * @property {MenyRad[][]} [sektioner] Appens rader, i sina sektioner.
 * @property {() => void} onLoggaUt
 * @property {string} [appVersion]
 * @property {string} [rubrik]
 * @property {string} [loggaUtEtikett]
 */

/**
 * Kastar om en sektionsrad saknar det den måste ha, oavsett vilken behållare
 * (header-popover eller botten-ark) som ska rita den. EN kontroll, inte en
 * i varje behållare som kan sluta stämma överens.
 * @param {MenyRad[][]} sektioner
 * @param {string} vem Vilket prop-namn felet ska peka på, t.ex. "OpsAppShell: meny.sektioner".
 */
export function validateMenySektioner(sektioner, vem) {
  for (const sektion of sektioner) {
    for (const rad of sektion) {
      if (!rad || !rad.key) {
        throw new Error(`${vem}: en rad saknar "key". Utan den kan React inte skilja raderna åt.`);
      }
      if (!rad.etikett) {
        throw new Error(`${vem}: raden "${rad.key}" saknar etikett.`);
      }
    }
  }
}

/**
 * Stänger den behållare (Popover/Dialog) menyn ritas i INNAN appens egen
 * handling körs.
 *
 * ⛔ `fn` SKJUTS TILL NÄSTA TICK, OCH DET ÄR MÄTT, INTE FÖRSIKTIGHET (#158).
 * En rad som öppnar en ANNAN Radix-panel (t.ex. en aktivitetsknapp via en
 * chevron-rad) öppnade den ALDRIG i praktiken när stängningen och appens
 * `onClick` kördes i samma händelse: Radix Popover/Dialog river sin egen
 * "klick utanför"-lyssnare på samma klick som stänger den, och den nya
 * panelens öppning hann in i samma fönster och stängdes tillbaka på plats.
 * Symptomet var tyst, inget kastade: knappens `onClick` kördes (mätt med en
 * logg), state uppdaterades, men panelen syntes aldrig. `setTimeout(fn, 0)`
 * lägger appens handling EFTER att behållaren hunnit stänga och tas bort ur
 * DOM:en.
 * @param {() => void} onStang
 * @returns {(fn?: () => void) => () => void}
 */
export function kordarePafunktion(onStang) {
  return (fn) => () => {
    onStang();
    if (fn) setTimeout(fn, 0);
  };
}

/**
 * Appens rader, i sina sektioner. Delad mellan header-popovern och
 * botten-arket, se filhuvudet.
 * @param {object} props
 * @param {MenyRad[][]} props.sektioner
 * @param {(fn?: () => void) => () => void} props.kor
 */
export function MenySektioner({ sektioner, kor }) {
  return sektioner.map((sektion, i) => (
    // eslint-disable-next-line react/no-array-index-key -- ⛔ Sektioner har ingen egen identitet utöver sin plats: appen skickar en NY array varje render, och ett index som byter plats med sina rader byter plats med flit.
    <div key={i} className="flex flex-col gap-0.5 border-t border-line p-1">
      {sektion.map((rad) => (
        <OpsPanelRow
          key={rad.key}
          icon={rad.ikon}
          label={rad.etikett}
          chevron={rad.chevron}
          href={rad.href}
          badge={rad.badge}
          badgeText={rad.badgeText}
          onClick={kor(rad.onClick)}
        />
      ))}
    </div>
  ));
}

/**
 * Menyns SISTA två block, alltid i den ordningen: Logga ut, sedan
 * versionsraderna. Delad mellan header-popovern och botten-arket.
 * @param {object} props
 * @param {() => void} props.onLoggaUt
 * @param {string} [props.loggaUtEtikett]
 * @param {string} [props.appVersion] Appens egen versionstext, t.ex. "bolag-ops v1.4.2".
 *   ⛔ SAKNAS DEN skrivs raden ändå, med ramverkets ensam: tomhet är ett svar,
 *   inte en utelämnad rad (arbetsreglernas punkt 5).
 * @param {(fn?: () => void) => () => void} props.kor
 */
export function MenyFooter({ onLoggaUt, loggaUtEtikett = "Logga ut", appVersion, kor }) {
  return (
    <>
      <div className="border-t border-line p-1">
        <OpsPanelRow icon={<LoggaUtIkon />} label={loggaUtEtikett} onClick={kor(onLoggaUt)} />
      </div>
      {/* ⛔ TVÅ RADER, INTE EN. Ramverkets rad kommer ur en konstant som
          skrivs vid bygget ur package.json, ALDRIG en handskriven kopia här:
          se `scripts/generate-framework-version.mjs` och provet i
          `versionsrad.test.jsx` som är rött om de går isär. */}
      <div className="flex flex-col gap-0.5 border-t border-line px-3 pt-2 pb-3">
        {appVersion ? <span className="text-xs text-ink-muted">{appVersion}</span> : null}
        <span className="text-xs text-ink-muted">{`ops-framework v${OPS_FRAMEWORK_VERSION}`}</span>
      </div>
    </>
  );
}
