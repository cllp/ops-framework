import { useEffect } from "react";
import { OpsPdfVisningLat } from "./OpsPdfVisningLat.jsx";

/**
 * En PDF i HELA fönstret (0.193.0, cllp/ops-framework#530), appens sida för `oppnaPdf` på `OpsBibliotek`. Samma visning som i detaljen (`OpsPdfVisning`), med Stäng i raden och sidorna i resten av höjden.
 *
 * ⛔ SAMMA MÖNSTER SOM `OpsHtmlVy`: appen ritar den på en egen sida utan skal, hämtar posten själv (behörigheten är appens) och ger filens byte med `hamta`. Adressfältet visar appens sida, aldrig lagringens adress.
 * ⛔ EGEN MODUL MED LAT VISNING: en app som importerar vyn får inte pdf.js i sin startfil. Visningen och pdf.js hämtas först när sidan ritas.
 *
 * @param {object} props
 * @param {(sokvag: string) => Promise<Blob>} props.hamta Filens byte med inloggningen (`hamtaFil`).
 * @param {string} props.sokvag
 * @param {string} props.namn Filens namn.
 * @param {boolean} [props.laddaNed] `false`: ingen Ladda ned. Förval `true`.
 * @param {() => void} [props.onStang] Stäng eller tillbaka.
 * @param {string} [props.stangEtikett] Knappens ord. Förval "Stäng".
 */
export function OpsPdfVy({ hamta, sokvag, namn, laddaNed = true, onStang, stangEtikett }) {
  // ⛔ SIDRAMENS RESERVERADE RULLNINGSLIST GÄLLER INTE EN VY SOM FYLLER FÖNSTRET, samma skäl som i `OpsHtmlVy`: utan raden stod en tom remsa längs högerkanten.
  useEffect(() => {
    const rot = document.documentElement;
    const fore = rot.style.scrollbarGutter;
    rot.style.scrollbarGutter = "auto";
    return () => {
      rot.style.scrollbarGutter = fore;
    };
  }, []);
  return <OpsPdfVisningLat hamta={hamta} sokvag={sokvag} namn={namn} laddaNed={laddaNed} helfonster onStang={onStang} stangEtikett={stangEtikett} />;
}
