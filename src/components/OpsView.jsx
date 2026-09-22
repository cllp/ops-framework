import { cx } from "../lib/cx.js";
import { OpsHjalp } from "./OpsHjalp.jsx";

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
 */

const BREDDER = {
  narrow: "max-w-2xl",
  normal: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

/**
 * @param {object} props
 * @param {"narrow"|"normal"|"wide"|"full"} [props.width]
 * @param {import("react").ReactNode} props.children
 */
export function OpsView({ width = "normal", children }) {
  const breddKlass = BREDDER[width];
  if (!breddKlass) {
    throw new Error(`OpsView: okänd width "${width}". Giltiga: ${Object.keys(BREDDER).join(", ")}.`);
  }
  return (
    <div
      className={cx(
        "mx-auto w-full px-4 pt-6",
        // Minst 16 px sidomarginal vid varje bredd, och säker yta i botten.
        "pb-[calc(--spacing(6)+var(--safe-bottom))]",
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
      {children}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {import("react").ReactNode} [props.actions] Knappar till höger om rubriken.
 */
export function OpsViewHeader({ title, description, actions }) {
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

        ⛔ `OpsHjalp` RITAR RUBRIKEN SJÄLV, även när ingen beskrivning finns. Den
        vägen har vyn ETT utseende och inte två som ska hållas lika: ligger
        rubriken kvar här för det ena fallet driver de isär första gången någon
        rör typografin.
      */}
      <OpsHjalp
        rubrik={<h1 className="m-0 font-display text-xl font-bold leading-tight tracking-tight text-ink">{title}</h1>}
      >
        {description}
      </OpsHjalp>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
