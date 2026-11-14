/**
 * Märket "by Life Hub" (0.229.0). En rad text som hubbens om-ruta, profilen och inloggningen kan sätta under sitt eget namn.
 *
 * CP 2026-11-14: "It´s always by Life Hub." En hubb heter det dess grupp kallar den, men kontot och plattformen under är
 * alltid Life Hub. Märket står därför med samma ord på båda språken, och en hubb kan inte byta det: det är inte hubbens text.
 *
 * ⛔ BARA TEXT, INGEN LÄNK. Ramverket känner aldrig Identitys adresser (cllp/lifehub.identity#178). Vill appen att märket
 * leder någonstans lägger den en länk runt det.
 */
export function OpsByLifeHub() {
  return (
    <span data-by-life-hub="" className="text-meta text-ink-muted">
      by Life Hub
    </span>
  );
}
