import { useState } from "react";
import {
  OpsBanner,
  OpsButton,
  OpsCard,
  OpsField,
  OpsIdentity,
  OpsInput,
  OpsList,
  OpsListRow,
  OpsModal,
  OpsPill,
  OpsProvenance,
  OpsSelect,
  OpsStat,
  OpsTable,
  OpsTabPanel,
  OpsTabs,
  OpsTag,
  OpsTextarea,
  OpsCheckbox,
  OpsEmpty,
  OpsSwitch,
  formatCurrency,
  formatDate,
  OpsView,
  OpsViewHeader,
} from "@staiger/ops-framework";

/**
 * Levande katalog över primitiverna.
 *
 * ⛔ Den här vyn är inte pynt och ska inte tas bort ur mallen.
 *
 * Den är det enda stället där utseendet går att se i båda temalägena utan att
 * bygga en riktig funktion först. Vakterna kan bevisa att CSS genereras och att
 * API:et är stängt; ingen av dem kan se att något ser fel ut. Ett ramverk utan
 * en sida där man ser delarna leder till att varje ny vy uppfinner sitt eget
 * utseende, eftersom det är enklare än att leta.
 *
 * Behåll den, och lägg till en rad här varje gång ramverket får en ny primitiv.
 */

const AVDELNINGAR = [
  { value: "ekonomi", label: "Ekonomi" },
  { value: "juridik", label: "Juridik" },
  { value: "drift", label: "Drift", disabled: true },
];

function Ruta({ rubrik, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-md font-bold text-ink">{rubrik}</h2>
      <OpsCard>
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      </OpsCard>
    </section>
  );
}

export function PrimitivesView() {
  const [text, setText] = useState("");
  const [avdelning, setAvdelning] = useState("");
  const [oppen, setOppen] = useState(false);
  const [flik, setFlik] = useState("utfall");
  const [kryss, setKryss] = useState(true);
  const [reglage, setReglage] = useState(false);

  return (
    <OpsView>
      <OpsViewHeader title="Primitiver" description="Allt ramverket levererar, i en vy. Växla tema uppe till höger för att se båda lägena." />

      <Ruta rubrik="Knappar">
        <OpsButton variant="primary">Primär</OpsButton>
        <OpsButton>Sekundär</OpsButton>
        <OpsButton variant="ghost">Diskret</OpsButton>
        <OpsButton variant="danger">Ta bort</OpsButton>
        <OpsButton size="sm">Liten</OpsButton>
        <OpsButton busy>Sparar</OpsButton>
        <OpsButton disabled>Spärrad</OpsButton>
      </Ruta>

      <Ruta rubrik="Piller">
        <OpsPill>Neutral</OpsPill>
        <OpsPill tone="success">Klar</OpsPill>
        <OpsPill tone="warning">Väntar svar</OpsPill>
        <OpsPill tone="danger">Försenad</OpsPill>
        <OpsPill tone="info">Utkast</OpsPill>
      </Ruta>

      <Ruta rubrik="Identitet">
        {["grp_ekonomi", "grp_juridik", "grp_drift", "grp_styrelse", "grp_it", "grp_hr"].map((seed, i) => (
          <OpsIdentity key={seed} name={`Avdelning ${i + 1}`} seed={seed} />
        ))}
        <OpsIdentity name="Med bild" seed="grp_bild" imageUrl="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" />
      </Ruta>

      <section className="mb-8">
        <h2 className="mb-3 text-md font-bold text-ink">Fält</h2>
        <OpsCard>
          <div className="grid gap-4 md:grid-cols-2">
            <OpsField label="Ärendets namn" hint="Syns i listan och i sökningen">
              <OpsInput value={text} onChange={setText} placeholder="Kvartalsrapport Q3" />
            </OpsField>
            <OpsField label="Avdelning" required>
              <OpsSelect options={AVDELNINGAR} value={avdelning} onChange={setAvdelning} placeholder="Välj avdelning" />
            </OpsField>
            <OpsField label="E-post" error="Adressen saknar snabel-a">
              <OpsInput type="email" value="anna.exempel" onChange={() => {}} />
            </OpsField>
            <OpsField label="Anteckning">
              <OpsTextarea value="" onChange={() => {}} rows={3} />
            </OpsField>
          </div>
        </OpsCard>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-md font-bold text-ink">Lista</h2>
        <OpsCard flush>
          <OpsList ariaLabel="Exempellista">
            <OpsListRow interactive onClick={() => {}}>
              <span className="flex-1 text-base text-ink">Klickbar rad</span>
              <OpsPill tone="success">Klar</OpsPill>
            </OpsListRow>
            <OpsListRow interactive selected onClick={() => {}}>
              <span className="flex-1 text-base text-ink">Vald rad</span>
            </OpsListRow>
            <OpsListRow>
              <span className="flex-1 text-base text-ink-secondary">
                Rad utan åtgärd, med en avsiktligt lång text som visar att höjden kommer ur innehållet och inte ur ett fast pixelvärde
              </span>
            </OpsListRow>
          </OpsList>
        </OpsCard>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-md font-bold text-ink">Nyckeltal</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <OpsStat label="Omsättning" value={formatCurrency(1284000)} hint="Rullande tolv månader" />
          <OpsStat label="Obetalda fakturor" value="4" tone="warning" hint="Äldsta 31 dagar" />
          <OpsStat label="Marginal" value="18 %" tone="success" />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-md font-bold text-ink">Tabell</h2>
        <OpsCard>
          <OpsTable
            caption="Leverantörer och belopp"
            hideCaption
            columns={[
              { key: "namn", label: "Leverantör" },
              { key: "kategori", label: "Kategori", tight: true },
              { key: "belopp", label: "Per år", numeric: true },
              { key: "datum", label: "Senast", numeric: true, tight: true },
            ]}
            rows={[
              { id: "1", namn: "Fortnox", kategori: <OpsTag label="IT" />, belopp: formatCurrency(4788), datum: formatDate("2026-09-01") },
              { id: "2", namn: "Telia", kategori: <OpsTag label="Telefoni" />, belopp: formatCurrency(5388), datum: formatDate("2026-08-28") },
              { id: "3", namn: "Länsförsäkringar", kategori: <OpsTag label="Försäkring" />, belopp: formatCurrency(12400), datum: formatDate("2026-08-15") },
            ]}
          />
        </OpsCard>
      </section>

      <Ruta rubrik="Etiketter och proveniens">
        {["Mat", "Bil", "Bostad", "IT", "Streaming", "Försäkring"].map((e) => (
          <OpsTag key={e} label={e} />
        ))}
        <OpsTag label="Går att ta bort" onRemove={() => {}} />
        <OpsProvenance kind="human" />
        <OpsProvenance kind="agent" />
        <OpsProvenance kind="auto" />
      </Ruta>

      <section className="mb-8">
        <h2 className="mb-3 text-md font-bold text-ink">Meddelanden</h2>
        <div className="flex flex-col gap-3">
          <OpsBanner tone="info" title="Uppdaterad i går" onDismiss={() => {}}>
            Siffrorna hämtades senast klockan 06:00.
          </OpsBanner>
          <OpsBanner tone="warning" title="Fyra fakturor saknar kategori" action={<OpsButton size="sm">Visa</OpsButton>} />
          <OpsBanner tone="danger" title="Importen misslyckades">
            Filen gick inte att läsa. Kontrollera formatet och försök igen.
          </OpsBanner>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-md font-bold text-ink">Flikar</h2>
        <OpsTabs
          tabs={[
            { id: "utfall", label: "Utfall" },
            { id: "prognos", label: "Prognos" },
            { id: "lasta", label: "Låsta perioder", disabled: true },
          ]}
          value={flik}
          onChange={setFlik}
          ariaLabel="Ekonomivy"
        >
          <OpsTabPanel id="utfall">
            <OpsCard>Utfall för perioden.</OpsCard>
          </OpsTabPanel>
          <OpsTabPanel id="prognos">
            <OpsCard>Prognos för perioden.</OpsCard>
          </OpsTabPanel>
        </OpsTabs>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-md font-bold text-ink">Tomt och laddande</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <OpsEmpty
            title="Inga kostnader ännu"
            description="Lägg till den första så visas den här."
            action={<OpsButton variant="primary" size="sm">Lägg till kostnad</OpsButton>}
          />
          <OpsEmpty busy title="Inga kostnader ännu" />
        </div>
      </section>

      <Ruta rubrik="Val">
        <OpsCheckbox label="Visa arkiverade" checked={kryss} onChange={setKryss} hint="Träder i kraft när du sparar" />
        <OpsSwitch label="Kompakt läge" checked={reglage} onChange={setReglage} hint="Slår om direkt" />
      </Ruta>

      <Ruta rubrik="Modal">
        <OpsButton variant="primary" onClick={() => setOppen(true)}>
          Öppna modal
        </OpsButton>
        <OpsModal
          open={oppen}
          onOpenChange={setOppen}
          title="Ta bort ärende"
          description="Detta går inte att ångra."
          footer={
            <>
              <OpsButton onClick={() => setOppen(false)}>Avbryt</OpsButton>
              <OpsButton variant="danger" onClick={() => setOppen(false)}>
                Ta bort
              </OpsButton>
            </>
          }
        >
          <p className="text-base text-ink-secondary">
            Fokus fångas i dialogen, Escape stänger, och fokus lämnas tillbaka till knappen som öppnade den. Prova med tangentbordet.
          </p>
        </OpsModal>
      </Ruta>
    </OpsView>
  );
}
