/**
 * Sentry som en färdig felmottagare. Egen ingång, `ops-framework/sentry`.
 *
 * ══ ⛔ VARFÖR EN EGEN INGÅNG OCH INTE EN DEL AV HUVUDPAKETET (#159) ═══════
 *
 * CP: "Skall Sentry vara default eller optional i framework?" Svaret,
 * bekräftat: VALFRITT, MEN FÄRDIGKOPPLAT. Ramverket känner inga externa
 * konton (ingen DSN, precis som ingen Firebase-config), men den app som VILL
 * ha Sentry ska kunna skriva en enda rad:
 *
 *   import { sentryMottagare } from "ops-framework/sentry";
 *   const felmottagare = sentryMottagare({ dsn, miljo, version });
 *
 * ⛔ EN EGEN INGÅNG ÄR VAD SOM GÖR "FÄRDIGKOPPLAT" MÖJLIGT UTAN ATT TVINGA
 * ALLA. Låg den här koden i `src/index.js` hade `@sentry/browser` behövt
 * finnas i VARJE apps bundle, oavsett om den använder Sentry, av samma skäl
 * som `createFirestoreSource` inte importerar `firebase/firestore`: en
 * import i huvudingången är en import i varje besökares JS-fil. Den här
 * filen importeras BARA av den app som skriver raden ovan, så `@sentry/browser`
 * hamnar bara i DEN appens bundle. `scripts/check-paket.mjs` bevisar att
 * ramverkets egen `dist/index.js` aldrig nämner Sentry.
 *
 * ⛔ DÄRFÖR ÄR FILEN OBUNDLAD ESM, PRECIS SOM `src/node/index.js`.
 * `package.json` pekar `"./sentry"` direkt hit, ingen esbuild-runda. Det är
 * appens EGEN bundlare (Vite) som ser importen och drar in `@sentry/browser`,
 * bara då.
 *
 * ⛔ `@sentry/browser` ÄR EN PEER, OPTIONAL, ALDRIG EN DEPENDENCY. En vanlig
 * `dependency` installeras ALLTID, för alla, oavsett om de importerar den här
 * filen. En `peerDependency` med `optional: true` installeras bara om appen
 * själv listar den, vilket är precis rätt: bara den app som skriver raden
 * ovan ska behöva ett Sentry-konto.
 *
 * ⛔ SKRIVS INTE MED I tsconfig.json:s `checkJs`, MED SKÄLET UTSKRIVET DÄR:
 * filen importerar en SDK ramverket avsiktligt inte installerar åt sig
 * självt, och en typkontroll av en modul som inte finns är bara ett annat
 * sätt att tvinga fram beroendet ändå.
 */

/* eslint-disable import/no-unresolved -- se filhuvudet: SDK:n är appens val, inte ramverkets. */
import * as Sentry from "@sentry/browser";

/**
 * @param {{ dsn: string, miljo: string, version?: string }} konfig
 * @returns {import("./lib/felrapport.js").Felmottagare}
 */
export function sentryMottagare(konfig) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN, SAMMA SKÄL SOM VARJE ANNAN FABRIK
   * I RAMVERKET (#129 punkt 5): ett anrop utan argument ska namnge sig,
   * inte krascha på "Cannot destructure property 'dsn' of 'undefined'".
   */
  const { dsn, miljo, version } = konfig ?? /** @type {any} */ ({});
  if (!dsn) throw new Error("sentryMottagare: dsn krävs.");
  if (!miljo) throw new Error("sentryMottagare: miljo krävs.");

  // ⛔ INITIERAS FÖRST VID FÖRSTA ANROPET, INTE VID sentryMottagare(). En app
  // som bygger sin konfiguration vid modulnivå (vanligt) ska inte råka
  // initiera Sentry innan resten av appen är klar att köra.
  let initierad = false;
  function sakerstallInit() {
    if (initierad) return;
    Sentry.init({ dsn, environment: miljo, release: version });
    initierad = true;
  }

  return {
    fanga(fel, sammanhang) {
      sakerstallInit();
      Sentry.captureException(fel, sammanhang ? { extra: sammanhang } : undefined);
    },

    // ⛔ ALDRIG E-POST, SE felrapport.js filhuvud. `anvandare` här är redan
    // begränsad till `{ uid, groupId }` av kontraktets typ.
    satt(anvandare) {
      sakerstallInit();
      Sentry.setUser(anvandare ? { id: anvandare.uid, groupId: anvandare.groupId } : null);
    },
  };
}
