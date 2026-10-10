import { cx } from "../lib/cx.js";
import { OpsHelp } from "./OpsHelp.jsx";
import { OpsHubTillbaka, SIDRUBRIK_KLASS } from "./OpsTillbaka.jsx";

/**
 * Vyskalet. Varje sida i en ops-app ligger i en av dessa.
 *
 * ⛔ Botten-paddingen räknar in `--safe-bottom`. Utan den hamnar den sista
 * raden i en lista under hemknappsstapeln på en telefon, och det syns bara på
 * riktig hårdvara. Att sidan ser rätt ut i en desktop-webbläsare bevisar
 * ingenting om detta.
 *
 * ⛔ Bredden är en av tre, inte fri. "Lite bredare på den här sidan" upprepat
 * tio gånger är exakt hur en produkt slutar kännas som en produkt.
 *
 * ⛔ `normal` ÄR `--ops-innehall-max` (0.91.2). Identity och andra ytor som
 * delar Hubbar/Profil/Inställningar ska använda `OpsSidoyta` eller samma token,
 * aldrig en lokal `max-width` per sida (lifehub.app#150).
 */

const BREDDER = {
  narrow: "max-w-2xl",
  /*
   * ⛔ `normal` ÄR TOKENEN `--ops-innehall-max` / `max-w-innehall` (0.91.2, lifehub.app#150).
   * Förr `max-w-5xl` (samma 64 rem). Tokenen finns så shell i HTML och OpsView delar
   * EN bredd, och ingen sida sätter egen max-width.
   */
  normal: "max-w-innehall",
  wide: "max-w-7xl",
  full: "max-w-none",
};

/**
 * @param {object} props
 * @param {"narrow"|"normal"|"wide"|"full"} [props.width]
 * @param {import("react").ComponentProps<typeof OpsHubTillbaka>} [props.tillbaka] (0.31.0; 0.31.2: textlänk med chevron, SS-formen) Tillbaka-raden "‹ Tillbaka" överst i vyn,
 *   samma komponent som `OpsHubModul` (`OpsHubTillbaka`). ⛔ Varje sida under Hub bär den: ge den här propen i stället för att rita raden själv.
 * @param {import("react").ReactNode} props.children
 */
export function OpsView({ width = "normal", tillbaka, children }) {
  const breddKlass = BREDDER[width];
  if (!breddKlass) {
    throw new Error(`OpsView: okänd width "${width}". Giltiga: ${Object.keys(BREDDER).join(", ")}.`);
  }
  return (
    <div
      className={cx(
        "mx-auto w-full px-4 pt-6",
        // Minst 16 px sidomarginal vid varje bredd. ⛔ 0.31.2: den säkra ytan i botten räknas här BARA från `md` (iPad). Under `md` äger
        // skalets `main` den (`pb` = bottenradens höjd + `--safe-bottom`), och räknades den också här stod sista kortet 34 px för högt
        // över bottenraden på en telefon med hemindikator (emulerat i check-skalyta avsnitt 21: 57 px tomt mot 24).
        "pb-6 md:pb-[calc(--spacing(6)+var(--safe-bottom))]",
        // ⛔ VYN GER SINA BARN VERTIKAL RYTM. Utan den här raden lägger sig två
        // kort kant mot kant och bildar en dubbel linje: de ser ihopsvetsade ut.
        //
        // Det rapporterades två gånger från två olika sidor, vilket är beviset
        // på att det inte var vyernas fel. De flesta vyer råkade slippa det för
        // att de lindade in innehållet i en egen `flex flex-col gap-*`; de som
        // inte gjorde det fick defekten. En app ska inte behöva MINNAS rytm,
        // lika lite som den ska sätta sin egen radie.
        "flex flex-col gap-4",
        breddKlass,
      )}
    >
      {tillbaka ? <OpsHubTillbaka {...tillbaka} /> : null}
      {children}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {import("react").ReactNode} [props.actions] Knappar till höger om rubriken.
 * @param {string} [props.hjalpHref] (0.92.1) När satt öppnar frågetecknet hjälpsidan (djuplänk) i stället för hopfällningen.
 * @param {(href: string, event: any) => void} [props.onNavigate]
 */
export function OpsViewHeader({ title, description, actions, hjalpHref, onNavigate }) {
  return (
    // `flex-wrap` är inte kosmetik: utan den trycks knapparna ut ur skärmen på
    // telefon och blir onåbara. Raden bryter i stället för att svämma över.
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      {/*
        ⛔ BESKRIVNINGEN LIGGER BAKOM ETT FRÅGETECKEN sedan 2026-09-22. CP: "Låt
        texter komma fram med hjälp av att man trycker på ett frågetecken, så
        blir appen lite renare."

        ⛔ ALLA VYER PÅ EN GÅNG, OCH DET ÄR HELA POÄNGEN MED ATT GÖRA DET HÄR.
        Arton vyer i bolag-ops skickar in `description`. Hade varje vy fått bygga
        sitt eget frågetecken hade vi fått arton varianter av samma gest, och
        skillnaderna hade upptäckts när någon jämförde två sidor.

        ⛔ `OpsHelp` RITAR RUBRIKEN SJÄLV, även när ingen beskrivning finns. Den
        vägen har vyn ETT utseende och inte två som ska hållas lika: ligger
        rubriken kvar här för det ena fallet driver de isär första gången någon
        rör typografin.

        ⛔ 0.92.1: `hjalpHref` gör tecknet till en länk till hjälpsidan. Samma
        gest som i modulramen, när vyn hör till en app med `hjalp`.
      */}
      <OpsHelp
        title={<h1 className={SIDRUBRIK_KLASS}>{title}</h1>}
        href={hjalpHref}
        onNavigate={onNavigate}
        label={hjalpHref ? "Öppna hjälpen" : "Visa förklaring"}
      >
        {description}
      </OpsHelp>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
