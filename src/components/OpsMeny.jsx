import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { OpsPanelRow } from "./OpsPanel.jsx";
import { LoggaUtIkon, MenuIcon } from "./icons.jsx";
import { OPS_FRAMEWORK_VERSION } from "../lib/frameworkVersion.generated.js";

/**
 * DEN enda menyn: notiser/aktivitet, appens egna destinationer, utloggning,
 * versionen. Öppnas från hamburgaren i toppraden.
 *
 * ══ ⛔ #164, KORRIGERING A, CP 2026-09-28 SKÄRMBILD 17:55 ════════════════
 *
 * Filen hette `OpsAnvandarmeny` och öppnades genom att trycka på AVATAREN.
 * Det var fel mätt mot SessionStudio: "Avataren i toppraden har ingen meny.
 * Den är en direktlänk till profilen med tooltip 'Min profil'. Menyn
 * ('Meny', hamburgaren) är EN meny."
 *
 * Namnet ljög alltså på två sätt: den öppnades inte via ett konto-ikon utan
 * via samma hamburgare SessionStudio använder för HELA menyn, och den hette
 * "användarmeny" trots att halva innehållet (notiser, aktivitet, appens
 * navigering) inte har med användaren att göra. `OpsMeny` säger vad den är:
 * appens EN meny, med fyra delar i given ordning.
 *
 * Avataren är sedan denna ändring appens eget jobb: en `OpsIconLink` med
 * `OpsIdentity` som `icon` och `label="Min profil"`, pekande på en
 * profil-route. Den ligger BREDVID `OpsMeny` i skalets `anvandare`-fack, inte
 * inuti den. Se `README.md` §Skalet för exemplet.
 *
 * ⛔ RADERNA ÄR APPENS, FORMEN ÄR RAMVERKETS. Ramverket vet inte om appen
 * heter bolag-ops eller något annat, och känner inte till "Bibliotekstyper"
 * eller "Kalender" som begrepp. `sektioner` är därför en ren lista rader appen
 * bygger själv (notiser, aktivitet, appens egna destinationer); det enda
 * ramverket lägger till är Logga ut och de två versionsraderna, eftersom BÅDA
 * finns i varje app som använder skalet.
 *
 * ⛔ RADEN ÅTERANVÄNDER `OpsPanelRow`, INTE EN EGEN KOPIA. Notis- och
 * aktivitetspanelerna (#158) byggs redan av samma primitiv, och en app som
 * öppnar dem via en rad i den här menyn ska se EXAKT samma rad som panelen
 * själv ritar när den listar sina egna poster.
 *
 * ══ ⛔ TVÅ VERSIONSRADER, INTE EN MED PUNKT EMELLAN ══════════════════════
 *
 * Skärmbilden visar SessionStudios enda rad ("SessionStudio™ v0.9.1602")
 * eftersom SessionStudio bara HAR en version. Vi har två (appens och
 * ramverkets), och CP:s korrigering säger uttryckligen "två rader är rätt".
 * Den gamla koden slog ihop dem med " · " på en rad, vilket var fel redan
 * innan skärmbilden: appVersion och ramverkets version är två olika fakta,
 * och en rad som bär två fakta går inte att peka på var för sig i ett prov
 * eller i en skärmläsare ("bolag-ops v1.4.2 · ops-framework v0.27.0" läses
 * som en enda mening).
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
 *
 * @param {object} props
 * @param {import("../lib/grupp.js").Anvandare} props.anvandare
 * @param {() => void} props.onLoggaUt
 * @param {MenyRad[][]} [props.sektioner] Rader i grupper, en avdelare mellan
 *   varje grupp, i den ordning appen skickar dem. SessionStudios form:
 *   [Notiser, Aktivitet], [appens navrader]. Utelämnad: menyn visar bara
 *   Logga ut och versionsraderna.
 * @param {string} [props.rubrik] Menyns titel, överst i panelen.
 * @param {string} [props.loggaUtEtikett]
 * @param {string} [props.menyEtikett] Skärmläsarnamn på hamburgarknappen.
 * @param {string} [props.appVersion] Appens egen versionstext, t.ex. "bolag-ops v1.4.2".
 *   ⛔ SAKNAS DEN skrivs raden ändå, med ramverkets ensam: tomhet är ett svar,
 *   inte en utelämnad rad (arbetsreglernas punkt 5).
 */
export function OpsMeny({
  anvandare,
  onLoggaUt,
  sektioner = [],
  rubrik = "Meny",
  loggaUtEtikett = "Logga ut",
  menyEtikett = "Meny",
  appVersion,
}) {
  if (!anvandare) {
    throw new Error("OpsMeny: anvandare krävs. Logga ut-raden och versionsraderna behöver veta att någon är inloggad.");
  }
  if (!onLoggaUt) {
    throw new Error("OpsMeny: onLoggaUt krävs. Varje app som visar menyn måste kunna logga ut.");
  }
  for (const sektion of sektioner) {
    for (const rad of sektion) {
      if (!rad || !rad.key) {
        throw new Error("OpsMeny: en rad i sektioner saknar \"key\". Utan den kan React inte skilja raderna åt.");
      }
      if (!rad.etikett) {
        throw new Error(`OpsMeny: raden "${rad.key}" saknar etikett.`);
      }
    }
  }

  const [oppen, setOppen] = useState(false);

  /**
   * Stänger menyn innan appens egen handling körs, som `onLoggaUt` redan gjorde.
   *
   * ⛔ `fn` SKJUTS TILL NÄSTA TICK, OCH DET ÄR MÄTT, INTE FÖRSIKTIGHET (#158).
   * En rad som öppnar en ANNAN Radix-panel (t.ex. `OpsActivityButton` via en
   * chevron-rad) öppnade den ALDRIG i praktiken när `setOppen(false)` och
   * appens `onClick` kördes i samma händelse: Radix Popover river sin egen
   * "klick utanför"-lyssnare på samma klick som stänger den, och den nya
   * panelens öppning hann in i samma fönster och stängdes tillbaka på plats.
   * Symptomet var tyst, inget kastade: knappens `onClick` kördes (mätt med
   * en logg), state uppdaterades, men panelen syntes aldrig. `setTimeout(fn, 0)`
   * lägger appens handling EFTER att den här menyns Radix-rot hunnit stänga
   * och tas bort ur DOM:en.
   * @param {(() => void) | undefined} fn
   */
  const kor = (fn) => () => {
    setOppen(false);
    if (fn) setTimeout(fn, 0);
  };

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        className={cx(
          "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md",
          "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          "text-ink-secondary",
        )}
        aria-label={menyEtikett}
      >
        <MenuIcon size={20} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="isolate z-(--z-dropdown) w-64 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-line bg-raised shadow-lg"
        >
          {/* ⛔ RUBRIKEN STÅR EN GÅNG, ÖVERST. Mätt i SessionStudio: ett
              `<h3>` med "Meny", inget namn eller e-post bredvid. Identiteten
              har sin egen plats nu, bredvid menyn (avataren), och en rad till
              här hade sagt samma sak två gånger på fel ställe. */}
          <div className="px-3 pt-3 pb-1">
            <h2 className="m-0 text-base font-semibold text-ink">{rubrik}</h2>
          </div>

          {sektioner.map((sektion, i) => (
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
          ))}

          <div className="border-t border-line p-1">
            <OpsPanelRow icon={<LoggaUtIkon />} label={loggaUtEtikett} onClick={kor(onLoggaUt)} />
          </div>

          {/* ⛔ TVÅ RADER, INTE EN (#164, korrigering A). Appens tal och
              ramverkets tal är två skilda fakta; en rad som bär båda går inte
              att läsa eller peka på var för sig. Ramverkets rad kommer ur en
              konstant som skrivs vid bygget ur package.json, ALDRIG en
              handskriven kopia här: se `scripts/generate-framework-version.mjs`
              och provet i `versionsrad.test.jsx` som är rött om de går isär. */}
          <div className="flex flex-col gap-0.5 border-t border-line px-3 pt-2 pb-3">
            {appVersion ? <span className="text-xs text-ink-muted">{appVersion}</span> : null}
            <span className="text-xs text-ink-muted">{`ops-framework v${OPS_FRAMEWORK_VERSION}`}</span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
