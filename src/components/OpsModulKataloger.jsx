import { useKallor } from "../data/useKallor.jsx";
import { OpsKatalogInstallning } from "./OpsKatalogInstallning.jsx";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { text } from "../lib/sprak.js";

/**
 * Modulernas egna kataloger i inställningsvyn.
 *
 * ⛔ EN INSTÄLLNINGSVY PER KATALOG, inte en sammanslagen lista. Kategorierna i
 * två kataloger betyder olika saker, och en gemensam lista hade tvingat
 * läsaren att hålla isär dem på namnet. `OpsKatalogInstallning` ritar EN
 * katalog, och det är rätt form.
 *
 * ⛔ GRUPPEN AVGÖR VILKA SOM VISAS, och det sker inte här. `groups/{gid}.moduler`
 * bestämmer vilka moduler som alls är med i gruppen, alltså är registret redan
 * filtrerat när det byggs. Ett andra filter här vore en andra sanning om samma
 * fråga.
 *
 * ══ ⛔ "ANVÄNDS I", HÄRLETT UR MANIFESTET, ALDRIG HANDSKRIVET (#164) ═══
 *
 * En katalog vet inte av sig själv vilka moduler som delar den. Två moduler
 * kan råka registrera samma katalog-id (`kallor.kataloger` returnerar en rad
 * med samma `id`), och den som ändrar en av dem ska se den andra utan att
 * gissa eller hålla en handskriven lista i takt. Raden byggs därför av samma
 * `rader` som redan kommer ur registret: alla rader med samma `id` DECLARERAR
 * samma katalog, oavsett vilken modul som gjorde det, och modulens
 * VISNINGSNAMN kommer ur `register.modulNamn(modulId)`, aldrig ur `modulId`
 * skrivet för hand i en app.
 *
 * ⛔ TOM LISTA ÄR ETT SVAR, INTE EN UTELÄMNAD RAD (arbetsreglernas punkt 5).
 * Hittar registret ingen modul för ett `modulId` som en rad ändå bär (en
 * modul som funnits men plockats bort ur listan mellan två hämtningar) skrivs
 * raden ändå ut, med en text som säger att ingen modul just nu står bakom
 * katalogen, i stället för att tystna.
 */

/**
 * Modulernas visningsnamn för en katalog, i den ordning de först syns.
 *
 * ⛔ EXPORTERAD FÖR ATT GÅ ATT PROVA REN. Den fulla vyn kräver `useKallor` och
 * ett register; den här regeln, "vilka moduler delar ett katalog-id", är ren
 * datalogik och ska kunna bevisas utan att montera något.
 *
 * @param {readonly Record<string, any>[]} allaRader Hela svaret från `register.kataloger(fraga)`, alltså `{ id, modulId, ... }`.
 * @param {string} katalogId
 * @param {(modulId: string) => import("../lib/sprak.js").Namn | null} modulNamn
 * @param {string} [sprak]
 * @returns {string[]}
 */
export function anvandsIModuler(allaRader, katalogId, modulNamn, sprak) {
  /** @type {string[]} */
  const modulIder = [];
  for (const r of allaRader) {
    if (r && r.id === katalogId && !modulIder.includes(r.modulId)) modulIder.push(r.modulId);
  }
  return modulIder.map((id) => text(modulNamn(id) ?? id, sprak)).filter(Boolean);
}

/**
 * @param {object} props
 * @param {ReturnType<typeof import("../lib/kallor.js").skapaKallregister> | null} props.register
 * @param {{ groupId: string }} props.fraga
 * @param {readonly string[]} props.ikoner Tillåtelselistan. Appen äger den.
 * @param {(katalogId: string, kategori: import("../lib/katalog.js").Kategori) => void} props.onSpara
 * @param {(katalogId: string, kategori: import("../lib/katalog.js").Kategori, arkiverad: boolean) => void} props.onArkivera
 * @param {(namn: string) => import("react").ReactNode} [props.ikonRitare]
 * @param {boolean} [props.kanAndra]
 * @param {string} [props.sprak]
 * @param {string} [props.tomText]
 */
export function OpsModulKataloger({ register, fraga, ikoner, onSpara, onArkivera, ikonRitare, kanAndra, sprak, tomText = "Ingen modul i den här gruppen har egna kataloger." }) {
  const { rader, laddar, fel } = useKallor(register, "kataloger", fraga);

  if (fel) {
    return <OpsBanner tone="danger" title="Katalogerna kunde inte läsas">{fel.message}</OpsBanner>;
  }
  if (laddar) return <OpsSpinner label="Hämtar kataloger" />;
  if (rader.length === 0) return <OpsEmpty title={tomText} />;

  const modulNamn = register && typeof register.modulNamn === "function" ? register.modulNamn : () => null;

  return (
    <>
      {rader.map((rad) => {
        const egnaModulnamn = text(modulNamn(rad.modulId) ?? rad.modulId, sprak);
        const anvandsI = anvandsIModuler(rader, rad.id, modulNamn, sprak);
        return (
          <section key={`${rad.modulId}-${rad.id}`} className="flex flex-col gap-1">
            {/* ⛔ MODULENS NAMN, INTE MODULENS ID. Ett `<h3>` och inte en del av
                `rubrik`-propen: `OpsKatalogInstallning` använder `rubrik` som
                listans skärmläsarnamn, och en app som lägger modulnamnet där
                hade dubblerat det på varje läsning. */}
            <h3 className="m-0 text-sektion uppercase text-accent">{egnaModulnamn}</h3>
            <p className="m-0 text-hjalp text-ink-muted">
              {/* ⛔ TOMHET ÄR ETT SVAR (arbetsreglernas punkt 5): en katalog utan
                  en modul bakom sig skriver ut det, i stället för att raden
                  bara försvinner. */}
              {anvandsI.length > 0 ? `Används i: ${anvandsI.join(", ")}` : "Används inte av någon modul just nu."}
            </p>
            <OpsKatalogInstallning
              kategorier={rad.kategorier}
              ikoner={ikoner}
              ikonRitare={ikonRitare}
              kanAndra={kanAndra}
              sprak={sprak}
              rubrik={text(rad.namn, sprak)}
              /*
               * ⛔ #162: SAMMA groupId SOM `fraga` FRÅGADE MED. Den här vyn
               * ritar redan EN grupps kataloger (`useKallor(register, "kataloger", fraga)`
               * ovan), så en ny eller ändrad kategori ska höra till samma
               * grupp den lästes ur, aldrig till ingen alls.
               */
              groupId={fraga && fraga.groupId}
              onSpara={(kategori) => onSpara(rad.id, kategori)}
              onArkivera={(kategori, arkiverad) => onArkivera(rad.id, kategori, arkiverad)}
            />
          </section>
        );
      })}
    </>
  );
}
