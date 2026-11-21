import { useEffect, useState } from "react";

/** Hur många prickar fältet ritar. */
export const TALK_PRICKAR = 10;

/**
 * Om personen bett om mindre rörelse (`prefers-reduced-motion: reduce`). Läses vid montering och följer ändringen medan sidan är öppen.
 * `matchMedia` saknas i en del miljöer (och i jsdom): då är svaret "nej", som för alla andra komponenter i ramverket.
 */
function useReduceradRorelse() {
  const fraga = "(prefers-reduced-motion: reduce)";
  const las = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && Boolean(window.matchMedia(fraga)?.matches);
  const [reducerad, setReducerad] = useState(las);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(fraga);
    if (!mq) return undefined;
    const ny = () => setReducerad(Boolean(mq.matches));
    ny();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", ny);
      return () => mq.removeEventListener("change", ny);
    }
    // Safari före 14.
    if (typeof mq.addListener === "function") {
      mq.addListener(ny);
      return () => mq.removeListener(ny);
    }
    return undefined;
  }, []);
  return reducerad;
}

/**
 * TALK:s nivåprickar. Samma tio prickar i fältet och i bibliotekets inspelning, så de två inte kan glida isär.
 *
 * ⛔ `niva` KAN KOMMA FRÅN TVÅ HÅLL (0.115.0, cllp/lifehub.app#345): inspelaren, eller igenkänningens egna händelser när bara den kör
 * (`useTalk`). Prickarna vet inte vilket, och ritar likadant.
 *
 * ⛔ PREFERS-REDUCED-MOTION (0.115.0). Med mindre rörelse flyttar sig inga prickar och ingen ändrar höjd: raden står stilla och blir
 * ljusare när det pratas. Det gäller också när inspelaren matar prickarna, eftersom det är samma komponent.
 *
 * @param {{ niva: () => number, lyssnar: boolean, skickar?: boolean }} props
 */
export function TalkPrickar({ niva, lyssnar, skickar = false }) {
  const [nivaer, setNivaer] = useState(() => Array.from({ length: TALK_PRICKAR }, () => 0));
  const reducerad = useReduceradRorelse();

  useEffect(() => {
    if (!lyssnar || typeof requestAnimationFrame !== "function") return undefined;
    let id = 0;
    let senast = 0;
    const steg = (/** @type {number} */ t) => {
      if (t - senast > 80) {
        senast = t;
        const n = niva();
        setNivaer((f) => [...f.slice(1), n]);
      }
      id = requestAnimationFrame(steg);
    };
    id = requestAnimationFrame(steg);
    return () => cancelAnimationFrame(id);
  }, [lyssnar, niva]);

  // Med reducerad rörelse är det den senaste nivån som gäller för hela raden.
  const nuNiva = nivaer[nivaer.length - 1] ?? 0;
  return (
    <span aria-hidden="true" data-talk-prickar="" className="flex min-w-0 w-full flex-1 items-center justify-between gap-1 overflow-hidden px-1">
      {nivaer.map((n, i) => {
        const hojd = reducerad ? 0 : n;
        const ljus = reducerad ? nuNiva : n;
        return (
          <span
            key={i}
            className="block w-1.5 shrink-0 rounded-full bg-accent transition-[height,opacity] duration-75 motion-reduce:transition-none"
            style={{ height: `${6 + Math.round(14 * hojd)}px`, opacity: skickar ? 0.35 : 0.35 + 0.65 * ljus }}
          />
        );
      })}
    </span>
  );
}

