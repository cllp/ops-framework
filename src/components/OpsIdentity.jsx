import { cx } from "../lib/cx.js";
import { identityTone, initials } from "../lib/identity.js";

/**
 * Identitetsmärke för en grupp, ett projekt eller en person.
 *
 * ⛔ IDENTITET BÄRS ALDRIG AV EN FÄRGAD PRICK. En prick säger ingenting till
 * den som inte redan lärt sig färgkoden, den går inte att läsa upp för en
 * skärmläsare, och den är oanvändbar för var tjugonde man. Märket visar bild,
 * ikon eller initialer, och färgen är bakgrund till det, aldrig budskapet.
 *
 * ⛔ Tonen väljs ur `seed`, som ska vara ett STABILT id. Inte namnet. Härleds
 * färgen ur namnet byter gruppen färg den dag någon rättar en stavning, och då
 * är färgen värdelös som igenkänning.
 */

/**
 * ⛔ Klassnamnen står utskrivna, inte byggda med `bg-identity-${n}`.
 *
 * Tailwind läser källkoden som text och hittar bara klasser som faktiskt står
 * där. En interpolerad sträng genererar ingen CSS, och resultatet är ett märke
 * utan bakgrundsfärg som fungerar i utvecklingsläge och försvinner i bygget.
 */
const TONKLASSER = {
  1: "bg-identity-1",
  2: "bg-identity-2",
  3: "bg-identity-3",
  4: "bg-identity-4",
  5: "bg-identity-5",
  6: "bg-identity-6",
};

const STORLEKAR = {
  sm: "size-6 text-xs",
  md: "size-9 text-base",
  lg: "size-12 text-md",
};

/**
 * @param {object} props
 * @param {string} props.name Visningsnamn. Används för initialer och som alternativtext.
 * @param {string} props.seed Stabilt id som bestämmer tonen NÄR `tone` inte skickas in. Aldrig namnet.
 * @param {string} [props.imageUrl]
 * @param {"sm"|"md"|"lg"} [props.size]
 * @param {import("react").ComponentType<{size?: number}>} [props.icon] En egen ikon i stället för initialer,
 *   ritad bara när `imageUrl` saknas (#164, korrigering C: "standardikon plus färg kräver ingen Storage").
 *   Ramverket känner inte till vilka ikoner som finns, appen skickar in komponenten (se `src/lib/profilikoner.js`
 *   för profilvyns karta).
 * @param {1|2|3|4|5|6} [props.tone] Åsidosätter tonen `identityTone(seed)` annars härleder. Ett UTTRYCKLIGT val,
 *   t.ex. personens sparade `farg` (#164), väger tyngre än det härledda.
 */
export function OpsIdentity({ name, seed, imageUrl, size = "md", icon: Icon, tone }) {
  const storlekKlass = STORLEKAR[size];
  if (!storlekKlass) {
    throw new Error(`OpsIdentity: okänd size "${size}". Giltiga: ${Object.keys(STORLEKAR).join(", ")}.`);
  }
  if (!seed) {
    throw new Error("OpsIdentity: seed krävs och ska vara ett stabilt id. Utan den blir tonen slumpad, och då byter samma grupp färg mellan två renderingar.");
  }

  const base = cx("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md", storlekKlass);

  if (imageUrl) {
    // Bilden har alt="" och märket bär namnet, annars läses namnet upp två
    // gånger i rad av skärmläsaren.
    return (
      <span className={base} role="img" aria-label={name}>
        <img src={imageUrl} alt="" className="size-full object-cover" />
      </span>
    );
  }

  const vaildTone = tone && TONKLASSER[tone] ? tone : identityTone(seed);

  return (
    <span className={cx(base, TONKLASSER[vaildTone], "font-semibold text-ink-inverse")} role="img" aria-label={name}>
      <span aria-hidden="true">{Icon ? <Icon size={size === "lg" ? 24 : size === "sm" ? 12 : 18} /> : initials(name)}</span>
    </span>
  );
}
