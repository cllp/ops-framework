import { useEffect, useRef, useState } from "react";
import { filadressFel } from "../lib/bibliotek.js";
import { blobBytes } from "../lib/blobbytes.js";
import { formatNumber } from "../lib/format.js";
import { ordet } from "../lib/ord.js";
import { avkodaSie, tolkaSie } from "../lib/sie.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsTable } from "./OpsTable.jsx";
import { OpsTabPanel, OpsTabs } from "./OpsTabs.jsx";
import { OpsVantar } from "./OpsVantar.jsx";
import { TextForhandsvisning } from "./TextForhandsvisning.jsx";

/**
 * En SIE-fil i Biblioteket, visad tolkad i detaljen (0.268.0, cllp/lifehub.app#884).
 *
 * ══ ⛔ VARFÖR ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-18: "Jag skulle vilja kunna ha stöd för SIE filer i biblioteket och API:et", och i ärendets förslag: företag och orgnr, räkenskapsår,
 * kontoplan, ingående och utgående balanser, resultat per konto och verifikationer, "i stället för rå text". Som text hade en SIE-fil varit tusentals
 * rader `#TRANS 1930 {} -1234.50` och åäö i fel teckentabell.
 *
 * ⛔ SAMMA VÄG SOM TEXTFILEN OCH KARTAN: byten hämtas med appens `hamtaFil` (inloggningen), bara när detaljen är öppen, och tolkas här av `tolkaSie`
 * (`lib/sie.js`, samma tolkning som appens API läser). Ladda ned står kvar under, som för varje fil.
 *
 * ⛔ HUVUDET OCH TRE FLIKAR (skillen interaktionsdesign: högst tre sektioner). Företaget och räkenskapsåret står överst. Resultat, Balans och
 * Verifikationer är flikar, och resultatet först: det är oftast frågan. En fil som inte är SIE visas som text, med en rad som säger det.
 *
 * ⛔ ETT TAK, `SIE_BYTE`. En SIE 4 med flera års verifikationer kan vara tiotals megabyte, och en telefon som tolkar och ritar dem hänger sig. Över taket
 * står det att filen är för stor att visa här. Verifikationerna visas högst `SIE_VER_VISAS` åt gången, de senaste först, och raden säger hur många som finns.
 *
 * @param {{ hamta: (sokvag: string) => Promise<Blob>, sokvag: string, namn: string }} props
 */
export function SieForhandsvisning({ hamta, sokvag, namn }) {
  const sprak = useOpsSprak();
  const o = (/** @type {keyof typeof ORD_SIE} */ k) => ordet(ORD_SIE, k, sprak);
  const [lage, setLage] = useState(
    /** @type {{ lage: "hamtar" } | { lage: "klar", sie: import("../lib/sie.js").Sie } | { lage: "text", blob: Blob } | { lage: "stor" } | { lage: "fel", fel: string }} */ ({ lage: "hamtar" }),
  );
  const [flik, setFlik] = useState("resultat");
  const hamtaRef = useRef(hamta);
  hamtaRef.current = hamta;
  useEffect(() => {
    let kvar = true;
    setLage({ lage: "hamtar" });
    Promise.resolve()
      .then(() => hamtaRef.current(sokvag))
      .then(async (blob) => {
        if (blob.size > SIE_BYTE) {
          if (kvar) setLage({ lage: "stor" });
          return;
        }
        const tolkad = tolkaSie(avkodaSie(new Uint8Array(await blobBytes(blob))));
        if (kvar) setLage(tolkad.ok ? { lage: "klar", sie: tolkad.sie } : { lage: "text", blob });
      })
      .catch((e) => {
        if (kvar) setLage({ lage: "fel", fel: filadressFel(e) });
      });
    return () => {
      kvar = false;
    };
  }, [sokvag]);

  if (lage.lage === "hamtar") return <div data-bibliotek-sie="hamtar" className="m-0 text-etikett text-ink-muted"><OpsVantar text={o("hamtar")} /></div>;
  if (lage.lage === "fel") return <p role="alert" data-bibliotek-sie="fel" className="m-0 text-etikett text-danger">{`${o("fel")} ${lage.fel}`}</p>;
  if (lage.lage === "stor") return <p role="status" data-bibliotek-sie="stor" className="m-0 text-etikett text-ink-muted">{o("stor")}</p>;
  if (lage.lage === "text") {
    return (
      <div data-bibliotek-sie="text" className="flex min-w-0 flex-col gap-2">
        <p className="m-0 text-meta text-ink-muted">{o("inteSie")}</p>
        <TextForhandsvisning hamta={() => Promise.resolve(lage.blob)} sokvag={sokvag} namn={namn} />
      </div>
    );
  }

  const { sie } = lage;
  const kr = (/** @type {number | null} */ ore) => (ore === null ? "" : formatNumber(ore / 100, { decimals: 2 }));
  const ar = sie.rakenskapsar.find((r) => r.ar === 0);
  const resultatkonton = sie.konton.filter((k) => k.res !== null);
  const balanskonton = sie.konton.filter((k) => k.ib !== null || k.ub !== null);
  // ⛔ ÅRETS RESULTAT ÄR MINUS SUMMAN AV #RES. I SIE står intäkter som kredit (negativa) och kostnader som debet (positiva), så en vinst är en negativ summa.
  const resultat = resultatkonton.length ? -resultatkonton.reduce((s, k) => s + /** @type {number} */ (k.res), 0) : null;
  const ver = [...sie.verifikationer].sort((a, b) => String(b.datum ?? "").localeCompare(String(a.datum ?? "")) || b.nr.localeCompare(a.nr, "sv", { numeric: true }));
  const visade = ver.slice(0, SIE_VER_VISAS);
  const fakta = [
    [o("foretag"), [sie.foretag, sie.orgnr].filter(Boolean).join(", ")],
    [o("rakenskapsar"), ar ? `${ar.start ?? "?"} ${o("till")} ${ar.slut ?? "?"}` : ""],
    [o("program"), [sie.program, sie.sietyp ? `SIE ${sie.sietyp}` : ""].filter(Boolean).join(", ")],
  ].filter(([, v]) => v);

  return (
    <div data-bibliotek-sie="klar" role="region" aria-label={o("innehall").replace("{namn}", namn)} className="flex min-w-0 flex-col gap-3">
      {fakta.length ? (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-etikett">
          {fakta.map(([t, v]) => (
            <div key={t} className="contents">
              <dt className="text-ink-muted">{t}</dt>
              <dd className="m-0 min-w-0 break-words text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <OpsTabs
        ariaLabel={o("flikar")}
        value={flik}
        onChange={setFlik}
        tabs={[
          { id: "resultat", label: o("resultat"), badge: resultatkonton.length },
          { id: "balans", label: o("balans"), badge: balanskonton.length },
          { id: "verifikationer", label: o("verifikationer"), badge: sie.verifikationer.length },
        ]}
      >
        <OpsTabPanel id="resultat">
          <div className="flex flex-col gap-2">
            {resultat !== null ? (
              <p data-sie-resultat="" className="m-0 text-etikett text-ink">
                {o("aretsResultat")} <span className="font-medium tabular-nums">{kr(resultat)}</span>
              </p>
            ) : null}
            <OpsTable
              caption={o("resultat")}
              hideCaption
              columns={[
                { key: "nr", label: o("konto"), tight: true },
                { key: "namn", label: o("namn") },
                { key: "res", label: o("belopp"), numeric: true },
              ]}
              rows={resultatkonton.map((k) => ({ id: k.nr, nr: k.nr, namn: k.namn, res: kr(k.res) }))}
              empty={<p className="m-0 text-meta text-ink-muted">{o("ingaResultat")}</p>}
            />
          </div>
        </OpsTabPanel>
        <OpsTabPanel id="balans">
          <OpsTable
            caption={o("balans")}
            hideCaption
            columns={[
              { key: "nr", label: o("konto"), tight: true },
              { key: "namn", label: o("namn") },
              { key: "ib", label: o("ingaende"), numeric: true },
              { key: "ub", label: o("utgaende"), numeric: true },
            ]}
            rows={balanskonton.map((k) => ({ id: k.nr, nr: k.nr, namn: k.namn, ib: kr(k.ib), ub: kr(k.ub) }))}
            empty={<p className="m-0 text-meta text-ink-muted">{o("ingaBalanser")}</p>}
          />
        </OpsTabPanel>
        <OpsTabPanel id="verifikationer">
          <div className="flex flex-col gap-2">
            <OpsTable
              caption={o("verifikationer")}
              hideCaption
              columns={[
                { key: "datum", label: o("datum"), tight: true },
                { key: "ver", label: o("verifikation"), tight: true },
                { key: "text", label: o("text") },
                { key: "summa", label: o("belopp"), numeric: true },
              ]}
              rows={visade.map((v, i) => ({ id: `${v.serie}-${v.nr}-${i}`, datum: v.datum ?? "", ver: `${v.serie}${v.nr}`, text: v.text, summa: kr(v.summa) }))}
              empty={<p className="m-0 text-meta text-ink-muted">{o("ingaVerifikationer")}</p>}
            />
            {ver.length > visade.length ? (
              <p data-sie-fler="" className="m-0 text-meta text-ink-muted">
                {o("visarSenaste").replace("{visas}", String(visade.length)).replace("{alla}", String(ver.length))}
              </p>
            ) : null}
          </div>
        </OpsTabPanel>
      </OpsTabs>
      {sie.varningar.length ? (
        <p data-sie-varningar="" className="m-0 text-meta text-ink-muted">
          {o("varningar").replace("{antal}", String(sie.varningar.length))}
        </p>
      ) : null}
    </div>
  );
}

/** Det största en SIE-fil får vara för att visas tolkad här: 10 MB. Större filer laddas ned. */
export const SIE_BYTE = 10 * 1024 * 1024;

/** Hur många verifikationer som visas, de senaste först. */
export const SIE_VER_VISAS = 200;

/** @type {import("../lib/ord.js").Ordbok} */
const ORD_SIE = {
  hamtar: { sv: "Hämtar bokföringen.", en: "Fetching the bookkeeping." },
  fel: { sv: "Filen gick inte att visa.", en: "The file could not be shown." },
  stor: { sv: "Filen är för stor för att visas här. Ladda ned den.", en: "The file is too large to show here. Download it." },
  inteSie: { sv: "Filen går inte att läsa som SIE, så den visas som text.", en: "The file cannot be read as SIE, so it is shown as text." },
  innehall: { sv: "Bokföringen i {namn}", en: "The bookkeeping in {namn}" },
  foretag: { sv: "Företag", en: "Company" },
  rakenskapsar: { sv: "Räkenskapsår", en: "Financial year" },
  till: { sv: "till", en: "to" },
  program: { sv: "Från", en: "From" },
  flikar: { sv: "Bokföringen", en: "The bookkeeping" },
  resultat: { sv: "Resultat", en: "Income statement" },
  balans: { sv: "Balans", en: "Balance sheet" },
  verifikationer: { sv: "Verifikationer", en: "Vouchers" },
  aretsResultat: { sv: "Årets resultat:", en: "Profit for the year:" },
  konto: { sv: "Konto", en: "Account" },
  namn: { sv: "Namn", en: "Name" },
  belopp: { sv: "Belopp", en: "Amount" },
  ingaende: { sv: "Ingående", en: "Opening" },
  utgaende: { sv: "Utgående", en: "Closing" },
  datum: { sv: "Datum", en: "Date" },
  verifikation: { sv: "Ver", en: "Voucher" },
  text: { sv: "Text", en: "Text" },
  ingaResultat: { sv: "Filen har inga resultat per konto.", en: "The file has no results per account." },
  ingaBalanser: { sv: "Filen har inga balanser.", en: "The file has no balances." },
  ingaVerifikationer: { sv: "Filen har inga verifikationer.", en: "The file has no vouchers." },
  visarSenaste: { sv: "Visar de {visas} senaste av {alla}. Alla finns i filen.", en: "Showing the latest {visas} of {alla}. All are in the file." },
  varningar: { sv: "{antal} rader i filen gick inte att läsa och visas inte.", en: "{antal} lines in the file could not be read and are not shown." },
};
