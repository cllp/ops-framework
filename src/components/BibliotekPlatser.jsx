import { useId, useState } from "react";
import { Archive, ExternalLink, Pencil, Plus, RotateCcw } from "lucide-react";
import { platsnamnFel, farAndraPlats } from "../lib/platser.js";
import { trimSomRegeln } from "../lib/bibliotek.js";
import { ordet } from "../lib/ord.js";
import { radKlass } from "../lib/radKlass.js";
import { OpsAtgardsblad } from "./OpsAtgardsblad.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { sparaOchVanta } from "./BibliotekLista.jsx";

/*
 * Gruppens egna platser i Biblioteket: raden "Ny plats" i växlaren, Byt namn och Arkivera för en plats, och avsnittet Platser under kugghjulet (0.155.0, cllp/ops-framework#469).
 *
 * ⛔ SKÄRMTID: ETT VAL TILL, SOM MOTIVERAR SIG. CP 2026-10-29 saknar uttryckligen sorteringen, och Projekt-modulen behöver mekanismen ändå. Den som aldrig skapar en plats ser exakt det som syns i dag: allt här
 * ritas bara när appen skickar `egnaPlatser` till `OpsBibliotek`, och raden "Ny plats" bara när `egnaPlatser.onNy` finns. Växlaren får ett sökfält först över `PLATSER_UTAN_SOK` rader.
 *
 * ⛔ KOMPONENTERNA SKRIVER INGENTING SJÄLVA. De anropar appens `onNy`, `onByttNamn`, `onArkivera` och `onTaFram` (normalt `createPlatskalla().skapa`, `.byttNamn`, `.arkivera`, `.taFram`), väntar på löftet och
 * visar felet i formuläret eller dialogen. Ett nej är aldrig tyst (regel 5): kastar appen visas texten, och svarar den `false` visas den generella.
 *
 * ⛔ VEM SOM SER KNAPPARNA ÄR `farAndraPlats`, samma villkor som regelns `update`: den som skapade platsen, eller ägare och admin. Reglerna prövar det ändå; en knapp som nekas vid tryck är värre än ingen knapp.
 */

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_BIBLIOTEKPLATSER = {
  nyPlats: { sv: "Ny plats", en: "New place" },
  nyPlatsRubrik: { sv: "Ny plats", en: "New place" },
  namnEtikett: { sv: "Namn på platsen", en: "Name of the place" },
  namnHint: { sv: "Till exempel Demos eller Live. Alla i gruppen ser platsen.", en: "For example Demos or Live. Everyone in the group sees the place." },
  skapa: { sv: "Skapa", en: "Create" },
  avbryt: { sv: "Avbryt", en: "Cancel" },
  sokPlats: { sv: "Sök plats", en: "Search places" },
  ingenTraff: { sv: "Ingen plats matchar.", en: "No place matches." },
  valFor: { sv: "Val för platsen {namn}", en: "Options for the place {namn}" },
  bytNamn: { sv: "Byt namn", en: "Rename" },
  nyttNamn: { sv: "Nytt namn", en: "New name" },
  spara: { sv: "Spara", en: "Save" },
  arkivera: { sv: "Arkivera", en: "Archive" },
  arkiveraFraga: {
    sv: "Arkivera platsen {namn}? Den döljs i växlaren. Filerna ligger kvar, och platsen går att ta fram igen under inställningarna (kugghjulet).",
    en: "Archive the place {namn}? It is hidden from the switcher. The files stay, and the place can be restored under the settings (the cog).",
  },
  taFram: { sv: "Ta fram igen", en: "Restore" },
  skotsFran: { sv: "Sköts från {namn}", en: "Managed from {namn}" },
  skotsHint: { sv: "Namnet och arkiveringen ändras där. Filerna på platsen flyttas som vanligt.", en: "The name and archiving are changed there. Files on the place move as usual." },
  platser: { sv: "Platser", en: "Places" },
  platserHint: { sv: "Gruppens egna platser i Biblioteket. En arkiverad plats syns inte i växlaren, och filerna på den ligger kvar.", en: "The group's own places in the Library. An archived place is not in the switcher, and the files on it stay." },
  inga: { sv: "Gruppen har inga egna platser än. Skapa en under Platser i Biblioteket.", en: "The group has no places of its own yet. Create one under Places in the Library." },
  arkiverad: { sv: "Arkiverad", en: "Archived" },
  sparatInte: { sv: "Ändringen kunde inte sparas.", en: "The change could not be saved." },
  skaptInte: { sv: "Platsen kunde inte skapas.", en: "The place could not be created." },
  ejKopplad: { sv: "Platserna är inte kopplade. Ingenting ändrades.", en: "Places are not connected. Nothing was changed." },
};

/**
 * Namn och adress för modulen som förvaltar platsen. Ett modul-id appen inte beskrivit visas med id:t, så att raden aldrig är tom.
 * @param {import("../lib/platser.js").Plats} plats
 * @param {EgnaPlatser} egna
 * @returns {{ namn: string, href?: string } | null}
 */
function forvaltare(plats, egna) {
  if (!plats.forvaltas) return null;
  const id = plats.forvaltas.modul;
  const info = egna.moduler?.[id];
  return { namn: info?.namn || id || "?", ...(info?.href ? { href: info.href } : {}) };
}

/** @param {unknown} e */
const felText = (e) => (e instanceof Error && e.message ? e.message : String(e));

/**
 * @typedef {object} EgnaPlatser
 * @property {ReadonlyArray<import("../lib/platser.js").Plats>} platser Gruppens egna platser, arkiverade med (`createPlatskalla().las()` eller `prenumerera`). Arkiverade syns bara under kugghjulet.
 * @property {(inmatning: { namn: string }) => Promise<{ plats?: string } | void> | { plats?: string } | void} [onNy] Skapar en plats. Svarar den med `{ plats }` (adressen) byter biblioteket till den. Utan funktionen ritas ingen rad "Ny plats".
 * @property {(inmatning: { id: string, namn: string }) => Promise<void | boolean> | void | boolean} [onByttNamn]
 * @property {(inmatning: { id: string }) => Promise<void | boolean> | void | boolean} [onArkivera]
 * @property {(inmatning: { id: string }) => Promise<void | boolean> | void | boolean} [onTaFram]
 * @property {Record<string, { namn: string, href?: string }>} [moduler] (0.155.0) Modulerna som förvaltar platser, per modul-id (`plats.forvaltas.modul`): namnet och gärna en adress. En förvaltad plats visas som vilken som helst i växlaren, men kugghjulet har inte Byt namn och Arkivera för den: där står raden "Sköts från <namn>" (en länk när adressen finns). Ett modul-id som saknas här visas med id:t som namn.
 */

/**
 * Formuläret bakom raden "Ny plats": ett namn, validerat före anropet, med felet under fältet.
 *
 * @param {{ befintliga: ReadonlyArray<{ id: string, namn: string }>, onNy: NonNullable<EgnaPlatser["onNy"]>, onKlar: (svar: any) => void, onAvbryt: () => void, sprak: string }} props
 */
export function NyPlatsFormular({ befintliga, onNy, onKlar, onAvbryt, sprak }) {
  const t = (/** @type {keyof typeof ORD_BIBLIOTEKPLATSER} */ nyckel) => ordet(ORD_BIBLIOTEKPLATSER, nyckel, sprak);
  const [namn, setNamn] = useState("");
  const [fel, setFel] = useState("");
  const [upptagen, setUpptagen] = useState(false);
  async function skicka(/** @type {{ preventDefault?: () => void } | undefined} */ e) {
    e?.preventDefault?.();
    if (upptagen) return;
    const problem = platsnamnFel(namn, { befintliga, sprak });
    if (problem) {
      setFel(problem);
      return;
    }
    setFel("");
    setUpptagen(true);
    try {
      const svar = await onNy({ namn: trimSomRegeln(namn) });
      if (/** @type {any} */ (svar) === false) throw new Error(t("skaptInte"));
      onKlar(svar);
    } catch (err) {
      setFel(felText(err));
      setUpptagen(false);
    }
  }
  return (
    <form data-bibliotek-ny-plats="" onSubmit={skicka} className="flex flex-col gap-2 p-2">
      <OpsField label={t("namnEtikett")} hint={t("namnHint")} error={fel || undefined}>
        <OpsInput value={namn} onChange={setNamn} ariaLabel={t("namnEtikett")} maxLength={200} />
      </OpsField>
      <div className="flex justify-end gap-2">
        <OpsButton variant="secondary" size="sm" onClick={onAvbryt}>{t("avbryt")}</OpsButton>
        <OpsButton variant="primary" size="sm" type="submit" busy={upptagen} onClick={() => skicka(undefined)}>{t("skapa")}</OpsButton>
      </div>
    </form>
  );
}

/**
 * Dialogerna för Byt namn och Arkivera. Ägs av den som öppnar dem (menyn i huvudet, raden under kugghjulet), så att en plats bara har en dialog och inte en per ställe.
 *
 * @param {{ atgard: { slag: "namn" | "arkivera", plats: import("../lib/platser.js").Plats } | null, egna: EgnaPlatser, sprak: string, onStang: () => void, onKlar: (slag: "namn" | "arkivera", plats: import("../lib/platser.js").Plats) => void }} props
 */
export function PlatsDialoger({ atgard, egna, sprak, onStang, onKlar }) {
  const t = (/** @type {keyof typeof ORD_BIBLIOTEKPLATSER} */ nyckel) => ordet(ORD_BIBLIOTEKPLATSER, nyckel, sprak);
  return (
    <>
      <NamnDialog key={atgard?.slag === "namn" ? atgard.plats.id : "-"} atgard={atgard?.slag === "namn" ? atgard : null} egna={egna} sprak={sprak} t={t} onStang={onStang} onKlar={onKlar} />
      <ArkivDialog key={atgard?.slag === "arkivera" ? atgard.plats.id : "-"} atgard={atgard?.slag === "arkivera" ? atgard : null} egna={egna} sprak={sprak} t={t} onStang={onStang} onKlar={onKlar} />
    </>
  );
}

/** @param {{ atgard: { slag: "namn" | "arkivera", plats: import("../lib/platser.js").Plats } | null, egna: EgnaPlatser, sprak: string, t: (k: any) => string, onStang: () => void, onKlar: (slag: "namn" | "arkivera", plats: import("../lib/platser.js").Plats) => void }} props */
function NamnDialog({ atgard, egna, sprak, t, onStang, onKlar }) {
  const [utkast, setUtkast] = useState(atgard?.plats.namn ?? "");
  const [fel, setFel] = useState("");
  const [upptagen, setUpptagen] = useState(false);
  async function spara() {
    if (!atgard || upptagen) return;
    const problem = platsnamnFel(utkast, { befintliga: egna.platser, utom: atgard.plats.id, sprak });
    if (problem) {
      setFel(problem);
      return;
    }
    setFel("");
    setUpptagen(true);
    try {
      await sparaOchVanta(egna.onByttNamn ?? (() => { throw new Error(t("ejKopplad")); }), { id: atgard.plats.id, namn: trimSomRegeln(utkast) }, t("sparatInte"));
      onKlar("namn", atgard.plats);
    } catch (e) {
      setFel(felText(e));
      setUpptagen(false);
    }
  }
  return (
    <OpsModal
      open={atgard !== null}
      onOpenChange={(oppen) => { if (!oppen) onStang(); }}
      title={t("bytNamn")}
      size="sm"
      footer={(
        <>
          <OpsButton variant="secondary" onClick={onStang}>{t("avbryt")}</OpsButton>
          <OpsButton variant="primary" onClick={spara} busy={upptagen}>{t("spara")}</OpsButton>
        </>
      )}
    >
      <OpsField label={t("nyttNamn")} error={fel || undefined}>
        <OpsInput value={utkast} onChange={setUtkast} ariaLabel={t("nyttNamn")} maxLength={200} />
      </OpsField>
    </OpsModal>
  );
}

/** @param {{ atgard: { slag: "namn" | "arkivera", plats: import("../lib/platser.js").Plats } | null, egna: EgnaPlatser, sprak: string, t: (k: any) => string, onStang: () => void, onKlar: (slag: "namn" | "arkivera", plats: import("../lib/platser.js").Plats) => void }} props */
function ArkivDialog({ atgard, egna, t, onStang, onKlar }) {
  const [fel, setFel] = useState("");
  const [upptagen, setUpptagen] = useState(false);
  async function arkivera() {
    if (!atgard || upptagen) return;
    setFel("");
    setUpptagen(true);
    try {
      await sparaOchVanta(egna.onArkivera ?? (() => { throw new Error(t("ejKopplad")); }), { id: atgard.plats.id }, t("sparatInte"));
      onKlar("arkivera", atgard.plats);
    } catch (e) {
      setFel(felText(e));
      setUpptagen(false);
    }
  }
  return (
    <OpsModal
      open={atgard !== null}
      onOpenChange={(oppen) => { if (!oppen) onStang(); }}
      title={t("arkivera")}
      size="sm"
      footer={(
        <>
          <OpsButton variant="secondary" onClick={onStang}>{t("avbryt")}</OpsButton>
          <OpsButton variant="primary" onClick={arkivera} busy={upptagen}>{t("arkivera")}</OpsButton>
        </>
      )}
    >
      <p>{atgard ? t("arkiveraFraga").replace("{namn}", atgard.plats.namn) : ""}</p>
      {fel ? <p role="alert">{fel}</p> : null}
    </OpsModal>
  );
}

/**
 * Menyn för den plats som visas just nu, bredvid växlaren: ⋮ med Byt namn och Arkivera. Ritas bara för en egen plats som personen får ändra (`farAndraPlats`), och i övrigt inte alls.
 *
 * ⛔ EN FÖRVALTAD PLATS har inte Byt namn och Arkivera (reglerna nekar dem): där står i stället en rad "Sköts från <modulens namn>", en länk när appen gav en adress och annars en avstängd rad med skälet.
 *
 * @param {{ plats: import("../lib/platser.js").Plats, jag: any, egna: EgnaPlatser, sprak: string, onArkiverad: (plats: import("../lib/platser.js").Plats) => void, onNavigate?: (href: string, event: any) => void }} props
 */
export function PlatsMeny({ plats, jag, egna, sprak, onArkiverad, onNavigate }) {
  const t = (/** @type {keyof typeof ORD_BIBLIOTEKPLATSER} */ nyckel) => ordet(ORD_BIBLIOTEKPLATSER, nyckel, sprak);
  const [atgard, setAtgard] = useState(/** @type {null | { slag: "namn" | "arkivera", plats: import("../lib/platser.js").Plats }} */ (null));
  const forv = forvaltare(plats, egna);
  if (forv) {
    const etikett = t("skotsFran").replace("{namn}", forv.namn);
    const { href } = forv;
    /** @type {import("./OpsAtgardsblad.jsx").Atgard} */
    const rad = href
      ? { id: "plats-skots-fran", etikett, ikon: <ExternalLink size={16} aria-hidden="true" />, onValj: () => { if (typeof onNavigate === "function") onNavigate(href, undefined); else if (typeof window !== "undefined") window.location.assign(href); } }
      : { id: "plats-skots-fran", etikett, ikon: <ExternalLink size={16} aria-hidden="true" />, avstangd: true, forklaring: t("skotsHint"), onValj: () => {} };
    return (
      <span data-bibliotek-plats-meny="" data-bibliotek-plats-forvaltad="" className="inline-flex shrink-0">
        <OpsAtgardsblad namn={plats.namn} poster={[rad]} baraKnapp />
      </span>
    );
  }
  if (!farAndraPlats(plats, jag)) return null;
  /** @type {import("./OpsAtgardsblad.jsx").Atgard[]} */
  const poster = [
    ...(egna.onByttNamn ? [{ id: "plats-namn", etikett: t("bytNamn"), ikon: <Pencil size={16} aria-hidden="true" />, onValj: () => setAtgard({ slag: "namn", plats }) }] : []),
    ...(egna.onArkivera ? [{ id: "plats-arkivera", etikett: t("arkivera"), ikon: <Archive size={16} aria-hidden="true" />, onValj: () => setAtgard({ slag: "arkivera", plats }) }] : []),
  ];
  if (poster.length === 0) return null;
  return (
    <span data-bibliotek-plats-meny="" className="inline-flex shrink-0">
      <OpsAtgardsblad namn={plats.namn} poster={poster} baraKnapp />
      <PlatsDialoger
        atgard={atgard}
        egna={egna}
        sprak={sprak}
        onStang={() => setAtgard(null)}
        onKlar={(slag, p) => {
          setAtgard(null);
          if (slag === "arkivera") onArkiverad(p);
        }}
      />
    </span>
  );
}

/**
 * Avsnittet Platser under kugghjulet (modulens inställningar): alla egna platser, också de arkiverade, med Byt namn, Arkivera och Ta fram igen för dem personen får ändra. Det är hit en arkiverad plats
 * kommer tillbaka ifrån: annars kunde filerna på den aldrig nås och flyttas ut.
 *
 * @param {{ egna: EgnaPlatser, jag: any, sprak: string }} props
 */
export function PlatsInstallningar({ egna, jag, sprak }) {
  const t = (/** @type {keyof typeof ORD_BIBLIOTEKPLATSER} */ nyckel) => ordet(ORD_BIBLIOTEKPLATSER, nyckel, sprak);
  const rubrikId = useId();
  const [atgard, setAtgard] = useState(/** @type {null | { slag: "namn" | "arkivera", plats: import("../lib/platser.js").Plats }} */ (null));
  const [fel, setFel] = useState("");
  const [upptagen, setUpptagen] = useState(/** @type {string | null} */ (null));
  async function taFram(/** @type {import("../lib/platser.js").Plats} */ p) {
    if (upptagen) return;
    setFel("");
    setUpptagen(p.id);
    try {
      await sparaOchVanta(egna.onTaFram ?? (() => { throw new Error(t("ejKopplad")); }), { id: p.id }, t("sparatInte"));
    } catch (e) {
      setFel(felText(e));
    } finally {
      setUpptagen(null);
    }
  }
  return (
    <section data-bibliotek-platsinstallningar="" aria-labelledby={rubrikId} className="flex flex-col gap-2">
      <h3 id={rubrikId} className="m-0 text-etikett font-semibold text-ink">{t("platser")}</h3>
      <p className="m-0 text-meta text-ink-muted">{t("platserHint")}</p>
      {egna.platser.length === 0 ? (
        <p data-bibliotek-platser-tom="" className="m-0">{t("inga")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {egna.platser.map((p) => {
            const far = farAndraPlats(p, jag);
            const forv = forvaltare(p, egna);
            return (
              <li key={p.id} data-bibliotek-platsrad={p.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {p.namn}
                  {p.arkiverad ? <span className="ml-2 text-meta text-ink-muted">{t("arkiverad")}</span> : null}
                </span>
                {forv ? (
                  <span data-bibliotek-plats-skots="" className="shrink-0 text-meta text-ink-muted">
                    {forv.href ? (
                      <a href={forv.href} className="text-accent underline underline-offset-2">{t("skotsFran").replace("{namn}", forv.namn)}</a>
                    ) : (
                      t("skotsFran").replace("{namn}", forv.namn)
                    )}
                  </span>
                ) : far ? (
                  <span className="flex shrink-0 gap-2">
                    {egna.onByttNamn ? (
                      <OpsButton variant="secondary" size="sm" ariaLabel={`${t("bytNamn")}: ${p.namn}`} onClick={() => setAtgard({ slag: "namn", plats: p })}>{t("bytNamn")}</OpsButton>
                    ) : null}
                    {p.arkiverad ? (
                      egna.onTaFram ? (
                        <OpsButton variant="secondary" size="sm" ariaLabel={`${t("taFram")}: ${p.namn}`} busy={upptagen === p.id} onClick={() => taFram(p)}>
                          <RotateCcw size={14} aria-hidden="true" /> {t("taFram")}
                        </OpsButton>
                      ) : null
                    ) : egna.onArkivera ? (
                      <OpsButton variant="secondary" size="sm" ariaLabel={`${t("arkivera")}: ${p.namn}`} onClick={() => setAtgard({ slag: "arkivera", plats: p })}>{t("arkivera")}</OpsButton>
                    ) : null}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {fel ? <p role="alert">{fel}</p> : null}
      <PlatsDialoger atgard={atgard} egna={egna} sprak={sprak} onStang={() => setAtgard(null)} onKlar={() => setAtgard(null)} />
    </section>
  );
}

/** Raden "Ny plats" sist i växlaren. @param {{ onValj: () => void, sprak: string }} props */
export function NyPlatsRad({ onValj, sprak }) {
  return (
    <button
      type="button"
      role="menuitem"
      data-bibliotek-ny-plats-rad=""
      onClick={onValj}
      className={radKlass({ stor: true })}
    >
      <Plus size={16} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{ordet(ORD_BIBLIOTEKPLATSER, "nyPlats", sprak)}</span>
    </button>
  );
}
