import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsPanelRow } from "./OpsPanel.jsx";
import { LoggaUtIkon } from "./icons.jsx";
import { OPS_FRAMEWORK_VERSION } from "../lib/frameworkVersion.generated.js";

/**
 * Användarmenyn i toppraden: vem du är, vägen till andra ytor, och utloggningen.
 *
 * ══ ⛔ #157, CP 2026-09-28: "JAG VILL FÖLJA SESSIONSTUDIOS PROFIL EXAKT" ═══
 *
 * Mätt mot SessionStudios `AppHeader.jsx`: rubrik ("Meny"), sektioner skilda
 * med linjer, ikon per rad, en chevron på rader som öppnar nästa vy, en
 * extern-länk-ikon på rader som lämnar appen, utloggningen i sin egen sektion
 * sist, och en dämpad versionsrad längst ned. Den här filen bar innan dess
 * bara en profilrad och Logga ut, utan sektioner och utan version.
 *
 * ⛔ RADERNA ÄR APPENS, FORMEN ÄR RAMVERKETS. Ramverket vet inte om appen
 * heter bolag-ops eller något annat, och känner inte till "Bibliotekstyper"
 * eller "Kalender" som begrepp. `sektioner` är därför en ren lista rader appen
 * bygger själv; det enda ramverket lägger till är Logga ut och versionsraden,
 * eftersom BÅDA finns i varje app som använder skalet.
 *
 * ⛔ RADEN ÅTERANVÄNDER `OpsPanelRow`, INTE EN EGEN KOPIA. Notis- och
 * aktivitetspanelerna (#158) byggs redan av samma primitiv, och en app som
 * öppnar dem via en rad i den här menyn ska se EXAKT samma rad som panelen
 * själv ritar när den listar sina egna poster. Två separata implementationer
 * av "en rad med ikon, etikett, räknare och chevron" hade glidit isär i sin
 * hover-färg eller sitt mått inom en version eller två.
 *
 * ══ ⛔ VARFÖR EN EGEN PLATS OCH INTE EN `action` BLAND ANDRA (#138) ════
 *
 * `OpsAppShell` tar emot `actions`, och appen bestämmer vad som ligger där.
 * Det är rätt för temaväxlare och söksymbol, och fel här: klarkriteriet säger
 * "samma plats i varje app". Ligger utloggningen i en fri slot hamnar den till
 * vänster i en app och i en hamburgare i nästa, och då får den som använder
 * båda leta efter samma knapp på två ställen.
 *
 * Därför ett eget `anvandare`-fack i skalet, sist i klustret, alltid.
 *
 * ══ ⛔ AVATAREN ÄR KNAPPEN, OCH DEN HAR ETT NAMN ══════════════════════
 *
 * En bild utan tillgängligt namn är en knapp en skärmläsare läser som "knapp".
 * `aria-label` bär personens namn, eftersom det är det menyn handlar om.
 *
 * ⛔ OCH INGEN TEXT BREDVID PÅ SMAL SKÄRM. Ett namn i toppraden är det första
 * som tvingar fram horisontell scroll på en telefon, och namnet står redan i
 * menyn när man öppnat den.
 *
 * @typedef {object} AnvandarmenyRad
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
 * @param {AnvandarmenyRad[][]} [props.sektioner] Rader i grupper, en avdelare
 *   mellan varje grupp. Utelämnad: menyn visar bara Logga ut och versionsraden.
 * @param {string} [props.rubrik] Menyns titel, överst i panelen.
 * @param {string} [props.loggaUtEtikett]
 * @param {string} [props.menyEtikett] Skärmläsarnamn på knappen, följt av namnet.
 * @param {string} [props.appVersion] Appens egen versionstext, t.ex. "bolag-ops v1.4.2".
 *   ⛔ SAKNAS DEN skrivs raden ändå, med ramverkets ensam: tomhet är ett svar,
 *   inte en utelämnad rad (arbetsreglernas punkt 5).
 */
export function OpsAnvandarmeny({
  anvandare,
  onLoggaUt,
  sektioner = [],
  rubrik = "Meny",
  loggaUtEtikett = "Logga ut",
  menyEtikett = "Konto",
  appVersion,
}) {
  if (!anvandare) {
    throw new Error("OpsAnvandarmeny: anvandare krävs. Menyn handlar om vem man är inloggad som.");
  }
  if (!onLoggaUt) {
    throw new Error("OpsAnvandarmeny: onLoggaUt krävs. Varje app som visar menyn måste kunna logga ut.");
  }
  for (const sektion of sektioner) {
    for (const rad of sektion) {
      if (!rad || !rad.key) {
        throw new Error("OpsAnvandarmeny: en rad i sektioner saknar \"key\". Utan den kan React inte skilja raderna åt.");
      }
      if (!rad.etikett) {
        throw new Error(`OpsAnvandarmeny: raden "${rad.key}" saknar etikett.`);
      }
    }
  }

  const [oppen, setOppen] = useState(false);
  const visningsnamn = anvandare.namn || anvandare.epost;

  /**
   * Stänger menyn innan appens egen handling körs, som `onLoggaUt` redan gjorde.
   * @param {(() => void) | undefined} fn
   */
  const kor = (fn) => () => {
    setOppen(false);
    fn?.();
  };

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        className={cx(
          "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full",
          "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
        aria-label={`${menyEtikett}, ${visningsnamn}`}
      >
        <OpsIdentity name={visningsnamn} seed={anvandare.id} imageUrl={anvandare.bild} size="sm" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="isolate z-(--z-dropdown) w-64 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-line bg-raised shadow-lg"
        >
          {/* ⛔ RUBRIKEN STÅR EN GÅNG, ÖVERST. Mätt i SessionStudio: ett
              `<h3>` med "Meny", inget namn eller e-post bredvid. Identiteten
              står redan på knappen som öppnade menyn (`aria-label`), och en
              rad till här hade sagt samma sak två gånger. */}
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

          {/* ⛔ VERSIONSRADEN ÄR DÄMPAD OCH INTE KLICKBAR (#157). Den är ett
              faktum om vad som körs, inte en handling. Ramverkets tal kommer ur
              en konstant som skrivs vid bygget ur package.json, ALDRIG en
              handskriven kopia här: se `scripts/generate-framework-version.mjs`
              och provet i `versionsrad.test.jsx` som är rött om de går isär. */}
          <div className="border-t border-line px-3 pt-2 pb-3">
            <span className="text-xs text-ink-muted">
              {appVersion ? `${appVersion} · ` : ""}
              {`ops-framework v${OPS_FRAMEWORK_VERSION}`}
            </span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
