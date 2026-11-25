import { useEffect, useLayoutEffect, useState } from "react";

/**
 * Ryms raden inte? Samma mått som mätningen (`scripts/huvudmeny-matt.mjs`, `hemikon-montage.mjs`): raden rullar i sidled, eller det som står längst ut
 * tränger in i radens högerpadding. Det andra är strängare än det första, eftersom en flexrad inte räknar sin padding till det som rullar: vid 360 px
 * slutade LifeHubs avatar 8 px in i paddingen utan att raden rullade. Ryms betyder samma sak här som där banden mättes.
 * @param {HTMLElement} rad
 */
function rymsInte(rad) {
  if (rad.scrollWidth > rad.clientWidth) return true;
  const stil = getComputedStyle(rad);
  const inneKant = rad.getBoundingClientRect().right - (parseFloat(stil.paddingRight) || 0) - (parseFloat(stil.borderRightWidth) || 0);
  let langstUt = 0;
  for (const barn of rad.children) langstUt = Math.max(langstUt, barn.getBoundingClientRect().right);
  return langstUt > inneKant + 0.5;
}

/**
 * Toppraden rullar aldrig i sidled: ryms den inte, flyttar fler appikoner bakom « (0.260.0, cllp/lifehub.app#909).
 *
 * ══ ⛔ HÄNDELSEN: CP 2026-11-24 22.22, iPhone, LifeHub-appen (bygge 4) ═════════════════════════════════════════════════════════════════════
 * Toppraden visade hem, gruppbild, tema (skärmikonen), Inkorg, Bibliotek, Ekonomi, Meddelanden och profilbild. Ingen « syntes, men raden gick att dra
 * några pixlar i sidled. Mätt i Chromium mot byggd dist (`scripts/huvudmeny-matt.mjs`, scenen med `tema`): 8 px vid 390 px och 5 px vid 393 px, 0 från 398 px.
 *
 * ⛔ ROTORSAKEN: vad som ryms avgjordes av `huvudmenyFordelning(antal)` och banden i `HUVUDMENY_BAND`, och de räknar bara appikonerna. Talen i banden
 * mättes på en topprad med EN åtgärd utöver apparna (Inkorg). Men skalet låter två åtgärder stå kvar i raden under `md` när hemikonen visas
 * (`ATGARDER_SMAL_HEM`), och en åtgärd som inte är en `OpsIconLink` (temaknappen) flyttas aldrig alls. LifeHub har både tema och Inkorg, alltså en
 * kontroll till, 44 px och 2 px mellanrum, som ingen räkning visste om. Vid 390 px sade bandet "tre ryms", och tre rymdes inte.
 *
 * ⛔ VARFÖR EN MÄTNING OCH INTE ETT TAL TILL. Allt som tar bredd i raden kan ändras av appen: hur många åtgärder, om de kan flyttas, en räknare, ett
 * gruppnamn. Ett band per kombination hade varit en tabell som ruttnar så fort en app lägger till en knapp, och just det hände här. Raden själv vet
 * exakt hur bred den är. Banden står kvar som första gissningen (ritas av CSS, utan JS, och syns i jsdom), och den här kroken rättar gissningen när
 * den slår fel: efter varje rendering, före målning (`useLayoutEffect`), mäts raden (`rymsInte`). Rullar den, eller tränger det som står längst ut in
 * i högerpaddingen, flyttas en appikon till, den sista som syns, bakom «, och mätningen görs om tills raden ryms. Ingen ikon försvinner: den
 * står bakom «, och « ritas då även där banden sade att alla ryms.
 *
 * ⛔ INGEN DOLD OVERFLOW (regel 1). Raden får inte `overflow: hidden`, som hade klippt det som inte rymdes och gjort felet osynligt. Finns inga fler
 * appikoner att flytta och raden ändå rullar, gör kroken ingenting: då är felet någon annanstans, och `scripts/huvudmeny-matt.mjs` ska se det rött.
 *
 * ⛔ MÄTNINGEN BÖRJAR OM NÄR BREDDEN ÄNDRAS (en `ResizeObserver` på raden, till exempel när telefonen vrids) och när antalet appikoner ändras. Annars
 * hade ett tak från stående läge stått kvar i liggande. Däremellan krymper taket bara: en räknare som försvinner ger ingen ikon tillbaka förrän nästa
 * breddändring, och raden hoppar därför inte fram och tillbaka.
 *
 * @param {import("react").RefObject<HTMLElement | null>} radRef Toppradens rad (`header > div`).
 * @param {number} antal Antal appikoner (`kvarIHuvudet`) i raden.
 * @returns {number | null} Hur många appikoner som får synas, räknat från första, eller `null` när banden (CSS) avgör.
 */
export function useToppradRyms(radRef, antal) {
  // Taket gäller den bredd och det antal det mättes vid. `bredd` är radens bredd nu, satt av en ResizeObserver; `null` innan den första gången hört av sig.
  const [lage, setLage] = useState(/** @type {{ antal: number, bredd: number, tak: number } | null} */ (null));
  const [bredd, setBredd] = useState(/** @type {number | null} */ (null));
  const tak = lage && lage.antal === antal && (bredd === null || lage.bredd === bredd) ? lage.tak : null;

  // Ingen beroendelista: varje rendering kan ha ändrat vad som står i raden (en räknare, en ny åtgärd). setLage med samma värde gör ingen ny rendering.
  useLayoutEffect(() => {
    const rad = radRef.current;
    if (!rad || antal === 0) return;
    if (!rymsInte(rad)) return;
    // Omslagen är `display: contents` (också långtryckets, `OpsHuvudmenyIkonVal`), så det är länken inuti som har en ruta, eller ingen när den är dold.
    const synliga = [...rad.querySelectorAll("[data-huvudmeny-plats]")].filter((omslag) => {
      const lank = omslag.querySelector("a, button");
      return lank ? lank.getBoundingClientRect().width > 0 : false;
    }).length;
    if (synliga === 0) return;
    setLage({ antal, bredd: rad.clientWidth, tak: synliga - 1 });
  });

  // ⛔ BREDDEN ÄR STATE, INTE EN NOLLSTÄLLNING. Första försöket satte taket till `null` vid en ny bredd, och när det redan var `null` (ut till 430 px, där
  // allt ryms, och tillbaka till 390) blev det ingen ny rendering, ingen ny mätning, och raden rullade 8 px igen. Mätt i Chromium, 2026-11-25. En ny bredd
  // är en ny rendering, och taket från en annan bredd gäller inte.
  useEffect(() => {
    const rad = radRef.current;
    if (!rad || typeof ResizeObserver === "undefined") return undefined;
    const iakttagare = new ResizeObserver(() => setBredd(rad.clientWidth));
    iakttagare.observe(rad);
    return () => iakttagare.disconnect();
  }, [radRef]);

  return tak;
}
