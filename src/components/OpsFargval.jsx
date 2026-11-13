import { useId, useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { faltTriggerKlass, faltYtaKlass } from "../lib/radKlass.js";
import { lasPalett, normaliseraHex } from "../lib/palett.js";
import { hallbarLjushet, hexTillHsl, hslTillHex, riktningsbesked } from "../lib/palettomfang.js";
import { ordet } from "../lib/ord.js";
import { OpsField, OpsInput, useFieldBinding } from "./OpsField.jsx";
import { ChevronNedIkon } from "./icons.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";

/**
 * Färgväljaren: rutan och färgkoden i ett fält, och en panel med reglage när man trycker på den (0.219.0, cllp/lifehub.app#798).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-12, om Hubbens färger: "vi behöver en color picker och reglage som kommer upp när man trycker på rutan. Låt det vara
 * möjligt att skriva in hex också, men bra att kunna välja. Det måste vara tydligare var på skalan man är fel, om det behöver vara
 * ljusare eller mörkare." Färgen gick då bara att skriva som en kod, och rutan bredvid fältet var en bild som inte gick att trycka på.
 *
 * ══ ⛔ VAD PANELEN GÖR ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   - Tre reglage, kulör, mättnad och ljushet (HSL, skälet står i `palettomfang.js`), och färgkoden under dem. Koden går att skriva
 *     som förut; det som skrivs går till `onChange` som det står, också en halv kod, så att appens fält kan säga att formen är fel.
 *     Reglagen ger alltid `#rrggbb`.
 *   - ⛔ LJUSHETEN VISAR VAR DET HÅLLER, när appen ger `palett`, `lage` och `nyckel`. Delarna av skalan som inte håller tonas ned,
 *     de som håller ramas in, och tummen är var färgen står. Under reglaget står det i ord ("Håller mellan 0 och 35 %"), var färgen
 *     står och åt vilket håll den ska ändras, och knappen "Använd närmaste som fungerar". Skalan räknas av `hallbarLjushet`, alltså
 *     genom samma granskning som nekar Spara, och aldrig här.
 *   - ⛔ EN RUTA VID FÄLTET PÅ ALLA BREDDER, som datumväljaren (`OpsDatePicker`), och inte ett ark nerifrån på telefonen. Samma beslut
 *     som `OpsAtgardsblad` 0.102.0 (CP 2026-10-14: "Kanske popup med en kortare meny"), och reglagen behöver se fältet de ändrar.
 *     Rutan är högst så bred som fönstret, och Radix flyttar den inom skärmen.
 *   - Escape och ett tryck utanför stänger, och fokus går tillbaka till fältet (Radix). Fokus hamnar på kulören när panelen öppnas.
 *
 * ⛔ RIKTIGA `<input type="range">`, med etikett, `aria-valuetext` i ord och piltangenterna, som `OpsSlider`. Klassen `ops-reglage`
 * målar tumme och skena ur token (`check-slider`), och `ops-fargreglage` gör skenan genomskinlig så att färgen under syns. Elementet
 * är 44 px högt: det är tummen som ska träffa.
 *
 * ⛔ FÄRGERNA PÅ SKALORNA ÄR `style`, av samma skäl som `OpsFargruta`: de finns bara vid körning.
 */

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_OPSFARGVAL = {
  panel: { sv: "Välj färg", en: "Choose colour" },
  ingen: { sv: "Ingen färg", en: "No colour" },
  kulor: { sv: "Kulör", en: "Hue" },
  mattnad: { sv: "Mättnad", en: "Saturation" },
  ljushet: { sv: "Ljushet", en: "Lightness" },
  grader: { sv: "{v} grader", en: "{v} degrees" },
  procent: { sv: "{v} procent", en: "{v} percent" },
  fargkod: { sv: "Färgkod", en: "Colour code" },
  fargkodHint: { sv: "Sex tecken efter #, till exempel #8e7a4e.", en: "Six characters after #, for example #8e7a4e." },
  felForm: { sv: "Skriv sex tecken efter #, till exempel #8e7a4e.", en: "Type six characters after #, for example #8e7a4e." },
  haller: { sv: "Håller mellan {intervall}.", en: "Works between {intervall}." },
  spann: { sv: "{fran} och {till} %", en: "{fran} and {till}%" },
  och: { sv: " och mellan ", en: " and between " },
  star: { sv: "Du står på {v} %.", en: "You are at {v}%." },
  narmaste: { sv: "Använd närmaste som fungerar", en: "Use the nearest that works" },
};

/** @param {string} mall @param {Record<string, string | number>} varden */
function fyll(mall, varden) {
  return mall.replace(/\{(\w+)\}/g, (_, k) => String(varden[k]));
}

/** @param {number} n Färgstopp på en skala. @param {(i: number) => string} farg */
function gradient(n, farg) {
  const stopp = Array.from({ length: n }, (_, i) => farg(i / (n - 1)));
  return { backgroundImage: `linear-gradient(to right, ${stopp.join(", ")})` };
}

/**
 * Ett reglage med en färgskala under skenan.
 * @param {{ id: string, etikett: string, varde: number, max: number, steg?: number, text: string, onChange: (v: number) => void, skala: import("react").CSSProperties, beskrivs?: string, children?: import("react").ReactNode, falt: string }} props
 */
function Fargreglage({ id, etikett, varde, max, steg = 1, text, onChange, skala, beskrivs, children, falt }) {
  return (
    <div className="flex flex-col gap-1" data-fargreglage={falt}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-etikett font-medium text-ink">
          {etikett}
        </label>
        <span className="text-etikett tabular-nums text-ink-secondary">{text}</span>
      </div>
      <div className="relative flex h-11 items-center">
        {/* ⛔ Skalan ligger UNDER reglaget och tar inga tryck. Den är indragen en halv tumme åt varje håll, eftersom tummens mitt
            går från 10 px till bredden minus 10 px: annars stod en kant på skalan på fel ställe mot tummen. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-2.5 top-1/2 h-3 -translate-y-1/2 rounded-full" style={skala}>
          {children}
        </div>
        <input
          id={id}
          type="range"
          className="ops-reglage ops-fargreglage relative h-11 w-full cursor-pointer bg-transparent"
          min={0}
          max={max}
          step={steg}
          value={varde}
          aria-valuetext={text}
          aria-describedby={beskrivs}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

/** Färgkoden som paletten lagrar: `#` och sex små hexsiffror (`lasPalett`). */
const HEL_KOD = /^#[0-9a-f]{6}$/;

/**
 * Det som skrivs i färgkoden, på väg till appen.
 *
 * ⛔ EN HEL KOD GÅR VIDARE I PALETTENS FORM, EN HALV SOM DEN STÅR (granskningen av PR 581). `#1F1F25` eller ` #1f1f25 ` hade annars gått
 * vidare som det skrevs. Paletten kräver små bokstäver och sex siffror, så skalan hade försvunnit för varje färg på panelen utan att något
 * fel visades: samma fastlåsta läge som CP beskrev. En halv kod (`#12`, `#abc`) går vidare som den står, så att den kan skrivas klart, och
 * fältet säger formen. `#abc` görs inte om till `#aabbcc` medan man skriver: då hade `#abcdef` inte gått att skriva.
 * @param {string} text
 */
function skrivenKod(text) {
  const t = String(text ?? "").trim();
  return /^#?[0-9a-fA-F]{6}$/.test(t) ? `#${t.replace(/^#/, "").toLowerCase()}` : String(text ?? "");
}

/**
 * @param {object} props
 * @param {string} props.value Färgen som den står i appens utkast: `#rrggbb`, eller det som skrivs, också en halv kod.
 * @param {(value: string) => void} props.onChange Reglagen och knappen ger `#rrggbb`. Färgkoden ger en hel kod som `#rrggbb`, och en halv som den står.
 * @param {import("../lib/palett.js").Palett | null} [props.palett] Paletten med de andra färgerna. Med `lage` och `nyckel` visar ljusheten var
 *   färgen håller. `value` ersätter `palett[lage][nyckel]`. Utelämnad, eller något som inte är en palett (ett annat fält är halvskrivet):
 *   reglagen utan skala.
 * @param {import("../lib/palett.js").Palettlage} [props.lage]
 * @param {import("../lib/palett.js").PalettNyckel} [props.nyckel]
 * @param {boolean} [props.disabled]
 * @param {string} [props.ariaLabel] Bara när väljaren står utanför en `OpsField`.
 */
export function OpsFargval({ value, onChange, palett, lage, nyckel, disabled = false, ariaLabel }) {
  const sprak = useOpsSprak();
  const t = (/** @type {string} */ k) => ordet(ORD_OPSFARGVAL, k, sprak);
  const f = useFieldBinding();
  const id = useId();
  const [oppen, setOppen] = useState(false);
  const form = normaliseraHex(value);

  /*
   * ⛔ REGLAGENS LÄGE ÄR EGET, och följer `value` bara när färgen ändrats utifrån (koden skrevs, appen återställde). Ur en kod går
   * kulören inte alltid att läsa: grått, svart och vitt har ingen, och då hade kulörreglaget hoppat till 0 när ljusheten drogs till
   * kanten. `synkad` är koden reglagen senast gav eller läste, så att en ändring härifrån inte läses tillbaka.
   */
  const [hsl, setHsl] = useState(() => (form ? hexTillHsl(form) : { kulor: 0, mattnad: 0, ljushet: 50 }));
  const [synkad, setSynkad] = useState(form);
  if (form && form !== synkad) {
    const ny = hexTillHsl(form);
    const gra = ny.mattnad === 0;
    setHsl({ kulor: gra ? hsl.kulor : ny.kulor, mattnad: gra && (ny.ljushet <= 0 || ny.ljushet >= 100) ? hsl.mattnad : ny.mattnad, ljushet: ny.ljushet });
    setSynkad(form);
  }

  /** @param {Partial<typeof hsl>} andring */
  const satt = (andring) => {
    const ny = { ...hsl, ...andring };
    const hex = hslTillHex(ny.kulor, ny.mattnad, ny.ljushet);
    setHsl(ny);
    setSynkad(hex);
    onChange(hex);
  };

  const skalbar = Boolean(oppen && form && lage && nyckel && lasPalett(palett));
  const omfang = useMemo(
    () => (skalbar ? hallbarLjushet(/** @type {any} */ (palett), /** @type {any} */ (lage), /** @type {any} */ (nyckel), /** @type {string} */ (form), { kulor: hsl.kulor, mattnad: hsl.mattnad }) : null),
    [skalbar, palett, lage, nyckel, form, hsl.kulor, hsl.mattnad],
  );

  const procent = (/** @type {number} */ v) => Math.round(v);
  const ljushetText = fyll(t("procent"), { v: procent(hsl.ljushet) });
  const statusId = `${id}-status`;

  /** Delarna av skalan som INTE håller, ur `omfang.intervall`. */
  const utanfor = useMemo(() => {
    if (!omfang) return [];
    /** @type {{ fran: number, till: number }[]} */
    const ut = [];
    let fran = 0;
    for (const d of omfang.intervall) {
      if (d.fran > fran) ut.push({ fran, till: d.fran });
      fran = d.till;
    }
    if (fran < 100) ut.push({ fran, till: 100 });
    return ut;
  }, [omfang]);

  const spannText = omfang && omfang.intervall.length > 0
    ? fyll(t("haller"), {
        intervall: omfang.intervall.map((d) => fyll(t("spann"), { fran: procent(d.fran), till: procent(d.till) })).join(t("och")),
      })
    : null;
  const besked = omfang ? riktningsbesked(omfang)[sprak === "en" ? "en" : "sv"] : null;

  const svep = (/** @type {{ fran: number, till: number }} */ d) => ({ left: `${d.fran}%`, width: `${d.till - d.fran}%` });
  const rutfarg = form ? { backgroundColor: form } : undefined;
  const kulorSkala = useMemo(() => gradient(13, (x) => hslTillHex(x * 360, Math.max(hsl.mattnad, 50), 50)), [hsl.mattnad]);
  const mattnadSkala = useMemo(() => gradient(11, (x) => hslTillHex(hsl.kulor, x * 100, hsl.ljushet)), [hsl.kulor, hsl.ljushet]);
  const ljushetSkala = useMemo(() => gradient(21, (x) => hslTillHex(hsl.kulor, hsl.mattnad, x * 100)), [hsl.kulor, hsl.mattnad]);

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        id={f.id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={f.invalid || undefined}
        aria-describedby={f.describedBy}
        data-ops-fargval=""
        className={faltTriggerKlass({ invalid: f.invalid, filled: Boolean(form) })}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" data-fargval-ruta={form ?? ""} className="inline-block size-7 shrink-0 rounded-base border border-line" style={rutfarg} />
          <span className="truncate tabular-nums">{form ?? (value || t("ingen"))}</span>
        </span>
        <ChevronNedIkon />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          collisionPadding={8}
          aria-label={t("panel")}
          data-fargval-panel=""
          className={cx(faltYtaKlass, "w-80 max-w-[calc(100vw-1rem)] max-h-(--radix-popover-content-available-height) overflow-y-auto overscroll-contain")}
        >
          {/* ⛔ RUTAN RULLAR OCH INNEHÅLLET I EN EGEN KOLUMN: i en flexkolumn med begränsad höjd krymper ett element utan innehåll (den
              stora färgrutan) till noll när rutan inte får plats, mätt i montaget på 390 px. */}
          <div className="flex flex-col gap-3 p-4">
            <span aria-hidden="true" data-fargval-stor={form ?? ""} className="block h-12 rounded-base border border-line" style={rutfarg} />

            <Fargreglage
              id={`${id}-kulor`}
              falt="kulor"
              etikett={t("kulor")}
              varde={hsl.kulor}
              max={359}
              text={fyll(t("grader"), { v: Math.round(hsl.kulor) })}
              onChange={(v) => satt({ kulor: v })}
              skala={kulorSkala}
            />
            <Fargreglage
              id={`${id}-mattnad`}
              falt="mattnad"
              etikett={t("mattnad")}
              varde={hsl.mattnad}
              max={100}
              text={fyll(t("procent"), { v: procent(hsl.mattnad) })}
              onChange={(v) => satt({ mattnad: v })}
              skala={mattnadSkala}
            />
            <Fargreglage
              id={`${id}-ljushet`}
              falt="ljushet"
              etikett={t("ljushet")}
              varde={hsl.ljushet}
              max={100}
              text={ljushetText}
              onChange={(v) => satt({ ljushet: v })}
              skala={ljushetSkala}
              beskrivs={omfang ? statusId : undefined}
            >
              {/* ⛔ Det som inte håller tonas ned, det som håller ramas in. Båda behövs: en nedtoning ensam går inte att se på en skala
                  som redan är mörk i ena änden. */}
              {utanfor.map((d) => (
                <span key={`u${d.fran}`} data-skala-haller-inte="" className="absolute inset-y-0 bg-canvas/75" style={svep(d)} />
              ))}
              {omfang?.intervall.map((d) => (
                <span key={`h${d.fran}`} data-skala-haller="" className="absolute -inset-y-1 rounded-base border-2 border-ink" style={svep(d)} />
              ))}
            </Fargreglage>

            {omfang ? (
              <div id={statusId} data-fargval-status={omfang.haller ? "haller" : omfang.riktning ?? "ingen"} className="flex flex-col gap-1">
                <p className="m-0 text-etikett text-ink" aria-live="polite">{besked}</p>
                <p className="m-0 text-hjalp text-ink-secondary">
                  {spannText ? `${spannText} ` : ""}
                  {fyll(t("star"), { v: procent(omfang.ljushet) })}
                </p>
              </div>
            ) : null}
            {omfang && !omfang.haller && omfang.narmaste ? (
              <button
                type="button"
                data-fargval-narmaste={omfang.narmaste}
                onClick={() => {
                  const hex = /** @type {string} */ (omfang.narmaste);
                  setHsl({ ...hsl, ljushet: /** @type {number} */ (omfang.narmasteLjushet) });
                  setSynkad(hex);
                  onChange(hex);
                }}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-base border border-line-strong bg-raised px-3 text-etikett font-medium text-ink hover:border-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                {t("narmaste")}
              </button>
            ) : null}

            <OpsField label={t("fargkod")} hint={t("fargkodHint")} error={value && !HEL_KOD.test(value) ? t("felForm") : undefined}>
              {/* ⛔ Inget tal: en färgkod sägs inte in. */}
              <OpsInput value={value} onChange={(text) => onChange(skrivenKod(text))} placeholder="#8e7a4e" autoComplete="off" maxLength={12} tal={false} />
            </OpsField>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
