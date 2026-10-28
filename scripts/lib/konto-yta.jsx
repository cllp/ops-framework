/**
 * Provsidan för kontot i den publika toppraden (0.150.0, #352). INTE en app och exporteras inte: `konto-matt` ritar den med RIKTIG
 * CSS i Chromium. Scenariot väljs med `window.__prov` (satt före sidan laddas):
 *
 *   { konto: "ingen" | "avatar" | "bred" }
 *
 * `avatar` är en rund knapp på 44 px (träffytan en app ritar för kontot). `bred` är BEVIS-läget: en avatar och en text på 240 px,
 * alltså ett konto som inte får plats under `md`, så att provet "raden trycks inte ut" kan ses falla.
 */
import { createRoot } from "react-dom/client";
import * as Ops from "OPS_DIST";

const { OpsPublikHuvud } = Ops;

const LOGGA = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="32" viewBox="0 0 160 32"><rect width="160" height="32" rx="6" fill="#1f6f6b"/></svg>')}`;

function Sida() {
  const { konto } = window.__prov;
  const avatar = (
    <button type="button" aria-label="Konto: Anna Ek" className="inline-flex size-11 items-center justify-center rounded-full bg-accent text-on-accent">
      AE
    </button>
  );
  return (
    <OpsPublikHuvud
      logga={{ src: LOGGA, alt: "Exempelhubben" }}
      lankar={[
        { href: "/funktioner", label: "Funktioner" },
        { href: "/sa-funkar-det", label: "Så funkar det" },
      ]}
      sprak={{ aktiv: "sv", val: [{ kod: "sv", label: "SV" }, { kod: "en", label: "EN" }], onVal: () => {}, etikett: "Språk" }}
      loggaIn={{ href: "/app", label: "Logga in" }}
      kom={{ href: "/app", label: "Kom igång" }}
      konto={
        konto === "ingen" ? undefined : konto === "bred" ? (
          <div className="flex items-center gap-2">
            {avatar}
            <span className="inline-block w-60 shrink-0 truncate text-etikett">Anna Ek, Claes Philip Staiger AB</span>
          </div>
        ) : (
          avatar
        )
      }
      texter={{ huvudnavigering: "Huvudnavigering", oppnaMeny: "Öppna meny", stangMeny: "Stäng meny", mobilmeny: "Mobilmeny" }}
    />
  );
}

createRoot(/** @type {HTMLElement} */ (document.getElementById("root"))).render(<Sida />);
requestAnimationFrame(() => {
  window.__redo = true;
});
