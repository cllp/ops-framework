import { createRoot } from "react-dom/client";
import * as Ops from "OPS_DIST";

/*
 * Ytan för skärmbilderna av färgväljaren överallt (cllp/lifehub.app#882, CP 2026-11-18: "Överallt där vi har color pocket"),
 * `scripts/fargval-montage.mjs`. En scen i taget (`window.__fargvalScen`): gruppens formulär, profilen, en av mina kalendrar och en
 * kategori. Ytan använder bara props som fanns före 0.238.0, så att samma fil fotograferar före (origin) och efter (grenen).
 */

const scen = /** @type {any} */ (window).__fargvalScen || "grupp";
const ingenting = async () => {};

const MINA = [
  Ops.byggMinKalender({ id: "traning", namn: "Träning", farg: 2, ikon: "stjarna", ordning: 0 }),
  Ops.byggMinKalender({ id: "familj", namn: "Familjen", farg: 4, ikon: "hus", ordning: 10 }),
];
const KATEGORIER = Ops.validateKatalog([{ id: "uppgift", namn: { sv: "Uppgifter" }, farg: 1, ikon: "check", fas: "aktiv", ordning: 0 }], { ikoner: ["check", "bell"], grupp: false });

function Scen() {
  if (scen === "grupp") {
    return <Ops.OpsGruppFormular formId="f" grupp={{ id: "korens-grupp", namn: "Kören", farg: "kulor:195", ikon: "music" }} onSkapa={ingenting} onSpara={ingenting} onSkapad={() => {}} onKlar={() => {}} />;
  }
  if (scen === "profil") return <Ops.OpsProfil anvandare={{ id: "uid-anna", namn: "Anna Ek", epost: "anna@exempel.se", bild: "", sprak: "sv", tema: "system", telefon: "", stad: "Visby", presentation: "", lankar: [], bildSokvag: "", farg: "kulor:15", ikon: "leaf" }} onSpara={ingenting} />;
  if (scen === "kalender") return <Ops.OpsKalendrar gruppens={[]} mina={MINA} groupId="" kanAndraGruppens={false} onSparaGruppens={ingenting} onSparaMina={ingenting} />;
  return <Ops.OpsKatalogInstallning kategorier={KATEGORIER} ikoner={["check", "bell"]} kanAndra onSpara={ingenting} onArkivera={ingenting} groupId="kor" />;
}

createRoot(/** @type {HTMLElement} */ (document.getElementById("root"))).render(
  <Ops.OpsSprakProvider sprak="sv">
    <main className="mx-auto max-w-xl p-4" data-fargval-scen={scen}>
      <Scen />
    </main>
  </Ops.OpsSprakProvider>,
);
