import { Suspense } from "react";
import { tillaggFor } from "../lib/tillagg.js";
import { text } from "../lib/sprak.js";

/**
 * Sektionerna som påslagna moduler bidrar med i appens inställningar (0.140.0, platsen `installningar.sektion`).
 *
 * ══ ⛔ APPEN RITAR PLATSEN, RAMVERKET GER RADERNA ═════════════════════════════════════════════════════════════════
 *
 * Ramverket äger inte appens inställningsvy: sektionerna i `OpsInstallningar` är appens egna (`Installningssektion`). Platsen
 * `installningar.sektion` (`lib/tillagg.js`) gör att en modul kan SÄGA att den har en sektion där, och den här funktionen är det som
 * gör om modulernas tillägg till sektioner i samma form som appens egna. Appen lägger dem i sin lista:
 *
 *   const sektioner = [...egnaSektioner, ...installningsSektioner({ moduler, grupp, sprak, extra: { kanAndra } })];
 *
 * ⛔ UTAN DET ANROPET RITAS INGET. Platsen är då öppen i manifestet och tom på skärmen, alltså en app som erbjuds under "Appar som
 * kan läggas till", installeras och inte syns (regel 5). Därför står anropet som ett krav i CHANGELOG och README.
 *
 * ⛔ SAMMA FILTER SOM ÖVRIGA PLATSER: `tillaggFor`, så en avslagen moduls sektion ritas inte och dess komponent anropas inte, och en
 * kärnmodul är alltid påslagen. Beslutet går att pröva utan att rita.
 *
 * ⛔ `id` ÄR `<modulId>.<tilläggsId>` och står i adressen (`OpsInstallningar` läser den ur URL:en). Det är stabilt eftersom båda delarna
 * är maskinnycklar som ramverket stämplar och avvisar dubbletter av. Två moduler kan inte få samma id.
 *
 * ⛔ IKON, BESKRIVNING OCH ANTAL ÄR APPENS. Tillägget bär bara en etikett (rubriken), eftersom en ikon är ett React-element och
 * manifestet hålls fritt från ritade saker utanför komponenten. Sektionen får kugghjulet (`OpsInstallningar`:s förval) tills appen
 * lägger på en: `.map((s) => (s.id === "bokning.installningar" ? { ...s, ikon: <Kalender />, beskrivning: "..." } : s))`.
 *
 * ⛔ `extra` FÅR INTE ÖVERSKRIVA `grupp`. Komponenten får `{ ...extra, grupp }`: gruppen är den ramverket filtrerade på, och en app som
 * skickade en annan hade visat en sektion för en grupp där modulen inte är på.
 *
 * Komponenten kan vara `lazy`: sektionen ritas i en `Suspense` med en rad som säger att den läses, och monteras bara när sektionen är
 * vald (`OpsInstallningar` monterar `innehall` först då), så en tung inställning laddas inte för den som inte öppnar den.
 *
 * @param {object} arg
 * @param {ReadonlyArray<import("../lib/modul.js").Modul> | null | undefined} arg.moduler Appens moduler, ur `validateModuler`.
 * @param {{ moduler?: ReadonlyArray<string> } | null | undefined} arg.grupp Den aktiva gruppen. Utan grupp är ingenting påslaget.
 * @param {string} [arg.sprak] "sv" eller "en". Förval "sv".
 * @param {Record<string, unknown>} [arg.extra] Mer som appen vill ge komponenterna, till exempel `kanAndra`. `grupp` kan inte skrivas över.
 * @returns {import("./OpsInstallningar.jsx").Installningssektion[]}
 */
export function installningsSektioner({ moduler, grupp, sprak = "sv", extra = {} }) {
  return tillaggFor({ moduler, grupp, plats: "installningar.sektion" }).map((t) => {
    const Komponent = /** @type {import("react").ComponentType<any>} */ (t.komponent);
    return {
      id: `${t.modulId}.${t.id}`,
      rubrik: text(t.etikett, sprak),
      innehall: (
        <Suspense fallback={<p role="status" className="m-0 text-hjalp text-ink-muted">{sprak === "en" ? "Loading" : "Läser"}</p>}>
          <Komponent {...extra} grupp={grupp} />
        </Suspense>
      ),
    };
  });
}
