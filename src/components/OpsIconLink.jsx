import { cloneElement, isValidElement } from "react";
import { cx } from "../lib/cx.js";
import { huvudknappKlass } from "../lib/radKlass.js";
import { OpsCountBadge, OpsFelBadge } from "./counter.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsTooltip } from "./OpsTooltip.jsx";

/**
 * En destination som en ikon, för åtgärdsklustret längst till höger i toppraden.
 *
 * ══ ⛔ VARFÖR DEN INTE ÄR ETT NAV-OBJEKT ════════════════════════════════
 *
 * Toppradens navigering tar destinationer som text, och de ryms inte hur många
 * som helst: vid 768 px får tre plats. En destination man vill nå från VARJE
 * sida, hela tiden, konkurrerar då med de destinationer man bara ibland ska till,
 * och förlorar så fort listan växer.
 *
 * En ikon bredvid temaväxlaren konkurrerar inte med den listan alls. Den kostar
 * 44 px och är kvar på alla bredder. Det är rätt plats för en inkorg, en
 * notislista eller en sökruta: ytor man återvänder till och som har ett tillstånd
 * (ett antal) värt att se utan att gå in.
 *
 * ⛔ DEN ÄR EN LÄNK OCH INTE EN KNAPP. Den går till en sida, alltså ska
 * högerklick, ny flik och kopiera länk fungera. Appen ger `onNavigate` och får
 * sin router att ta över klicket, precis som i skalet och av samma skäl.
 *
 * ⛔ IKONEN ENSAM BÄR ALDRIG BETYDELSEN. `label` blir knappens uppläsning, och
 * räknaren bär sitt eget substantiv. En ikon utan namn är oläsbar för den som
 * använder skärmläsare och gissningsbar för alla andra.
 *
 * ⛔ Ingen text bredvid ikonen, inte ens på bred skärm. Åtgärdsklustret är en rad
 * ikoner (tema, helskärm, konto), och ett ord mitt bland dem läses som en knapp av
 * ett annat slag. Namnet finns i uppläsningen och i webbläsarens titel.
 */

/**
 * @param {object} props
 * @param {string} props.href
 * @param {import("react").ReactNode} props.icon
 * @param {string} props.label Vad destinationen heter. Blir länkens uppläsning.
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {number} [props.badge] Antal. ⛔ 0 ritar ingen räknare: en nolla i en cirkel är en notis om att det inte finns någon notis.
 * @param {string} [props.badgeText] Substantivet efter siffran, t.ex. "nya". Appen bestämmer vad den räknar.
 * @param {boolean} [props.badgeFler] (chattens nattskiva) Antalet är ett golv: räkningen nådde sitt tak, och märket visar "50+".
 * @param {string} [props.badgeFel] (0.45.0, cllp/bolag-ops#150) Räknaren kunde inte läsas, med orden som säger det, t.ex.
 *   "kunde inte läsas". Ritar `OpsFelBadge` i stället för räknaren och lägger orden i tooltipen. ⛔ Går FÖRE `badge`: ett antal
 *   från innan läsningen föll är ett gammalt antal, och en siffra som ser aktuell ut är precis den lögn märket finns för att undvika.
 * @param {boolean} [props.active] Står man på sidan just nu.
 * @param {boolean} [props.avatar] (0.30.0, #173) Identiteten i toppraden: en 32 px rund knapp med en 28 px rund avatar
 *   i, ingen platta utan en RING vid hover (`ring-line-strong`) och i accent när man står på sidan. Mätt ur SessionStudio
 *   (`AppHeader.jsx:463`: `p-0.5 rounded-full`, `hover:ring-2 hover:ring-border-hover`, aktiv `ring-2 ring-accent`).
 *   Är `icon` en `OpsIdentity` görs den till `size="avatar"` åt dig, så appen inte behöver känna till måttet.
 */
export function OpsIconLink({ href, icon, label, onNavigate, badge, badgeText = "nya", badgeFler = false, badgeFel, active = false, avatar = false }) {
  if (!label) {
    throw new Error(
      "OpsIconLink: label krävs. En ikonlänk utan namn läses upp som sin adress, alltså \"/inkorg\", och det är inte ett namn på något.",
    );
  }

  if (badgeFel !== undefined && badgeFel !== null && (typeof badgeFel !== "string" || !badgeFel.trim())) {
    throw new Error("OpsIconLink: badgeFel måste vara orden som säger vad som gick fel (eller utelämnas). Ett felmärke utan ord är ett utropstecken ingen kan läsa upp.");
  }
  const fel = typeof badgeFel === "string" && badgeFel.trim() ? badgeFel : null;
  const count = typeof badge === "number" && badge > 0 ? badge : 0;

  const lank = (
    <a
      href={href}
      onClick={(e) => {
        if (onNavigate) onNavigate(href, e);
      }}
      aria-current={active ? "page" : undefined}
      // ⛔ Namnet innehåller INTE antalet. Räknaren har sin egen uppläsning, och
      // vore talet också i namnet skulle "Inkorg, 3 nya, 3 nya" läsas upp.
      aria-label={label}
      className={
        avatar
          ? cx(
              // ⛔ 32 px knapp från `xl` (1280 px), 28 px avatar, ring vid hover.
              // ⛔ 0.62.0 (bolag-ops#565): under `md` är knappen 44 px. 0.87.0 (#262): den är 44 px ända till `xl`,
              // eftersom en osynlig `after:` på 44 px förlorar trycket till grannen 2 px bort. Se `huvudknappKlass`.
              "group relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full xl:size-8",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              "after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
            )
          : cx(
              // ⛔ Aktiv är MÖRKARE BLÄCK och ingen ifylld platta. En platta i
              // åtgärdsklustret ser ut som ett påslaget läge, alltså som att man
              // tryckt på en växlare, inte som "du är här".
              huvudknappKlass({ aktiv: active ? "mork" : false }),
            )
      }
    >
      <span
        aria-hidden="true"
        className={
          avatar
            ? cx(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-full p-0.5 transition-all duration-(--duration-fast) ease-standard",
                active ? "ring-2 ring-accent" : "group-hover:ring-2 group-hover:ring-line-strong",
              )
            : "inline-flex"
        }
      >
        {avatar && isValidElement(icon) && icon.type === OpsIdentity ? cloneElement(/** @type {any} */ (icon), { size: "avatar" }) : icon}</span>
      {fel ? <OpsFelBadge text={fel} placement="icon" /> : count > 0 ? <OpsCountBadge count={count} text={badgeText} placement="icon" fler={badgeFler} /> : null}
    </a>
  );

  // ⛔ 0.31.0 (fynd 5 i cllp/bolag-ops#475): EN IKONKNAPP I HUVUDET HAR ETT SYNLIGT NAMN VID HOVER OCH FOKUS, som SS (`title` på
  // varje knapp i `AppHeader.jsx`). `aria-label` ovan är namnet för den som lyssnar; tooltipen är samma ord för den som ser. En
  // pekskärm har ingen hover, och där är namnet menyraden (Fråga och andra flyttade åtgärder står med etikett i menyn).
  return (
    // ⛔ Felet står i tooltipen också (#150): den som ser märket ska kunna läsa vad det betyder utan skärmläsare.
    <OpsTooltip content={fel ? `${label}: ${fel}` : label} side="bottom">
      {lank}
    </OpsTooltip>
  );
}
