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
 */

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

  return (
    <>
      {rader.map((rad) => (
        <OpsKatalogInstallning
          key={`${rad.modulId}-${rad.id}`}
          kategorier={rad.kategorier}
          ikoner={ikoner}
          ikonRitare={ikonRitare}
          kanAndra={kanAndra}
          sprak={sprak}
          rubrik={text(rad.namn, sprak)}
          onSpara={(kategori) => onSpara(rad.id, kategori)}
          onArkivera={(kategori, arkiverad) => onArkivera(rad.id, kategori, arkiverad)}
        />
      ))}
    </>
  );
}
