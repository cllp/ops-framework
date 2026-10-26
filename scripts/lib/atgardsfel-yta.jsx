import { createRoot } from "react-dom/client";
import * as Ops from "OPS_DIST";

/**
 * Ytan för montagen av knappradens felplats (0.147.0, cllp/ops-framework#451): Idag med en påminnelse vars Klar avslås, som när appen inte når servern.
 * Allt är syntetiskt. `window.__atgardsfel` är avslagets text ("" ritar ett avslag utan text).
 */

const HANDELSER = [{ id: "paminnelse:attest", title: "Attest större leverantörsfakturor", daysLeft: 3, when: "Om 3 dagar", deadline: "Senast 28 okt", kind: "Påminnelse" }];

const RADKALLOR = {
  paminnelse: {
    etikett: "Påminnelse",
    atgarder: () => [
      { id: "klar", etikett: "Klar", pagarEtikett: "Bockar av…", onClick: () => new Promise((_, avslag) => setTimeout(() => avslag(new Error(window.__atgardsfel || undefined)), 600)) },
      { id: "rutin", etikett: "Öppna rutinen", href: "#rutin" },
    ],
    dela: () => ({ skal: "Påminnelser delas inte ännu.", istallet: "Skriv en händelse om andra ska se den." }),
  },
};

createRoot(document.getElementById("root")).render(
  <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-3 py-3">
    <Ops.OpsEventList events={HANDELSER} radkallor={RADKALLOR} ariaLabel="Idag" />
  </main>,
);
