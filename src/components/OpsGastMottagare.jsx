import { tolkaGastMottagare } from "../lib/gast.js";
import { definierade, forvalda } from "../lib/ord.js";
import { OpsPill } from "./OpsPill.jsx";

/**
 * Orden vid en gäst som ansvarig, på svenska och engelska (0.132.0, cllp/lifehub.app#389, skiva 3).
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSGASTMOTTAGARE = {
  gast: { sv: "Gäst", en: "Guest" },
  aterkallad: { sv: "Gäst (inbjudan återkallad)", en: "Guest (invitation withdrawn)" },
};

/**
 * En gäst som ansvarig för ett ärende, så som medlemmarna ser den (0.132.0, cllp/lifehub.app#389, skiva 3): namnet och märket Gäst, eller märket "Gäst (inbjudan återkallad)" när inbjudan är dragen tillbaka.
 *
 * ══ ⛔ "ÅTERKALLAD" HÄRLEDS HÄR OCH LAGRAS ALDRIG PÅ ÄRENDET ═══════════════════════════════════════════════════════════════
 *
 * Delegeringen står kvar på ärendet när inbjudan dras tillbaka, så att medlemmarna ser vem det låg hos. Märket kommer ur `levande` (tjänstens `levandeGaster().gaster`): en gäst som saknas där har ingen levande
 * inbjudan. Ett märke på själva raden hade glidit isär från inbjudan, och en ny inbjudan till samma adress hade lämnat det kvar (`tolkaGastMottagare`).
 *
 * ⛔ TRE UTFALL: utan `levande` är det inte känt, och komponenten visar då bara Gäst. "Vet inte" är inte "inte återkallad", och inte heller "återkallad".
 *
 * ⛔ EN ANNAN MOTTAGARE ÄR `null`, INTE ETT TOMT MÄRKE. Appen ritar personer och gruppen som förut och anropar den här bara för en mottagare av slaget `gast`.
 *
 * @param {object} props
 * @param {unknown} props.mottagare Ärendets `mottagare`.
 * @param {ReadonlyArray<{ gastId: string, namn?: string }>} [props.levande] Tjänstens `levandeGaster().gaster`.
 * @param {boolean} [props.utanNamn] Bara märket, utan namnet (där namnet redan står bredvid).
 * @param {string} [props.sprak]
 * @param {Partial<Record<keyof typeof ORD_OPSGASTMOTTAGARE, string>>} [props.ord]
 */
export function OpsGastMottagare({ mottagare, levande, utanNamn = false, sprak = "sv", ord }) {
  const g = tolkaGastMottagare(mottagare, levande);
  if (!g) return null;
  const t = { ...forvalda(ORD_OPSGASTMOTTAGARE, sprak), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  return (
    <span data-gast-mottagare={g.gastId} data-aterkallad={g.aterkallad === null ? "okand" : String(g.aterkallad)} className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
      {utanNamn ? null : <span className="min-w-0 wrap-anywhere">{g.namn}</span>}
      <span data-gast-markning="">
        <OpsPill size="liten" tone={g.aterkallad ? "warning" : "neutral"}>
          {g.aterkallad ? t.aterkallad : t.gast}
        </OpsPill>
      </span>
    </span>
  );
}
