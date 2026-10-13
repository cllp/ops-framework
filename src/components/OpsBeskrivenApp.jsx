import { useCallback, useEffect, useRef, useState } from "react";
import { List, Plus, Table2 } from "lucide-react";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsButton, knappKlass } from "./OpsButton.jsx";
import { OpsDatePicker } from "./OpsDatePicker.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField, OpsInput, OpsTextarea } from "./OpsField.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { ModulLageKnapp, OpsModulRam, kravRam } from "./OpsModulRam.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsTabPanel, OpsTabs } from "./OpsTabs.jsx";
import { OpsTable } from "./OpsTable.jsx";
import { OpsSwitch } from "./OpsToggle.jsx";
import { OpsView } from "./OpsView.jsx";
import { TillbakaKnapp } from "./TillbakaKnapp.jsx";
import { arInstallningslage } from "../lib/apparark.js";
import { MAX_LANGTEXTVARDE, MAX_LANKVARDE, MAX_TEXTVARDE, validateBeskrivning, validateRad } from "../lib/beskrivenapp.js";
import { farAndra, normaliseraAdress } from "../lib/bibliotek.js";
import { cx } from "../lib/cx.js";
import { formatDate } from "../lib/format.js";
import { modulTillbaka } from "../lib/modulram.js";
import { ordet } from "../lib/ord.js";
import { personnamn } from "../lib/personnamn.js";
import { MAX_SKAPARNAMN } from "../lib/skapare.js";

/**
 * En beskriven app: flikar per lista, sök, Ny, och raderna som lista eller tabell (beslut 0005, lifehub.app#213).
 *
 * ══ ⛔ ENDAST RAMVERKETS EGNA DELAR, ALDRIG KOD UR BESKRIVNINGEN ═════════════════════
 *
 * Beskrivningen är data. Vyn ritar `OpsInput`, `OpsSelect`, `OpsDatePicker` och de andra primitiverna ur fältens typ, och
 * skriver varje namn, alternativ och värde som TEXT. Ingenting ur beskrivningen blir HTML, en klass, en stil, en adress som
 * körs eller ett attribut vi inte själva valt. En länk i en rad visas som text (en länk som går att trycka på hade varit en
 * kodväg ut ur appen, och beslut 0005 vill att en beskrivning bara kan BE motorn om saker).
 *
 * ══ ⛔ VYN ÄR STYRD AV KÄLLAN, OCH ETT FEL SYNS ALLTID ═══════════════════════════════
 *
 * `kalla` (`createBeskrivenAppKalla`) läser och skriver. Vyn läser om efter varje ändring i stället för att gissa resultatet.
 * Ett misslyckat sparande visas i formuläret (`role="alert"`) och formuläret står kvar med det personen skrivit, aldrig tyst
 * (arbetsreglernas punkt 5). En läsning som misslyckas visas, och en tom lista med fel är inte "appen är tom".
 *
 * ══ ⛔ EN BESKRIVNING SOM INTE HÅLLER RITAS INTE ═════════════════════════════════════
 *
 * Beskrivningen prövas med `validateBeskrivning` före allt annat. Håller den inte visas felen i en banner och inget annat. Den
 * kastar inte: beskrivningen kan ligga i en databas en ägare får skriva i, och en sida som kraschar för att en rad där är skev
 * tar med sig resten av appen.
 *
 * ══ ⛔ VYN VISAR VAD DEN INTE KAN, DEN KASTAR INTE ═══════════════════════════════════
 *
 * Ett värde av fel typ i en rad (skrivet förbi klienten, eller kvar från en tidigare version av beskrivningen) visas som text.
 * En person som lämnat gruppen visas som "Okänd medlem", aldrig som sitt id.
 *
 * ⛔ VEM SOM FÅR ÄNDRA ÄR `farAndra`, samma villkor som regelns `update` och `delete`: den som skapade raden, eller ägare eller
 * admin. En annan medlem ser raden med låsta fält och en Stäng-knapp. `jag` är `null` när personen inte är medlem, och då finns
 * inget Ny.
 *
 * ⛔ ÖVERSÄTTNINGEN GÄLLER VYNS EGNA ORD. Felen från `validateRad` är skrivna för en agent och är på svenska. De visas som de är på
 * fältet de gäller. Beskrivningens egna namn och alternativ översätts inte: det är gruppens ord.
 *
 * @param {object} props
 * @param {unknown} props.beskrivning Appens beskrivning. Prövas av vyn; det som inte håller visas som felen.
 * @param {ReturnType<typeof import("../data/beskrivenappkalla.js").createBeskrivenAppKalla>} props.kalla Läser och skriver raderna.
 * @param {{ uid: string, roll: string, groupId?: string } | null} props.jag Den inloggades aktiva medlemskap i gruppen, eller `null` när personen inte är medlem. Krävs.
 * @param {ReadonlyArray<{ userId: string, namn?: string, typ?: string, status?: string }>} props.medlemmar Gruppens medlemskap. Fälten av typen person väljer ur de aktiva personerna (inte agenten).
 * @param {"sv"|"en"} [props.sprak] Förval är appens språk (`OpsSprakProvider`).
 * @param {string} [props.hubHref] Hubbens adress. Utelämnad: ingen tillbaka-rad.
 * @param {string} [props.hubEtikett] Förval "Appar".
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {import("./OpsModulRam.jsx").ModulRam | null} [props.ram] Inställningsläget, som i `OpsBibliotek`. Utelämnad: vyn som förut, utan kugghjul.
 * @param {string} [props.activeHref] Krävs tillsammans med `ram` och `modul`. `?lage=installningar` visar inställningarna.
 * @param {import("../lib/modul.js").Modul | null} [props.modul] Manifestet inställningarna läser. Krävs med `ram`.
 */
export function OpsBeskrivenApp({ beskrivning, kalla, jag, medlemmar, sprak: sprakProp, hubHref, hubEtikett, onNavigate, ram = null, activeHref, modul = null }) {
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  if (jag === undefined) {
    throw new Error("OpsBeskrivenApp: jag krävs, den inloggades aktiva medlemskap i gruppen ({ uid, roll }), eller null när personen inte är medlem. Utan propen ser en medlem ut som en som bara får läsa.");
  }
  if (!kalla || typeof kalla.las !== "function" || typeof kalla.skapa !== "function" || typeof kalla.spara !== "function" || typeof kalla.taBort !== "function") {
    throw new Error("OpsBeskrivenApp: kalla krävs och ska vara createBeskrivenAppKalla(...). Den läser och skriver raderna, och vyn skriver aldrig själv.");
  }
  if (!Array.isArray(medlemmar)) {
    throw new Error("OpsBeskrivenApp: medlemmar krävs, gruppens medlemskap. Fält av typen person väljer ur dem, och en tom lista är ett svar (en grupp utan andra medlemmar).");
  }
  kravRam(ram, "OpsBeskrivenApp");
  if (ram && (typeof activeHref !== "string" || activeHref === "" || !modul)) {
    throw new Error("OpsBeskrivenApp: ram kräver activeHref och modul. Inställningsläget behöver adressen och appens manifest.");
  }
  const t = (/** @type {keyof typeof ORD_OPSBESKRIVENAPP} */ nyckel) => ordet(ORD_OPSBESKRIVENAPP, nyckel, sprak);

  const prov = validateBeskrivning(beskrivning);
  if (!prov.ok) {
    return (
      <OpsView>
        <div data-beskriven-app-fel="" className="flex min-w-0 w-full flex-col gap-4">
          <OpsBanner tone="danger" title={t("ogiltigTitel")}>
            <p className="m-0">{t("ogiltigText")}</p>
            <ul className="m-0 pl-5">
              {prov.fel.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </OpsBanner>
        </div>
      </OpsView>
    );
  }
  const b = prov.beskrivning;

  const installningar = Boolean(ram && modul && arInstallningslage(/** @type {string} */ (activeHref)));
  if (installningar && modul) {
    return (
      <OpsModulRam modul={modul} activeHref={/** @type {string} */ (activeHref)} hubHref={hubHref ?? ""} hubEtikett={hubEtikett} onNavigate={onNavigate} sprak={sprak} ram={ram}>
        {null}
      </OpsModulRam>
    );
  }
  const visaKnapp = Boolean(ram && ram.farAndra);
  const tillbaka = hubHref
    ? {
        ...modulTillbaka({ namn: b.namn, hubHref, hubEtikett, onNavigate, sprak, modulId: b.id }),
        ...(visaKnapp ? { atgard: <ModulLageKnapp ram={ram} activeHref={/** @type {string} */ (activeHref)} onNavigate={onNavigate} sprak={sprak} installningar={false} /> } : {}),
      }
    : undefined;

  return <Appvy b={b} kalla={kalla} jag={jag} medlemmar={medlemmar} sprak={sprak} tillbaka={tillbaka} />;
}

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_OPSBESKRIVENAPP = {
  ogiltigTitel: { sv: "Appen går inte att visa.", en: "The app cannot be shown." },
  ogiltigText: { sv: "Beskrivningen av appen håller inte. Det här behöver rättas av den som byggde appen:", en: "The description of the app is not valid. The person who built the app needs to fix this:" },
  sok: { sv: "Sök", en: "Search" },
  sokPlats: { sv: "Sök i raderna", en: "Search the rows" },
  ny: { sv: "Ny", en: "New" },
  nyRad: { sv: "Ny rad i", en: "New row in" },
  hamtar: { sv: "Hämtar raderna", en: "Loading the rows" },
  tomTitel: { sv: "{namn} är tom.", en: "{namn} is empty." },
  tomMedNy: { sv: "Tryck på Ny för att lägga till den första raden.", en: "Press New to add the first row." },
  tomLas: { sv: "Det finns inga rader att visa.", en: "There are no rows to show." },
  ingaTraffar: { sv: "Inga träffar.", en: "No matches." },
  ingaTraffarText: { sv: "Inget matchar \"{sok}\".", en: "Nothing matches \"{sok}\"." },
  lasFel: { sv: "Raderna gick inte att läsa:", en: "The rows could not be read:" },
  trasigEn: { sv: "1 rad kunde inte läsas och visas inte.", en: "1 row could not be read and is not shown." },
  trasigFlera: { sv: "{antal} rader kunde inte läsas och visas inte.", en: "{antal} rows could not be read and are not shown." },
  utanRubrik: { sv: "Utan rubrik", en: "Untitled" },
  okandMedlem: { sv: "Okänd medlem", en: "Unknown member" },
  ja: { sv: "Ja", en: "Yes" },
  nej: { sv: "Nej", en: "No" },
  ingen: { sv: "Ingen", en: "None" },
  valj: { sv: "Välj", en: "Choose" },
  valjDatum: { sv: "Välj datum", en: "Choose a date" },
  rensaDatum: { sv: "Rensa datum", en: "Clear date" },
  valjPerson: { sv: "Välj person", en: "Choose a person" },
  spara: { sv: "Spara", en: "Save" },
  avbryt: { sv: "Avbryt", en: "Cancel" },
  stang: { sv: "Stäng", en: "Close" },
  tillbaka: { sv: "Tillbaka", en: "Back" },
  taBort: { sv: "Ta bort", en: "Delete" },
  taBortTitel: { sv: "Ta bort raden", en: "Delete the row" },
  taBortFraga: { sv: "Ta bort \"{rubrik}\"? Det går inte att ångra.", en: "Delete \"{rubrik}\"? This cannot be undone." },
  nyRadRubrik: { sv: "Ny rad", en: "New row" },
  sparFel: { sv: "Raden sparades inte.", en: "The row was not saved." },
  taBortFel: { sv: "Raden togs inte bort.", en: "The row was not deleted." },
  rattaFalt: { sv: "Rätta fälten som är markerade.", en: "Fix the fields that are marked." },
  baraLas: { sv: "Du kan läsa raden men inte ändra den. Bara den som skapade den, eller en ägare eller admin, ändrar.", en: "You can read this row but not change it. Only the person who created it, or an owner or admin, can change it." },
  skapadAv: { sv: "Skapad av {namn}.", en: "Created by {namn}." },
  skaparSaknas: { sv: "Skaparen saknar namn.", en: "The creator has no name." },
  faltTalFel: { sv: "Ange ett tal.", en: "Enter a number." },
  lista: { sv: "Lista", en: "List" },
  tabell: { sv: "Tabell", en: "Table" },
};

/**
 * @param {string} mall
 * @param {Record<string, string | number>} varden
 * @returns {string}
 */
function fyll(mall, varden) {
  return mall.replace(/\{(\w+)\}/g, (hel, k) => (Object.hasOwn(varden, k) ? String(varden[k]) : hel));
}

/** Värdet för "ingen vald" i en väljare. Radix tillåter inte ett tomt värde på ett alternativ. */
const INGEN = "__ingen__";

/** Så många fält utöver rubriken står på en listrad. */
const METAFALT = 3;

const MAX_METATEXT = 80;

/**
 * Värdet i en rad för ett fält, eller `undefined` när raden inte bär fältet.
 *
 * ⛔ ALDRIG `rad.varden[id]` RAKT AV. Ett fält-id är en slug, och `constructor` är en slug och en nyckel på varje objekt: en rad som
 * saknar fältet gav då funktionen `Object`, och vyn skrev "function Object() { [native code] }" i listan, fyllde formuläret med den
 * och sparade den (granskningen av 0.99.0). `Object.hasOwn` släpper bara in det raden själv bär.
 *
 * @param {{ varden?: Record<string, unknown> } | null | undefined} rad
 * @param {string} id
 * @returns {unknown}
 */
function radvarde(rad, id) {
  const v = rad?.varden;
  return v && typeof v === "object" && Object.hasOwn(v, id) ? v[id] : undefined;
}

/**
 * Texten kortad till högst `max` tecken, med tre punkter sist. Taket gäller det som RITAS och det som SÖKS, inte det som sparas.
 *
 * ⛔ UTAN TAK RITAS VARJE VÄRDE I FULL LÄNGD. Regeln låser antalet fält i en rad men inte hur långt ett värde är (den känner inte
 * beskrivningen, se `beskrivenappdataregelfragment`), och `validateRad` körs bara i klienten. Ett värde på hundratals kilobyte skrivet
 * förbi klienten hade ritats helt i varje rad, och sökningen gör `toLowerCase` på det för varje rad vid varje tangenttryck.
 *
 * @param {string} s
 * @param {number} max
 * @returns {string}
 */
function kapa(s, max) {
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

/**
 * Personerna en person-väljare erbjuder: aktiva medlemmar som är personer, inte agenten.
 * @param {ReadonlyArray<{ userId: string, namn?: string, typ?: string, status?: string }>} medlemmar
 */
function personer(medlemmar) {
  return medlemmar.filter((m) => m && typeof m.userId === "string" && m.userId && (m.status ?? "aktiv") === "aktiv" && (m.typ ?? "person") === "person");
}

/**
 * Ett värde som TEXT, för en rad eller en tabellcell. Ett värde av fel typ visas ändå, som text.
 *
 * @param {import("../lib/beskrivenapp.js").Falt} falt
 * @param {unknown} varde
 * @param {{ sprak: string, medlemmar: ReadonlyArray<{ userId: string, namn?: string }>, ord: (nyckel: keyof typeof ORD_OPSBESKRIVENAPP) => string }} ctx
 * @returns {string}
 */
function visaVarde(falt, varde, ctx) {
  if (varde === undefined || varde === null || varde === "") return "";
  const locale = ctx.sprak === "en" ? "en-GB" : "sv-SE";
  switch (falt.typ) {
    case "janej":
      return varde === true ? ctx.ord("ja") : varde === false ? ctx.ord("nej") : kapa(String(varde), MAX_TEXTVARDE);
    case "datum":
      return typeof varde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(varde) ? formatDate(varde, { locale }) : kapa(String(varde), MAX_TEXTVARDE);
    case "tal":
      return typeof varde === "number" && Number.isFinite(varde) ? new Intl.NumberFormat(locale).format(varde) : kapa(String(varde), MAX_TEXTVARDE);
    case "person": {
      const m = ctx.medlemmar.find((x) => x.userId === varde);
      if (!m) return ctx.ord("okandMedlem");
      const n = personnamn(m.namn, { saknas: ctx.ord("okandMedlem") });
      return n.text;
    }
    case "langtext": {
      // Bara början normaliseras: en text på en megabyte ska inte gås igenom för att sedan kortas till 80 tecken.
      const s = String(varde).slice(0, MAX_LANGTEXTVARDE).replace(/\s+/g, " ").trim();
      return kapa(s, MAX_METATEXT);
    }
    case "lank":
      return kapa(String(varde), MAX_LANKVARDE);
    default:
      return kapa(String(varde), MAX_TEXTVARDE);
  }
}

/**
 * @param {object} props
 * @param {import("../lib/beskrivenapp.js").Beskrivning} props.b
 * @param {ReturnType<typeof import("../data/beskrivenappkalla.js").createBeskrivenAppKalla>} props.kalla
 * @param {{ uid: string, roll: string, groupId?: string } | null} props.jag
 * @param {ReadonlyArray<{ userId: string, namn?: string, typ?: string, status?: string }>} props.medlemmar
 * @param {string} props.sprak
 * @param {any} props.tillbaka
 */
function Appvy({ b, kalla, jag, medlemmar, sprak, tillbaka }) {
  const t = (/** @type {keyof typeof ORD_OPSBESKRIVENAPP} */ nyckel) => ordet(ORD_OPSBESKRIVENAPP, nyckel, sprak);
  const [flik, setFlik] = useState(b.listor[0].id);
  const [sok, setSok] = useState("");
  const [lage, setLage] = useState(/** @type {null | { lista: string, rad: import("../data/beskrivenappkalla.js").Beskrivenapprad | null }} */ (null));
  const [raderar, setRaderar] = useState(/** @type {null | import("../data/beskrivenappkalla.js").Beskrivenapprad} */ (null));
  const [raderaFel, setRaderaFel] = useState("");
  const [raderaBusy, setRaderaBusy] = useState(false);
  const [data, setData] = useState(/** @type {{ laddar: boolean, rader: import("../data/beskrivenappkalla.js").Beskrivenapprad[], fel: string, trasiga: { id: string, fel: string }[] }} */ ({ laddar: true, rader: [], fel: "", trasiga: [] }));
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);

  const ladda = useCallback(async () => {
    const svar = await kalla.las();
    if (!levande.current) return;
    setData({
      laddar: false,
      rader: svar.rader,
      fel: svar.kalla === "fel" ? (svar.fel?.message ?? "") || "?" : "",
      trasiga: svar.trasiga,
    });
  }, [kalla]);
  useEffect(() => {
    void ladda();
  }, [ladda]);

  const ctx = { sprak, medlemmar, ord: t };

  /** @param {import("../lib/beskrivenapp.js").Lista} lista @param {import("../data/beskrivenappkalla.js").Beskrivenapprad} rad */
  const rubrikFor = (lista, rad) => {
    const falt = lista.falt.find((f) => f.id === lista.rubrikfalt);
    const r = falt ? visaVarde(falt, radvarde(rad, lista.rubrikfalt), ctx) : "";
    return r || t("utanRubrik");
  };

  /** @param {import("../lib/beskrivenapp.js").Lista} lista @param {import("../data/beskrivenappkalla.js").Beskrivenapprad} rad */
  const metaFor = (lista, rad) =>
    lista.falt
      .filter((f) => f.id !== lista.rubrikfalt)
      .map((f) => ({ f, v: visaVarde(f, radvarde(rad, f.id), ctx) }))
      .filter((x) => x.v)
      .slice(0, METAFALT)
      .map((x) => `${x.f.namn}: ${x.v}`)
      .join(" · ");

  /** @param {import("../lib/beskrivenapp.js").Lista} lista */
  const radernaI = (lista) => data.rader.filter((r) => r.lista === lista.id);

  /** @param {import("../lib/beskrivenapp.js").Lista} lista @param {import("../data/beskrivenappkalla.js").Beskrivenapprad} rad */
  const traffar = (lista, rad) => {
    const q = sok.trim().toLowerCase();
    if (!q) return true;
    return lista.falt.some((f) => visaVarde(f, radvarde(rad, f.id), ctx).toLowerCase().includes(q));
  };

  async function taBort() {
    if (!raderar) return;
    setRaderaBusy(true);
    setRaderaFel("");
    try {
      await kalla.taBort(raderar.id);
      if (!levande.current) return;
      setRaderar(null);
      setLage(null);
      await ladda();
    } catch (e) {
      if (levande.current) setRaderaFel(e instanceof Error && e.message ? e.message : t("taBortFel"));
    } finally {
      if (levande.current) setRaderaBusy(false);
    }
  }

  const detaljLista = lage ? b.listor.find((l) => l.id === lage.lista) : null;

  /** @param {import("../lib/beskrivenapp.js").Lista} lista */
  function listinnehall(lista) {
    const alla = radernaI(lista);
    const synliga = alla.filter((r) => traffar(lista, r));
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <OpsInput value={sok} onChange={setSok} type="search" ariaLabel={`${t("sok")}: ${lista.namn}`} placeholder={t("sokPlats")} />
          </div>
          {jag ? (
            <button
              type="button"
              aria-label={`${t("nyRad")} ${lista.namn}`}
              onClick={() => setLage({ lista: lista.id, rad: null })}
              className={cx(knappKlass(), "shrink-0 cursor-pointer")}
            >
              <Plus size={16} aria-hidden="true" />
              <span>{t("ny")}</span>
            </button>
          ) : null}
        </div>
        {data.fel ? (
          <p role="alert" data-beskriven-app-lasfel="">
            {t("lasFel")} {data.fel}
          </p>
        ) : null}
        {data.trasiga.length > 0 ? (
          <div role="status" data-beskriven-app-trasiga={data.trasiga.length} className="text-meta text-ink-muted">
            <p>{data.trasiga.length === 1 ? t("trasigEn") : fyll(t("trasigFlera"), { antal: data.trasiga.length })}</p>
            <ul>
              {data.trasiga.map((x) => (
                <li key={x.id}>{x.id}: {x.fel}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {data.fel ? null : data.laddar ? (
          <OpsEmpty busy title={t("hamtar")} />
        ) : synliga.length === 0 ? (
          <OpsEmpty
            title={sok.trim() ? t("ingaTraffar") : fyll(t("tomTitel"), { namn: lista.namn })}
            description={sok.trim() ? fyll(t("ingaTraffarText"), { sok: sok.trim() }) : jag ? t("tomMedNy") : t("tomLas")}
          />
        ) : lista.visning === "tabell" ? (
          <Tabell lista={lista} rader={synliga} ctx={ctx} rubrikFor={rubrikFor} onOppna={(rad) => setLage({ lista: lista.id, rad })} />
        ) : (
          <OpsList ariaLabel={lista.namn} divided>
            {synliga.map((rad) => {
              const meta = metaFor(lista, rad);
              return (
                <OpsListRow key={rad.id} interactive ariaLabel={rubrikFor(lista, rad)} onClick={() => setLage({ lista: lista.id, rad })}>
                  <span className="min-w-0 flex-1" data-beskriven-rad={rad.id}>
                    <span className="block truncate text-brod font-medium text-ink">{rubrikFor(lista, rad)}</span>
                    {meta ? <span className="block truncate text-meta text-ink-muted">{meta}</span> : null}
                  </span>
                </OpsListRow>
              );
            })}
          </OpsList>
        )}
      </div>
    );
  }

  const flikar = b.listor.map((l) => ({
    id: l.id,
    label: l.namn,
    icon: l.visning === "tabell" ? <Table2 size={16} /> : <List size={16} />,
    badge: radernaI(l).length,
  }));

  return (
    <OpsView tillbaka={detaljLista ? undefined : tillbaka}>
      <div data-beskriven-app={b.id} className="flex min-w-0 w-full flex-col gap-4">
        {detaljLista && lage ? (
          <Radformular
            key={`${lage.lista}:${lage.rad?.id ?? ""}`}
            b={b}
            lista={detaljLista}
            rad={lage.rad}
            kan={lage.rad ? farAndra(lage.rad, jag) : Boolean(jag)}
            medlemmar={medlemmar}
            sprak={sprak}
            rubrik={lage.rad ? rubrikFor(detaljLista, lage.rad) : t("nyRadRubrik")}
            onStang={() => setLage(null)}
            onSpara={async (varden) => {
              if (lage.rad) await kalla.spara(lage.rad.id, varden);
              else await kalla.skapa({ lista: detaljLista.id, varden });
              if (!levande.current) return;
              setLage(null);
              await ladda();
            }}
            onTaBort={() => {
              if (lage.rad) {
                setRaderaFel("");
                setRaderar(lage.rad);
              }
            }}
          />
        ) : (
          <>
            {b.beskrivning ? <p data-beskriven-app-beskrivning="" className="m-0 text-brod text-ink-secondary">{b.beskrivning}</p> : null}
            {b.listor.length === 1 ? (
              listinnehall(b.listor[0])
            ) : (
              <OpsTabs ariaLabel={b.namn} medOrd value={flik} onChange={setFlik} tabs={flikar}>
                {b.listor.map((l) => (
                  <OpsTabPanel key={l.id} id={l.id}>
                    {listinnehall(l)}
                  </OpsTabPanel>
                ))}
              </OpsTabs>
            )}
          </>
        )}
      </div>
      <OpsModal
        open={raderar !== null}
        onOpenChange={(oppen) => {
          if (!oppen) {
            setRaderar(null);
            setRaderaFel("");
          }
        }}
        title={t("taBortTitel")}
        size="sm"
        closeLabel={t("stang")}
        footer={(
          <>
            <OpsButton variant="secondary" onClick={() => { setRaderar(null); setRaderaFel(""); }}>{t("avbryt")}</OpsButton>
            <OpsButton variant="danger" busy={raderaBusy} onClick={() => void taBort()}>{t("taBort")}</OpsButton>
          </>
        )}
      >
        <p>{raderar && detaljLista ? fyll(t("taBortFraga"), { rubrik: rubrikFor(detaljLista, raderar) }) : null}</p>
        {raderaFel ? <p role="alert">{raderaFel}</p> : null}
      </OpsModal>
    </OpsView>
  );
}

/**
 * Raderna som tabell. En tabellrad är ingen knapp (se OpsTable), så rubrikcellen är knappen som öppnar raden.
 *
 * @param {object} props
 * @param {import("../lib/beskrivenapp.js").Lista} props.lista
 * @param {import("../data/beskrivenappkalla.js").Beskrivenapprad[]} props.rader
 * @param {Parameters<typeof visaVarde>[2]} props.ctx
 * @param {(lista: import("../lib/beskrivenapp.js").Lista, rad: import("../data/beskrivenappkalla.js").Beskrivenapprad) => string} props.rubrikFor
 * @param {(rad: import("../data/beskrivenappkalla.js").Beskrivenapprad) => void} props.onOppna
 */
function Tabell({ lista, rader, ctx, rubrikFor, onOppna }) {
  // Rubrikfältet först: det är cellen som öppnar raden och den som låses vid vänsterkanten.
  const faltIOrdning = [
    ...lista.falt.filter((f) => f.id === lista.rubrikfalt),
    ...lista.falt.filter((f) => f.id !== lista.rubrikfalt),
  ];
  const kolumner = faltIOrdning.map((f) => ({ key: f.id, label: f.namn, numeric: f.typ === "tal" }));
  const rows = rader.map((rad) => {
    /** @type {Record<string, import("react").ReactNode>} */
    const celler = {};
    for (const f of faltIOrdning) {
      celler[f.id] = f.id === lista.rubrikfalt ? (
        <button
          type="button"
          data-beskriven-rad={rad.id}
          onClick={() => onOppna(rad)}
          className="min-h-11 cursor-pointer bg-transparent text-left font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {rubrikFor(lista, rad)}
        </button>
      ) : visaVarde(f, radvarde(rad, f.id), ctx);
    }
    // Radens id SIST: OpsTable nycklar raden på `row.id`, och ett fält vars id var `id` hade annars skrivit över det (dubbla nycklar).
    // Beskrivningen reserverar `id` som fält-id (`validateBeskrivning`), så det här är försvar på djupet och ingen väg att lita på.
    celler.id = rad.id;
    return celler;
  });
  return <OpsTable columns={kolumner} rows={rows} caption={lista.namn} hideCaption />;
}

/**
 * Formuläret för en rad, ur fältens typ.
 *
 * @param {object} props
 * @param {import("../lib/beskrivenapp.js").Beskrivning} props.b
 * @param {import("../lib/beskrivenapp.js").Lista} props.lista
 * @param {import("../data/beskrivenappkalla.js").Beskrivenapprad | null} props.rad `null` när raden är ny.
 * @param {boolean} props.kan Får personen spara? Annars är fälten låsta.
 * @param {ReadonlyArray<{ userId: string, namn?: string, typ?: string, status?: string }>} props.medlemmar
 * @param {string} props.sprak
 * @param {string} props.rubrik
 * @param {() => void} props.onStang
 * @param {(varden: Record<string, string | number | boolean>) => Promise<void>} props.onSpara
 * @param {() => void} props.onTaBort
 */
function Radformular({ b, lista, rad, kan, medlemmar, sprak, rubrik, onStang, onSpara, onTaBort }) {
  const t = (/** @type {keyof typeof ORD_OPSBESKRIVENAPP} */ nyckel) => ordet(ORD_OPSBESKRIVENAPP, nyckel, sprak);
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const [utkast, setUtkast] = useState(() => startvarden(lista, rad));
  const [faltfel, setFaltfel] = useState(/** @type {Record<string, string>} */ ({}));
  const [formfel, setFormfel] = useState("");
  const [busy, setBusy] = useState(false);
  // Flaggan i en ref: två tryck i samma tick ser annars båda `busy === false`.
  const sparar = useRef(false);
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);

  const valbara = personer(medlemmar);

  /** @param {string} id @param {string | boolean} v */
  const satt = (id, v) => setUtkast((u) => ({ ...u, [id]: v }));

  async function skicka() {
    if (!kan || sparar.current) return;
    sparar.current = true;
    setBusy(true);
    setFormfel("");
    /** @type {Record<string, unknown>} */
    const varden = {};
    for (const f of lista.falt) {
      const u = utkast[f.id];
      if (f.typ === "janej") varden[f.id] = u === true;
      else if (f.typ === "tal") {
        const s = typeof u === "string" ? u.trim() : "";
        if (s !== "") {
          const n = Number(s);
          // Ett tal som inte går att läsa skickas som texten, så att prövningen säger vad som är fel med det.
          varden[f.id] = Number.isFinite(n) ? n : s;
        }
      } else if (f.typ === "lank") varden[f.id] = typeof u === "string" ? normaliseraAdress(u) : "";
      else varden[f.id] = typeof u === "string" ? u : "";
    }
    const r = validateRad(b, lista.id, varden);
    if (!r.ok) {
      setFaltfel(r.faltfel);
      const utanFalt = r.fel.filter((f) => !Object.keys(r.faltfel).some((id) => f.startsWith(`varden.${id}:`)));
      setFormfel(utanFalt.length > 0 ? utanFalt.join(" ") : t("rattaFalt"));
      sparar.current = false;
      setBusy(false);
      return;
    }
    setFaltfel({});
    try {
      await onSpara(r.varden);
    } catch (e) {
      if (levande.current) setFormfel(e instanceof Error && e.message ? e.message : t("sparFel"));
    } finally {
      sparar.current = false;
      if (levande.current) setBusy(false);
    }
  }

  const skapare = rad?.skapadAv?.namn ? fyll(t("skapadAv"), { namn: kapa(rad.skapadAv.namn, MAX_SKAPARNAMN) }) : rad ? t("skaparSaknas") : "";

  return (
    <div data-beskriven-app-rad={rad?.id ?? "ny"} className="flex min-w-0 flex-col gap-4">
      <header className="flex min-w-0 flex-col gap-3">
        <TillbakaKnapp onClick={onStang} etikett={t("tillbaka")} className="self-start" />
        <h1 className="m-0 min-w-0 text-rubrik text-ink wrap-anywhere">{rubrik}</h1>
        <p className="m-0 text-meta text-ink-muted">{lista.namn}{skapare ? ` · ${skapare}` : ""}</p>
      </header>
      {!kan && rad ? <p data-beskriven-app-baralas="" className="m-0 text-meta text-ink-muted">{t("baraLas")}</p> : null}
      <form
        noValidate
        className="flex min-w-0 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void skicka();
        }}
      >
        {lista.falt.map((f) => {
          const fel = Object.hasOwn(faltfel, f.id) ? faltfel[f.id] : undefined;
          const v = utkast[f.id];
          if (f.typ === "janej") {
            return (
              <div key={f.id} className="flex flex-col gap-1">
                <OpsSwitch label={f.namn} checked={v === true} onChange={(x) => satt(f.id, x)} disabled={!kan} />
                {fel ? <p role="alert" className="m-0 text-etikett text-danger">{fel}</p> : null}
              </div>
            );
          }
          return (
            <OpsField key={f.id} label={f.namn} required={f.krav} error={fel}>
              {kontroll(f, typeof v === "string" ? v : "", (x) => satt(f.id, x), { kan, valbara, t, locale, medlemmar })}
            </OpsField>
          );
        })}
        {formfel ? (
          <p role="alert" data-beskriven-app-formfel="" className="m-0 text-brod text-danger">{formfel}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {kan ? <OpsButton type="submit" variant="primary" busy={busy}>{t("spara")}</OpsButton> : null}
          <OpsButton variant="secondary" onClick={onStang}>{kan ? t("avbryt") : t("stang")}</OpsButton>
          {kan && rad ? <OpsButton variant="danger" onClick={onTaBort}>{t("taBort")}</OpsButton> : null}
        </div>
      </form>
    </div>
  );
}

/**
 * Utkastets startvärden: text som text, ja/nej som boolean. En rad vars värde har fel typ (kvar från en tidigare beskrivning)
 * startar som texten av värdet, så personen ser vad som står och kan rätta det.
 *
 * @param {import("../lib/beskrivenapp.js").Lista} lista
 * @param {import("../data/beskrivenappkalla.js").Beskrivenapprad | null} rad
 * @returns {Record<string, string | boolean>}
 */
function startvarden(lista, rad) {
  /** @type {Record<string, string | boolean>} */
  const ut = {};
  for (const f of lista.falt) {
    const v = radvarde(rad, f.id);
    if (f.typ === "janej") ut[f.id] = v === true;
    else ut[f.id] = v === undefined || v === null ? "" : String(v);
  }
  return ut;
}

/**
 * Kontrollen för ett fält, ur dess typ. `janej` ritas av formuläret självt, med sin egen etikett.
 *
 * @param {import("../lib/beskrivenapp.js").Falt} f
 * @param {string} v
 * @param {(v: string) => void} sattV
 * @param {{ kan: boolean, valbara: ReturnType<typeof personer>, t: (nyckel: keyof typeof ORD_OPSBESKRIVENAPP) => string, locale: string, medlemmar: ReadonlyArray<{ userId: string, namn?: string }> }} k
 */
function kontroll(f, v, sattV, k) {
  const { kan, valbara, t, locale } = k;
  switch (f.typ) {
    case "langtext":
      return <OpsTextarea value={v} onChange={sattV} rows={5} maxLength={MAX_LANGTEXTVARDE} disabled={!kan} />;
    case "tal":
      return <OpsInput value={v} onChange={sattV} type="number" disabled={!kan} />;
    case "datum":
      return (
        <OpsDatePicker
          value={v || undefined}
          onChange={(iso) => sattV(iso ?? "")}
          placeholder={t("valjDatum")}
          clearLabel={t("rensaDatum")}
          locale={locale}
          disabled={!kan}
        />
      );
    case "val": {
      const alternativ = (f.val ?? []).map((x) => ({ value: x, label: x }));
      // Ett värde som inte längre är ett alternativ (beskrivningen ändrades) visas ändå, så det inte försvinner tyst.
      const saknas = v !== "" && !alternativ.some((a) => a.value === v);
      return (
        <OpsSelect
          value={v === "" ? (f.krav ? undefined : INGEN) : v}
          onChange={(x) => sattV(x === INGEN ? "" : x)}
          placeholder={t("valj")}
          disabled={!kan}
          options={[
            ...(f.krav ? [] : [{ value: INGEN, label: t("ingen") }]),
            ...(saknas ? [{ value: v, label: v }] : []),
            ...alternativ,
          ]}
        />
      );
    }
    case "person": {
      const val = valbara.map((m) => ({ value: m.userId, label: personnamn(m.namn, { saknas: t("okandMedlem") }).text }));
      const saknas = v !== "" && !val.some((a) => a.value === v);
      return (
        <OpsSelect
          value={v === "" ? (f.krav ? undefined : INGEN) : v}
          onChange={(x) => sattV(x === INGEN ? "" : x)}
          placeholder={t("valjPerson")}
          disabled={!kan}
          options={[
            ...(f.krav ? [] : [{ value: INGEN, label: t("ingen") }]),
            ...(saknas ? [{ value: v, label: t("okandMedlem") }] : []),
            ...val,
          ]}
        />
      );
    }
    case "lank":
      return <OpsInput value={v} onChange={sattV} type="url" placeholder="https://" maxLength={MAX_LANKVARDE} disabled={!kan} />;
    default:
      return <OpsInput value={v} onChange={sattV} maxLength={MAX_TEXTVARDE} disabled={!kan} />;
  }
}
