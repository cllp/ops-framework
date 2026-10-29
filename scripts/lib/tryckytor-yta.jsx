import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import * as Ops from "OPS_DIST";

/**
 * Ytan för mätningen av tryckytor och överlapp på listrader (0.153.0, cllp/ops-framework#460 punkt 1 och 2): `OpsEventList` i de fyra former en rad har (med och utan pillrad,
 * med och utan datumrad, med ärendenummer som länk och utfällning), `OpsButton` i storlek `sm`, en kommentar med en filbilaga och en toast med åtgärd. Allt är syntetiskt.
 * Raderna är de som lifehub.app:s Idag ritar: titeln som en knapp (en rad med en källa i manifestet), ärendenumret `#1` som länk och chevronen för detaljerna.
 */

const DETALJER = <p className="m-0">Belopp 12 400 kr inklusive moms.</p>;

const HANDELSER = [
  // Pillrad, datumrad med ärendenummer, utfällning, titeln som en knapp (källan `arende`).
  { id: "arende:1", title: "Attest större leverantörsfakturor", status: "oppet", role: "Du", kind: "Ärende", when: "Om 3 dagar", deadline: "Senast 28 okt", url: "https://github.com/x/y/issues/1", urlLabel: "#1", daysLeft: 3, details: DETALJER },
  // Ingen pillrad: datumrad med ärendenummer och en lång titel som går in under chevronen.
  { id: "arende:2", title: "Kundfaktura 114 till Visby Kakel som förfaller i slutet av månaden och som någon måste granska", when: "Om 5 dagar", url: "https://github.com/x/y/issues/2", urlLabel: "#2", daysLeft: 5, details: DETALJER },
  // Varken pillrad eller datumrad: bara titel och utfällning.
  { id: "arende:3", title: "Rad utan datum", daysLeft: 9, details: DETALJER },
  // En händelse: titeln är en länk (`HandelseLank`), med datum, ärendenummer och utfällning.
  { id: "h-4", handelseId: "h4", title: "Styrelsemöte", status: "pagar", kind: "Händelse", when: "Idag", url: "https://github.com/x/y/issues/4", urlLabel: "#4", daysLeft: 0, details: DETALJER },
  // En rad utan utfällning: ingen chevron.
  { id: "arende:5", title: "Rad utan detaljer", kind: "Ärende", when: "Om 2 dagar", url: "https://github.com/x/y/issues/5", urlLabel: "#5", daysLeft: 2 },
];

const RADKALLOR = { arende: { etikett: "Ärende", atgarder: () => [], dela: () => ({ skal: "Delas inte ännu.", istallet: "Skriv en händelse." }) } };
const STATUSORD = { oppet: "Öppet", pagar: "Pågår", vantar: "Väntar", klart: "Klart", akut: "Akut" };

const DATAURL = "data:application/pdf;base64,AAAA";
const KOMMENTARER = [
  { id: "k2", text: "Klart, tack.", skapad: "2026-10-28T10:00:00.000Z", skapadAv: { uid: "anna", namn: "Anna Ek", typ: "manniska", kalla: "prov" } },
  { id: "k1", text: "Se bilagan.", skapad: "2026-10-28T09:00:00.000Z", skapadAv: { uid: "bo", namn: "Bo Lind", typ: "manniska", kalla: "prov" }, bilaga: { typ: "application/pdf", namn: "avtal.pdf", dataUrl: DATAURL, tecken: DATAURL.length } },
];

function Toastknapp() {
  const { show } = Ops.useOpsToast();
  useEffect(() => {
    show({ title: "Händelsen är borttagen", tone: "success", atgard: { etikett: "Ångra", onKlick: () => {} } });
    window.__redo = true;
  }, [show]);
  return null;
}

function Yta() {
  return (
    <Ops.OpsToastProvider>
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-3 py-3">
        <section data-yta="lista">
          <Ops.OpsEventList events={HANDELSER} radkallor={RADKALLOR} statusWords={STATUSORD} onOppnaHandelse={() => {}} ariaLabel="Idag" />
        </section>
        <section data-yta="knappar" className="flex flex-wrap items-center gap-2">
          <Ops.OpsButton size="sm" variant="primary">Spara</Ops.OpsButton>
          <Ops.OpsButton size="sm" variant="secondary">Avbryt</Ops.OpsButton>
          <Ops.OpsButton size="sm" variant="ghost">Ta bort</Ops.OpsButton>
          <Ops.OpsButton size="sm" variant="danger">Radera</Ops.OpsButton>
          <Ops.OpsButton size="sm" variant="ghost" iconOnly ariaLabel="Mer">+</Ops.OpsButton>
          <Ops.OpsButton size="md" variant="secondary">Vanlig</Ops.OpsButton>
        </section>
        <section data-yta="kommentarer">
          <Ops.OpsKommentarer kommentarer={KOMMENTARER} uid="anna" onSkriv={() => {}} onTaBort={() => {}} />
        </section>
        <Toastknapp />
      </main>
    </Ops.OpsToastProvider>
  );
}

createRoot(document.getElementById("root")).render(<Yta />);
