import { Suspense, lazy, useState } from "react";
import { LatGrans } from "./LatGrans.jsx";
import { OpsField, OpsTextarea } from "./OpsField.jsx";
import { ordet } from "../lib/ord.js";
import { OpsVantar } from "./OpsVantar.jsx";

/**
 * Anteckningens textruta med "Lägg till bild", inläst när den behövs (0.207.0, cllp/lifehub.app#696).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * 0.206.0 importerade `BibliotekAnteckningsbild` statiskt i `OpsBibliotek`, och knappen, inklistringen och krympningen låg då i varje apps
 * startfil, för en ruta som ritas först när en sparad anteckning redigeras och bara när appen gett `onLaggBildIAnteckning`. Samma väg som
 * `BibliotekKommentarerLat` (0.191.0): paketet skriver en fil per källmodul, och appens bundler gör den dynamiska importen till en egen bit.
 * `check:delbarhet` mäter att `AnteckningsText` och `forbered` inte ligger i startfilen.
 *
 * ══ ⛔ UTAN `onLaggBild` HÄMTAS INGENTING ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Utan appens uppladdning är rutan bara en textruta, och den ritas direkt (`AnteckningsRuta`). Ingen bit hämtas och ingenting byts ut under
 * den som skriver. Samma ruta är också den lata modulens yttre del, så de två ser aldrig olika ut (regel 2).
 *
 * ══ ⛔ VÄNTAN SOM INTE FLYTTAR NÅGOT, OCH SOM INTE SLÄPPER IGENOM EN BILD ═════════════════════════════════════════════════════════
 *
 * 1. FÖRLADDNING. `OpsBibliotek` anropar `forladdaAnteckningsbild` när webbläsaren har tid över, om appen gett `onLaggBildIAnteckning`. Biten
 *    finns då oftast redan när någon trycker på Redigera, och då ritas rutan direkt, utan väntan och utan att textrutan byts (se `hamtad`).
 * 2. MEDAN BITEN HÄMTAS ritas samma textruta, utan knappen, så att fältet står där det ska och går att skriva i. Knappen kommer under rutan när
 *    biten är hämtad.
 * 3. ⛔ EN BILD SOM KLISTRAS IN UNDER TIDEN tas av rutan ändå, med `preventDefault()` och `stopPropagation()`, och raden säger att den ska
 *    klistras in igen. Annars hade appens egen inklistring gjort en bildpost av den, just den post planen säger att bilden aldrig ska vara.
 *
 * ⛔ ETT FEL VID HÄMTNINGEN TYSTAS INTE. Går biten inte att hämta (nätet föll, eller en ny version har lagts ut) står textrutan kvar, så att
 * texten går att skriva och spara, och `LatGrans` ritar en mening med `role="alert"` under den. Ett nytt försök kräver att sidan laddas om.
 */
/**
 * ⛔ DEN HÄMTADE MODULEN SPARAS HÄR (0.207.0). `lazy` väntar en ritning också när biten redan är hämtad (dess eget löfte är inte uppslaget förrän första gången den ritas), och textrutan
 * byttes då ut under den som just tryckt på Redigera: väntans ruta och sedan modulens, två olika noder, och fokus tappades. När förladdningen är klar ritas komponenten därför direkt,
 * utan `lazy` och `Suspense`, och textrutan är samma nod hela tiden. `lazy` är kvar för den som hinner trycka på Redigera innan biten är hämtad.
 * @type {null | typeof import("./BibliotekAnteckningsbild.jsx").AnteckningsText}
 */
let hamtad = null;
const laddaAnteckningsbild = () =>
  import("./BibliotekAnteckningsbild.jsx").then((m) => {
    hamtad = m.AnteckningsText;
    return m;
  });
const Text = lazy(() => laddaAnteckningsbild().then((m) => ({ default: m.AnteckningsText })));

/**
 * Orden som rutan behöver innan sin modul är hämtad. Resten står i `BibliotekAnteckningsbild.jsx`, som hämtas med modulen.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_ANTECKNINGSRUTA = {
  text: { sv: "Text", en: "Text" },
  hamtar: { sv: "Bildverktyget hämtas. Klistra in bilden igen om en stund.", en: "The image tool is loading. Paste the image again in a moment." },
  lasfel: { sv: "Bildverktyget gick inte att läsa in. Texten går att skriva och spara. Ladda om sidan för att lägga till bilder.", en: "The image tool could not be loaded. The text can be written and saved. Reload the page to add images." },
};

/**
 * Hämtar modulen i bakgrunden när webbläsaren har tid över. En andra hämtning kostar ingenting.
 *
 * @returns {() => void} Avbryter väntan om biblioteket avmonteras innan webbläsaren fått tid över.
 */
export function forladdaAnteckningsbild() {
  /** @type {any} */
  const f = typeof window === "undefined" ? null : window;
  if (!f) return () => {};
  const start = () => {
    laddaAnteckningsbild().catch(() => {});
  };
  if (typeof f.requestIdleCallback === "function") {
    const id = f.requestIdleCallback(start, { timeout: 4000 });
    return () => f.cancelIdleCallback?.(id);
  }
  const id = f.setTimeout(start, 1500);
  return () => f.clearTimeout(id);
}

/**
 * Textrutan och det som står under den. Både den lata modulen och väntan ritar den här, så att rutan har ett utseende.
 *
 * @param {{ text: string, setText: (text: string) => void, sprak: string, rutaRef?: import("react").Ref<HTMLDivElement>, onPaste?: (e: import("react").ClipboardEvent) => void, children?: import("react").ReactNode }} props
 */
export function AnteckningsRuta({ text, setText, sprak, rutaRef, onPaste, children = null }) {
  const etikett = ordet(ORD_ANTECKNINGSRUTA, "text", sprak);
  return (
    <OpsField label={etikett}>
      <div ref={rutaRef} className="flex min-w-0 flex-col gap-2" onPaste={onPaste}>
        <OpsTextarea value={text} onChange={setText} ariaLabel={etikett} rows={8} />
        {children}
      </div>
    </OpsField>
  );
}

/** Är det en inklistring med en bild och ingen text? Samma regel som den lata modulens: text i urklippet är text. @param {import("react").ClipboardEvent} e */
function arBildinklistring(e) {
  const data = e.clipboardData;
  const filer = Array.from(data?.files ?? []);
  if (!filer.some((f) => (typeof f.type === "string" && f.type.startsWith("image/")) || /\.(heic|heif)$/i.test(f.name ?? ""))) return false;
  let text = "";
  try {
    text = data?.getData("text/plain") ?? "";
  } catch {
    text = "";
  }
  return !text.trim();
}

/**
 * Rutan medan modulen hämtas, eller när den inte gick att hämta (`fel`). En bild som klistras in stannar här, med en rad om varför.
 *
 * @param {{ text: string, setText: (text: string) => void, sprak: string, fel?: boolean }} props
 */
function Reservruta({ text, setText, sprak, fel = false }) {
  const [klistrad, setKlistrad] = useState(false);
  return (
    <AnteckningsRuta
      text={text}
      setText={setText}
      sprak={sprak}
      onPaste={(e) => {
        if (!arBildinklistring(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setKlistrad(true);
      }}
    >
      {fel ? <p role="alert" data-anteckningsbild="lasfel" className="m-0 text-etikett text-danger wrap-anywhere">{ordet(ORD_ANTECKNINGSRUTA, "lasfel", sprak)}</p> : null}
      {klistrad && !fel ? <div data-anteckningsbild="hamtar" className="m-0 text-meta text-ink-secondary"><OpsVantar storlek="sm" text={ordet(ORD_ANTECKNINGSRUTA, "hamtar", sprak)} /></div> : null}
    </AnteckningsRuta>
  );
}

/**
 * @param {import("react").ComponentProps<typeof import("./BibliotekAnteckningsbild.jsx").AnteckningsText>} props Samma props som `AnteckningsText`.
 */
export function AnteckningsTextLat(props) {
  // ⛔ Valet görs EN gång, när rutan monteras: att byta från den lata komponenten till den hämtade mitt i en redigering hade varit ett nytt komponentslag, och React hade bytt ut textrutan.
  const [direkt] = useState(() => hamtad);
  if (typeof props.onLaggBild !== "function") return <AnteckningsRuta text={props.text} setText={props.setText} sprak={props.sprak} />;
  if (direkt) {
    const Hamtad = direkt;
    return <Hamtad {...props} />;
  }
  return (
    <LatGrans fel={<Reservruta text={props.text} setText={props.setText} sprak={props.sprak} fel />}>
      <Suspense fallback={<Reservruta text={props.text} setText={props.setText} sprak={props.sprak} />}>
        <Text {...props} />
      </Suspense>
    </LatGrans>
  );
}
