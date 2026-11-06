import { useEffect, useState } from "react";
import { lasAppmanifest } from "../data/appmanifest.js";
import { gastHemskarmTips } from "../lib/gastHemskarm.js";
import { forvalda } from "../lib/ord.js";
import { OpsDisclosure } from "./OpsDisclosure.jsx";

/** @type {import("../lib/ord.js").Ordbok} */
const ORD = {
  hemskarm: { sv: "Lägg till på hemskärmen", en: "Add to Home Screen" },
};

/**
 * Frivillig hjälp på gästens översikt. Stängd från början, aldrig en dialog, och borta när sidan redan körs från hemskärmen.
 * `miljo` finns för proven. Utan den läses webbläsaren, och manifestet hämtas innan något sägs om app-läge.
 *
 * @param {{ sprak?: string, miljo?: Parameters<typeof gastHemskarmTips>[0] }} props
 */
export function GastHemskarm({ sprak = "sv", miljo }) {
  const t = forvalda(ORD, sprak);
  const [last, setLast] = useState(/** @type {Parameters<typeof gastHemskarmTips>[0] | null} */ (miljo ?? null));

  useEffect(() => {
    if (miljo) {
      setLast(miljo);
      return undefined;
    }
    if (typeof window === "undefined" || typeof navigator === "undefined") return undefined;
    let levande = true;
    const standalone = (() => {
      try {
        if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;
        if (/** @type {{ standalone?: boolean }} */ (navigator).standalone === true) return true;
      } catch {
        /* Utan mätning säger vi inte att sidan redan är installerad. */
      }
      return false;
    })();
    const bas = {
      userAgent: navigator.userAgent,
      pek: typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1,
      standalone,
      iosWebbapp: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute("content") === "yes",
      sokvag: window.location?.pathname || "/",
      sprak,
      manifest: /** @type {{ display?: string, start_url?: string } | null} */ (null),
    };
    setLast(bas);
    if (standalone) return undefined;
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute("href");
    if (!href) return undefined;
    const kontroll = new AbortController();
    lasAppmanifest(href, { signal: kontroll.signal })
      .then((manifest) => {
        if (!levande || !manifest) return;
        setLast({ ...bas, manifest });
      })
      .catch(() => {
        /* Utan manifest lovar vi inget app-läge. iOS-stegen behöver det inte. */
      });
    return () => {
      levande = false;
      kontroll.abort();
    };
  }, [miljo, sprak]);

  const tips = last ? gastHemskarmTips({ ...last, sprak }) : null;
  if (!tips) return null;
  return (
    <div data-gast-hemskarm={tips.plattform} data-lovar-applage={tips.lovarApplage ? "ja" : "nej"}>
      <OpsDisclosure summary={t.hemskarm}>
        <p className="m-0 max-w-prose pt-2 text-meta text-ink-secondary">{tips.text}</p>
      </OpsDisclosure>
    </div>
  );
}
