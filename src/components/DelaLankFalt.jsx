import { useId, useMemo, useState } from "react";
import {
  ADRESSSEGMENT,
  KODLANGD,
  MAX_ADRESSDEL,
  SLUMPSLUT_TECKEN,
  adressdel,
  foreslaAdress,
  nastaAdressdel,
} from "../lib/delning.js";
import { forvalda } from "../lib/ord.js";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsSegmented } from "./OpsSegmented.jsx";
import { OpsRadioGroup } from "./OpsRadioGroup.jsx";

/**
 * Fälten som en person fyller i när hen skapar en publik länk: hur länge den gäller, en valfri kod och adressen (0.125.0, cllp/lifehub.app#377).
 *
 * ══ ⛔ ETT FORMULÄR FÖR EN FIL OCH EN HÄNDELSE (regel 2) ═════════════════════════════════════════════════════════════
 *
 * Dialogen för en biblioteksfil (`OpsBibliotek`) och dialogen för en händelse (`HandelseDelning`) frågar samma tre saker med samma ord: giltighet, kod och
 * adress. Skillnaden är bara vilka giltigheter som finns (`dagval`: en fil har 1, 7 och 30 dagar, en händelse också "ingen gräns", som är förvalet) och
 * typsegmentet i adressen (`lib` eller `event`, `ADRESSSEGMENT`). Orden och reglerna bor här.
 *
 * ══ ⛔ ADRESSEN ÄR ETT FÖRSLAG PERSONEN KAN ÄNDRA, OCH SLUTET ÄR INTE ETT FÖRSLAG ════════════════════════════════════════
 *
 * Gruppdelen och sista delen föreslås ur gruppens namn och titeln (`foreslaAdress`: gemener, å/ä/ö till a/a/o, annat till bindestreck, högst
 * `MAX_ADRESSDEL` tecken) och går att skriva om i rutan. UTAN kod lägger servern själv till ett slumpat slut som inte går att ta bort; rutan visar
 * det som ett streck och åtta x, och säger det i en mening. MED kod blir adressen exakt det som står i fälten. Texterna ändras med valet medan personen skriver
 * koden, så att valet är begripligt innan länken finns.
 *
 * ⛔ FÄLTEN RENSAS (`adressdel`) NÄR LÄNKEN SKAPAS OCH INTE MEDAN PERSONEN SKRIVER: ett bindestreck sist i en del tas bort av rensningen, och skrivs den medan
 * delen ännu byggs hade ett "resa-" aldrig blivit "resa-med". Förhandsvisningen visar det som skickas.
 *
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_DELALANK = {
  giltighet: { sv: "Länken gäller", en: "The link is valid for" },
  ingenGrans: { sv: "Ingen gräns", en: "No limit" },
  enDag: { sv: "1 dag", en: "1 day" },
  flerDagar: { sv: "{n} dagar", en: "{n} days" },
  kodEtikett: { sv: "Kod (valfri)", en: "Code (optional)" },
  kodHjalp: { sv: "Den som öppnar länken måste skriva koden. Minst {min} tecken.", en: "Whoever opens the link must enter the code. At least {min} characters." },
  kodKort: { sv: "Koden ska vara minst {min} tecken.", en: "The code must be at least {min} characters." },
  kodLang: { sv: "Koden får vara högst {max} tecken.", en: "The code can be at most {max} characters." },
  adressEtikett: { sv: "Adress", en: "Address" },
  gruppdelEtikett: { sv: "Gruppens del av adressen", en: "The group part of the address" },
  sistaEtikett_event: { sv: "Händelsens del av adressen", en: "The event part of the address" },
  sistaEtikett_lib: { sv: "Filens del av adressen", en: "The file part of the address" },
  forhandsvisning: { sv: "Adressen blir", en: "The address will be" },
  slutUtanKod: {
    sv: "Utan kod får adressen ett slumpat slut som inte går att ta bort, så att den inte går att gissa.",
    en: "Without a code the address gets a random ending that cannot be removed, so it cannot be guessed.",
  },
  slutMedKod: { sv: "Med kod blir adressen exakt som du skriver den. Koden är skyddet.", en: "With a code the address is exactly what you write. The code is what protects it." },
  tomAdress: { sv: "Adressen kan inte vara tom. Skriv bokstäver eller siffror i båda delarna.", en: "The address cannot be empty. Write letters or digits in both parts." },
  upptagen: {
    sv: "Adressen är upptagen. Ett annat förslag står nu i fältet, kontrollera det och försök igen.",
    en: "That address is taken. Another suggestion is now in the field, check it and try again.",
  },
};

/** Texten med `{n}`, `{min}` och `{max}` ifyllda. @param {string} s @param {Record<string, string | number>} v */
const fyll = (s, v) => Object.entries(v).reduce((t, [k, x]) => t.replaceAll(`{${k}}`, String(x)), s);

/**
 * Tillståndet i fälten, och prövningen när personen trycker Skapa.
 *
 * @param {object} d
 * @param {"post" | "handelse"} d.slag
 * @param {unknown} [d.grupp] Gruppens namn, för förslaget till gruppdelen.
 * @param {unknown} [d.titel] Händelsens titel eller filens rubrik, för förslaget till sista delen.
 * @param {ReadonlyArray<number | null>} d.dagval Giltigheterna som erbjuds.
 * @param {number | null} d.forvalDagar Det som är valt från början.
 * @param {string} [d.sprak]
 */
export function useDelaLankFalt({ slag, grupp, titel, dagval, forvalDagar, sprak = "sv" }) {
  const forslag = useMemo(() => foreslaAdress({ grupp, titel, slag }), [grupp, titel, slag]);
  const [dagar, setDagar] = useState(/** @type {number | null} */ (forvalDagar));
  const [kod, setKod] = useState("");
  const [gruppdel, setGruppdel] = useState(forslag.gruppdel);
  const [sista, setSista] = useState(forslag.sista);
  const [meddelande, setMeddelande] = useState("");
  const t = forvalda(ORD_DELALANK, sprak);

  /** Det som skickas: delarna rensade. Förhandsvisningen visar samma. */
  const rensad = { gruppdel: adressdel(gruppdel), sista: adressdel(sista) };

  /**
   * Prövar fälten. `ok: false` ger meningen att visa; `ok: true` ger värdena som skickas till appen (`kod` är `null` utan kod).
   * @returns {{ ok: true, varde: { dagar: number | null, kod: string | null, gruppdel: string, sista: string } } | { ok: false, fel: string }}
   */
  function pro() {
    const k = kod.normalize("NFC").trim();
    if (k && k.length < KODLANGD.min) return { ok: false, fel: fyll(t.kodKort, { min: KODLANGD.min }) };
    if (k.length > KODLANGD.max) return { ok: false, fel: fyll(t.kodLang, { max: KODLANGD.max }) };
    if (!rensad.gruppdel || !rensad.sista) return { ok: false, fel: t.tomAdress };
    return { ok: true, varde: { dagar, kod: k || null, gruppdel: rensad.gruppdel, sista: rensad.sista } };
  }

  /** Servern sa att adressen är upptagen: sista delen blir nästa förslag (`resa` till `resa-2`) och meningen säger det. */
  function upptagen() {
    setSista(nastaAdressdel(rensad.sista, MAX_ADRESSDEL));
    setMeddelande(t.upptagen);
  }

  return { slag, dagval, dagar, setDagar, kod, setKod, gruppdel, setGruppdel, sista, setSista, rensad, pro, upptagen, meddelande, setMeddelande };
}

/**
 * @param {object} props
 * @param {ReturnType<typeof useDelaLankFalt>} props.falt
 * @param {string} [props.sprak]
 * @param {boolean} [props.disabled]
 */
export function DelaLankFalt({ falt, sprak = "sv", disabled = false }) {
  const t = forvalda(ORD_DELALANK, sprak);
  const adressId = useId();
  const { slag, dagval, dagar, setDagar, kod, setKod, gruppdel, setGruppdel, sista, setSista, rensad } = falt;
  const segment = ADRESSSEGMENT[slag];
  const harKod = kod.trim() !== "";
  /** @param {number | null} d */
  const etikett = (d) => (d === null ? t.ingenGrans : d === 1 ? t.enDag : fyll(t.flerDagar, { n: d }));
  /** @param {number | null} d */
  const varde = (d) => (d === null ? "ingen" : String(d));
  const val = dagval.map((d) => ({ value: varde(d), label: etikett(d) }));
  /** @param {string} v */
  const bytDagar = (v) => setDagar(v === "ingen" ? null : Number(v));

  return (
    <div data-delalank-falt={slag} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-etikett text-ink-muted">{t.giltighet}</p>
        {val.length <= 3 ? (
          <OpsSegmented ariaLabel={t.giltighet} value={varde(dagar)} onChange={bytDagar} options={val} />
        ) : (
          <OpsRadioGroup ariaLabel={t.giltighet} value={varde(dagar)} onChange={bytDagar} options={val} columns={2} />
        )}
      </div>

      <OpsField label={t.kodEtikett} hint={fyll(t.kodHjalp, { min: KODLANGD.min })}>
        <OpsInput value={kod} onChange={setKod} autoComplete="off" tal={false} disabled={disabled} maxLength={KODLANGD.max + 20} />
      </OpsField>

      <div role="group" aria-labelledby={adressId} className="flex flex-col gap-2">
        <p id={adressId} className="m-0 text-etikett font-medium text-ink-secondary">{t.adressEtikett}</p>
        {/* ⛔ TVÅ FÄLT UNDER VARANDRA, INTE `/g/ [fält] /event/ [fält]` PÅ EN RAD: på en telefon rymmer raden inte en hel titel, och en del som är avklippt i fältet
            ser ut att vara kortare än den är. Förhandsvisningen under dem visar hela adressen. */}
        <OpsField label={t.gruppdelEtikett}>
          <OpsInput value={gruppdel} onChange={setGruppdel} autoComplete="off" tal={false} disabled={disabled} />
        </OpsField>
        <OpsField label={t[`sistaEtikett_${segment}`]}>
          <OpsInput value={sista} onChange={setSista} autoComplete="off" tal={false} disabled={disabled} />
        </OpsField>
        <p data-delalank-forhandsvisning="" className="m-0 text-etikett text-ink-secondary break-all">
          {t.forhandsvisning}: <span className="text-ink">{`/g/${rensad.gruppdel}/${segment}/${rensad.sista}`}</span>
          {harKod ? null : <span data-delalank-slumpslut="" className="text-ink-muted">{`-${"x".repeat(SLUMPSLUT_TECKEN)}`}</span>}
        </p>
        <p data-delalank-slutmening="" className="m-0 text-etikett text-ink-muted">{harKod ? t.slutMedKod : t.slutUtanKod}</p>
        {falt.meddelande ? <p role="alert" data-delalank-upptagen="" className="m-0 text-etikett text-danger">{falt.meddelande}</p> : null}
      </div>
    </div>
  );
}
