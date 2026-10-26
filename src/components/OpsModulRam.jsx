import { useEffect, useId, useRef, useState } from "react";
import { arInstallningslage, flyttaId, medInstallningslage, sattModul, utanInstallningslage } from "../lib/apparark.js";
import { cx } from "../lib/cx.js";
import { formatDateTime } from "../lib/format.js";
import { lasKopplingslage } from "../lib/kopplingar.js";
import { hjalpAdress } from "../lib/modilhjalp.js";
import { huvudmenyInom, installningsVarden, ORD_VISA_I_HUVUDMENYN, sattHuvudmeny } from "../lib/modulinstallningar.js";
import { ordet } from "../lib/ord.js";
import { text } from "../lib/sprak.js";
import { ChevronHogerIkon, ChevronNedIkon, KugghjulIkon } from "./icons.jsx";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsSwitch } from "./OpsToggle.jsx";
import { OpsView } from "./OpsView.jsx";
import { modulTillbaka } from "../lib/modulram.js";
import { arKarna, medKarna } from "../lib/karna.js";

/**
 * Modulens ram: visning eller inställningar (0.89.0).
 *
 * CP 2026-10-09: varje modulsida ska ha samma ram. Kugghjulet till höger i
 * rubrikraden, bara för ägare och admin, byter till inställningar. Rubriken
 * blir "Ekonomi · Inställningar" och kugghjulet blir Klar. Läget ligger i
 * adressen (`?lage=installningar`), så ett långt tryck i app-arket kan öppna
 * det, och webbläsarens tillbaka lämnar det.
 *
 * En modul som är fäst i huvudet har ingen Tillbaka på sin förstasida. Det
 * gäller också i inställningsläget: samma `OpsHubTillbaka` med modulens id.
 *
 * Avsnitten, i ordning, som grupperade rader. Ett tomt avsnitt ritas inte.
 * 1. Allmänt. På och av, Visa i huvudmenyn, ikonen och ordningen.
 *    På, av, pinne och ordning skriver `groups.moduler` och `groups.huvudmeny`,
 *    samma fält som 0.88.0. Ikonen är manifestets och går inte att byta här:
 *    en sparad ikon hade varit en andra källa. Raden öppnar ikonen, den sparar
 *    den inte en gång till. Synligheten följer av de två fälten och skrivs inte
 *    ut som en egen mening.
 *    ⛔ CP 2026-10-09: de här fälten ritas bara här, inte i Redigera grupp.
 *    Gruppvyn installerar och avinstallerar, och kan länka hit.
 * 2. Kopplingar. Det modulen deklarerar. Hemligheten ritas aldrig. Utan
 *    deklaration ritas inte avsnittet.
 * 3. Modulens egna inställningar. Manifestets fält från 0.88.0, och därefter
 *    appens slot. Saknas båda ritas inte avsnittet.
 *    ⛔ 0.147.0: avsnitt 3 står före avsnitt 2 när appen skickar `ram.egnaForst`
 *    (en app vars egna inställning styr vilka kopplingar som visas). Utan det är
 *    ordningen som ovan.
 */

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_OPSMODULRAM = {
  installningar: { sv: "Inställningar", en: "Settings" },
  oppna: { sv: "Inställningar", en: "Settings" },
  klar: { sv: "Klar", en: "Done" },
  hjalp: { sv: "Hjälp för appen", en: "Help for the app" },
  allmant: { sv: "Allmänt", en: "General" },
  pa: { sv: "På", en: "On" },
  paHint: { sv: "Appen är installerad i gruppen.", en: "The app is installed in the group." },
  karnaHint: { sv: "Appen hör till ramverket och finns alltid i gruppen. Den går inte att stänga av.", en: "The app is part of the framework and is always in the group. It cannot be turned off." },
  ikon: { sv: "Ikon", en: "Icon" },
  ikonText: { sv: "Appens ikon.", en: "The app's icon." },
  ordning: { sv: "Ordning", en: "Order" },
  upp: { sv: "Flytta upp", en: "Move up" },
  ned: { sv: "Flytta ned", en: "Move down" },
  dold: { sv: "Avstängd. Den syns inte i Appar.", en: "Off. It does not appear in Apps." },
  kopplingar: { sv: "Kopplingar", en: "Connections" },
  ansluten: { sv: "Ansluten", en: "Connected" },
  ejAnsluten: { sv: "Ej ansluten", en: "Not connected" },
  fel: { sv: "Fel", en: "Error" },
  anslut: { sv: "Anslut", en: "Connect" },
  ansluter: { sv: "Ansluter…", en: "Connecting…" },
  kopplaFran: { sv: "Koppla från", en: "Disconnect" },
  kopplarFran: { sv: "Kopplar från…", en: "Disconnecting…" },
  behorigheter: { sv: "Behörigheter", en: "Permissions" },
  ingaBehorigheter: { sv: "Inga behörigheter angivna.", en: "No permissions listed." },
  senasteSynk: { sv: "Senaste synk", en: "Last sync" },
  ingenSynk: { sv: "Ingen synk.", en: "No sync." },
  egna: { sv: "Egna inställningar", en: "Own settings" },
  hamtar: { sv: "Hämtar inställningarna.", en: "Loading the settings." },
  baraLas: { sv: "Bara ägare och admin ändrar de här inställningarna.", en: "Only the owner and an admin change these settings." },
  ordningSaknas: { sv: "Ordningen är inte kopplad. Ingenting sparades.", en: "The order is not connected. Nothing was saved." },
  huvudmenySaknas: { sv: "Huvudmenyn är inte kopplad. Ikonen ändrades inte.", en: "The main menu is not connected. The icon did not change." },
  sparandeSaknas: { sv: "Inställningarna är inte kopplade. Ingenting sparades.", en: "The settings are not connected. Nothing was saved." },
  anslutningSaknas: { sv: "Kopplingen är inte ansluten i appen. Ingenting hände.", en: "The connection is not wired in the app. Nothing happened." },
  spara: { sv: "Spara", en: "Save" },
  sparar: { sv: "Sparar…", en: "Saving…" },
};

/**
 * @param {{ farAndra?: unknown } | null | undefined} ram
 * @param {string} vem
 */
export function kravRam(ram, vem) {
  if (ram == null) return;
  if (typeof ram !== "object") {
    throw new Error(`${vem}: ram måste vara ett objekt, eller utelämnas. Utan farAndra går det inte att veta vem som ser kugghjulet.`);
  }
  if (typeof ram.farAndra !== "boolean") {
    throw new Error(`${vem}: ram.farAndra krävs som true eller false. Utan propen ser en ägare ut som någon som bara får läsa.`);
  }
}

/**
 * Kugghjulet, eller Klar när inställningarna redan visas.
 * En medlem som öppnat läget via en länk får Klar, annars kommer hen inte ut.
 * Kugghjulet själv ritas bara när farAndra är sant.
 *
 * @param {object} props
 * @param {{ farAndra: boolean } | null | undefined} props.ram
 * @param {string} props.activeHref
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} props.sprak
 * @param {boolean} props.installningar
 */
export function ModulLageKnapp({ ram, activeHref, onNavigate, sprak, installningar }) {
  if (!ram) return null;
  if (!installningar && !ram.farAndra) return null;
  const t = (/** @type {keyof typeof ORD_OPSMODULRAM} */ nyckel) => ordet(ORD_OPSMODULRAM, nyckel, sprak);
  const mal = installningar ? utanInstallningslage(activeHref) : medInstallningslage(activeHref);
  return (
    <a
      href={mal}
      onClick={(e) => onNavigate?.(mal, e)}
      aria-label={installningar ? t("klar") : t("oppna")}
      data-modul-lage-knapp={installningar ? "klar" : "installningar"}
      className={cx(
        "inline-flex min-h-11 shrink-0 items-center justify-center rounded-base px-2 text-etikett font-semibold text-accent",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      {installningar ? t("klar") : <KugghjulIkon size={22} />}
    </a>
  );
}

/**
 * Frågetecknet som öppnar hjälpsidan på modulens avsnitt (0.92.1).
 *
 * ⛔ SAMMA UTSEENDE SOM `OpsHelp`: ring och tecken i `ink-secondary`. Det är
 * förklaringsgesten i hela appen. Här är det en länk, inte en hopfällning.
 *
 * @param {object} props
 * @param {string} props.href
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} props.sprak
 */
export function ModulHjalpKnapp({ href, onNavigate, sprak }) {
  const label = ordet(ORD_OPSMODULRAM, "hjalp", sprak);
  return (
    <a
      href={href}
      onClick={(e) => onNavigate?.(href, e)}
      aria-label={label}
      data-modul-hjalp-knapp=""
      className={cx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-base",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "inline-flex size-6 items-center justify-center rounded-full",
          "border border-ink-secondary text-etikett font-semibold text-ink-secondary",
        )}
      >
        ?
      </span>
    </a>
  );
}

/**
 * @param {object} props
 * @param {import("../lib/modul.js").Modul} props.modul
 * @param {string} props.activeHref
 * @param {string} props.hubHref
 * @param {string} [props.hubEtikett]
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} [props.sprak]
 * @param {ModulRam | null} [props.ram]
 * @param {string} [props.rubrikNamn] Ersätter modulens namn i rubriken. Agenter sätter agentens namn.
 * @param {string} [props.hjalpBas="/hjalp"] (0.92.1) Hjälpsidans adress. Frågetecknet leder hit med `#hjalp/<modulId>`.
 * @param {import("react").ReactNode} props.children Visningen. Dold i inställningsläget.
 */
export function OpsModulRam({ modul, activeHref, hubHref, hubEtikett, onNavigate, sprak: sprakProp, ram = null, rubrikNamn, hjalpBas = "/hjalp", children }) {
  kravRam(ram, "OpsModulRam");
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const installningar = Boolean(ram) && arInstallningslage(activeHref);
  const namn = typeof rubrikNamn === "string" && rubrikNamn.trim() ? rubrikNamn.trim() : text(modul.namn, sprak);
  const rubrik = installningar ? `${namn} · ${ordet(ORD_OPSMODULRAM, "installningar", sprak)}` : namn;
  const visaKnapp = ram != null && (installningar || ram.farAndra);
  const visaHjalp = Boolean(modul.hjalp) && !installningar;
  const hjalpHref = visaHjalp ? hjalpAdress(hjalpBas, modul.id) : null;
  const atgard =
    visaHjalp || visaKnapp ? (
      <span className="inline-flex items-center gap-1">
        {visaHjalp && hjalpHref ? <ModulHjalpKnapp href={hjalpHref} onNavigate={onNavigate} sprak={sprak} /> : null}
        {visaKnapp ? <ModulLageKnapp ram={ram} activeHref={activeHref} onNavigate={onNavigate} sprak={sprak} installningar={installningar} /> : null}
      </span>
    ) : null;
  return (
    <OpsView
      tillbaka={{
        ...modulTillbaka({ namn: rubrik, hubHref, hubEtikett, onNavigate, sprak, modulId: modul.id, ikon: /** @type {import("react").ReactNode} */ (modul.hubb?.ikon) }),
        ...(atgard ? { atgard } : {}),
      }}
    >
      {installningar && ram ? (ram.kropp != null ? ram.kropp : <InstallningsInnehall modul={modul} ram={ram} sprak={sprak} />) : children}
    </OpsView>
  );
}

/**
 * @typedef {object} ModulRam
 * @property {boolean} farAndra
 * @property {{ moduler: ReadonlyArray<string>, huvudmeny?: ReadonlyArray<string> | null } | null} [grupp]
 * @property {(moduler: string[]) => void | Promise<void>} [onOrdning]
 * @property {(huvudmeny: string[]) => void | Promise<void>} [onSparaHuvudmeny]
 * @property {(inmatning: { modulId: string, varden: Record<string, boolean | string> }) => void | Promise<void>} [onSpara]
 * @property {Readonly<Record<string, boolean | string>> | null} [sparade]
 * @property {{ lage?: Readonly<Record<string, unknown>>, onAnslut?: (id: string) => void | Promise<void>, onKopplaFran?: (id: string) => void | Promise<void>, kontroll?: Readonly<Record<string, import("react").ReactNode>> }} [kopplingar]
 *   `kontroll` (Ej utgivet, cllp/lifehub.app#337): appens egen kontroll per koppling, i stället för Anslut och Koppla från. Nyckeln är kopplingens id.
 *   ⛔ FÖR EN KOPPLING SOM BOR NÅGON ANNANSTANS. CP 2026-10-17 om Bank och Bokio: nyckeln kopplas i Mitt konto, och i gruppens modul väljer man
 *   bara vilken koppling och vilka konton gruppen använder, som när man väljer repo för GitHub. Ingen Anslut-knapp i modulen. Med `kontroll[id]`
 *   ritas den noden där knappen stod, för alla som ser inställningarna: appen avgör själv vad den som inte får ändra ser. Utan nyckeln är raden som förut.
 * @property {ReadonlyArray<import("../lib/kopplingar.js").Kopplingsdeklaration>} [deklarationer] När manifestet inte bär kopplingarna än (appen pinnad på en äldre ramverksversion).
 * @property {import("react").ReactNode} [egna] Modulens egen slot. Tomt läge när den saknas och manifestet inte har fält.
 * @property {boolean} [egnaForst] (0.147.0) Ritar "Egna inställningar" FÖRE Kopplingar i stället för efter. Utelämnad, eller `false`, är ordningen som förut: Allmänt, Kopplingar, Egna inställningar.
 *   ⛔ FÖR EN APP VARS EGNA INSTÄLLNING STYR VILKA KOPPLINGAR SOM FINNS. Ekonomi väljer område (Sverige, Norge) och området avgör vilka banker som kan kopplas: raden som avgör ska stå
 *   före raderna den avgör, annars väljer man bank och först därefter område. Hela avsnittet flyttas (manifestets fält, appens `egna` och Spara), ingen del för sig, så att det
 *   fortfarande bara finns ETT avsnitt med den rubriken. Ett avsnitt som inte ritas (inga fält, ingen slot) lämnar ingen tom plats efter sig, vilken ordning som än gäller.
 * @property {import("react").ReactNode} [kropp] (0.90.0) Ersätter de tre standardavsnitten. Agenter använder den: inställningarna gäller en agent, inte appens på och av. Utan den ritas standardavsnitten.
 */

/**
 * @param {object} props
 * @param {import("../lib/modul.js").Modul} props.modul
 * @param {ModulRam} props.ram
 * @param {string} props.sprak
 */
export function InstallningsInnehall({ modul, ram, sprak }) {
  const t = (/** @type {keyof typeof ORD_OPSMODULRAM} */ nyckel) => ordet(ORD_OPSMODULRAM, nyckel, sprak);
  const [litetFel, setLitetFel] = useState("");
  const sparNr = useRef(0);
  /**
   * Tummen väntade på `ram.grupp`. Appen skriver gruppen och läser sedan om
   * hela listan, och skalet ritas om först då. Trycket såg dött ut under hela
   * den väntan. Utkastet ritas i samma varv som trycket. Sparningen går i
   * bakgrunden, och ett avslag ställer tillbaka utkastet.
   *
   * ⛔ 0.141.0 (CP 2026-10-23: "Medans man kopplar måste man få en progress"): funktionen ger ett löfte som är klart när anropet är klart
   * och som ALDRIG avslås (felet är redan tillvarataget: utkastet ställs tillbaka och felraden skrivs). Knappens `onClick` ger det vidare,
   * så `OpsButton` visar en snurra medan Anslut, Koppla från och Spara väntar. Utkastet ritas fortfarande i samma varv som trycket.
   *
   * @param {() => void | Promise<void>} arbete
   * @param {() => void} aterstall
   * @returns {Promise<void>}
   */
  const bakgrund = (arbete, aterstall) => {
    const nr = ++sparNr.current;
    setLitetFel("");
    let svar;
    try {
      svar = arbete();
    } catch (e) {
      aterstall();
      setLitetFel(e instanceof Error ? e.message : String(e));
      return Promise.resolve();
    }
    return Promise.resolve(svar).then(
      () => {},
      (e) => {
        if (sparNr.current !== nr) return;
        aterstall();
        setLitetFel(e instanceof Error ? e.message : String(e));
      },
    );
  };
  const grupp = ram.grupp ?? null;
  const propModuler = Array.isArray(grupp?.moduler) ? grupp.moduler : [];
  const propHuvud = Array.isArray(grupp?.huvudmeny) ? grupp.huvudmeny : [];
  const [listor, setListor] = useState(/** @type {{ moduler: string[], huvudmeny: string[] } | null} */ (null));
  const [boolUtkast, setBoolUtkast] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [ikonOpp, setIkonOpp] = useState(false);
  // ⛔ En kärnmodul är alltid på (0.106.0, #386, `karna.js`): listan läses med den, också när den sparade saknar den.
  const moduler = listor ? listor.moduler : medKarna(propModuler, [modul]);
  const huvudmeny = listor ? listor.huvudmeny : [...propHuvud];
  const pa = moduler.includes(modul.id);
  const plats = moduler.indexOf(modul.id);
  const fast = huvudmeny.includes(modul.id);
  const deklarationer = (modul.kopplingar && modul.kopplingar.length > 0 ? modul.kopplingar : ram.deklarationer) ?? [];
  const egnaFalt = (modul.installningar ?? []).filter((f) => f.hem === "samling");
  const allmantId = useId();
  const kopplingarId = useId();
  const egnaId = useId();
  const varden = installningsVarden({ modul, grupp, sparade: ram.sparade ?? null });
  const [texter, setTexter] = useState(() => textUtkast(egnaFalt, varden));
  useEffect(() => {
    setTexter(textUtkast(egnaFalt, varden));
  }, [ram.sparade]);
  useEffect(() => {
    if (!listor) return;
    if (sammaLista(listor.moduler, propModuler) && sammaLista(listor.huvudmeny, propHuvud)) setListor(null);
  }, [grupp]);
  useEffect(() => {
    setBoolUtkast((nu) => {
      const nycklar = Object.keys(nu);
      if (nycklar.length === 0) return nu;
      const nasta = { ...nu };
      let andrad = false;
      for (const k of nycklar) {
        if (varden[k] === nu[k]) {
          delete nasta[k];
          andrad = true;
        }
      }
      return andrad ? nasta : nu;
    });
  }, [ram.sparade, grupp]);

  const visatBool = (/** @type {string} */ id, /** @type {boolean} */ franProps) => (Object.hasOwn(boolUtkast, id) ? boolUtkast[id] : franProps);

  /** @param {{ moduler: string[], huvudmeny: string[] }} nasta @param {() => void | Promise<void>} arbete */
  const sparaListor = (nasta, arbete) => {
    const fore = listor;
    setListor(nasta);
    return bakgrund(arbete, () => setListor(fore));
  };

  const ikon = modul.hubb ? /** @type {import("react").ReactNode} */ (modul.hubb.ikon) : null;

  // ⛔ 0.147.0: avsnitten är värden och inte uppställda i ritningen, så att ordningen är ETT val (`ram.egnaForst`) och inte två kopior av avsnitten.
  const kopplingarSektion = deklarationer.length === 0 ? null : (
    <section aria-labelledby={kopplingarId} className="flex flex-col gap-2">
      <Avsnittsrubrik id={kopplingarId}>{t("kopplingar")}</Avsnittsrubrik>
      <Grupp>
        {deklarationer.map((k) => {
          const lage = lasKopplingslage(ram.kopplingar?.lage?.[k.id]);
          const statusText = lage.status === "ansluten" ? t("ansluten") : lage.status === "fel" ? t("fel") : t("ejAnsluten");
          return (
            <Rad key={k.id}>
              <div data-koppling={k.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="m-0 text-etikett font-medium text-ink">{text(k.namn, sprak)}</p>
                    {k.hint ? <p className="m-0 text-etikett text-ink-muted">{text(k.hint, sprak)}</p> : null}
                  </div>
                  <p className="m-0 text-etikett font-medium text-ink" data-koppling-status={lage.status}>{statusText}</p>
                </div>
                <div>
                  <p className="m-0 text-etikett text-ink-muted">{t("behorigheter")}</p>
                  {k.behorigheter.length === 0 ? <p className="m-0 text-etikett text-ink">{t("ingaBehorigheter")}</p> : (
                    <ul className="m-0 list-disc pl-5">
                      {k.behorigheter.map((b) => <li key={b.sv}>{text(b, sprak)}</li>)}
                    </ul>
                  )}
                </div>
                <p className="m-0 text-etikett text-ink">
                  {t("senasteSynk")}: {lage.senasteSynk == null ? t("ingenSynk") : formatDateTime(lage.senasteSynk, { locale: sprak === "en" ? "en" : "sv" })}
                </p>
                {lage.fel ? <OpsBanner tone="danger" title={lage.fel} /> : null}
                {ram.kopplingar?.kontroll && Object.prototype.hasOwnProperty.call(ram.kopplingar.kontroll, k.id) ? (
                  <div data-koppling-kontroll={k.id}>{ram.kopplingar.kontroll[k.id]}</div>
                ) : ram.farAndra ? (
                  <div>
                    {lage.status === "ansluten" || lage.status === "fel" ? (
                      <OpsButton
                        variant="secondary"
                        busyLabel={t("kopplarFran")}
                        onClick={() => {
                          if (typeof ram.kopplingar?.onKopplaFran !== "function") {
                            setLitetFel(t("anslutningSaknas"));
                            return;
                          }
                          return bakgrund(() => ram.kopplingar?.onKopplaFran?.(k.id), () => {});
                        }}
                      >
                        {t("kopplaFran")}
                      </OpsButton>
                    ) : (
                      <OpsButton
                        variant="primary"
                        busyLabel={t("ansluter")}
                        onClick={() => {
                          if (typeof ram.kopplingar?.onAnslut !== "function") {
                            setLitetFel(t("anslutningSaknas"));
                            return;
                          }
                          return bakgrund(() => ram.kopplingar?.onAnslut?.(k.id), () => {});
                        }}
                      >
                        {t("anslut")}
                      </OpsButton>
                    )}
                  </div>
                ) : null}
              </div>
            </Rad>
          );
        })}
      </Grupp>
    </section>
  );

  const egnaSektion = egnaFalt.length === 0 && !ram.egna ? null : (
    <section aria-labelledby={egnaId} className="flex flex-col gap-2">
      <Avsnittsrubrik id={egnaId}>{t("egna")}</Avsnittsrubrik>
      <Grupp>
        {egnaFalt.map((f) => {
          const etikett = text(f.namn, sprak);
          const hint = f.hint ? text(f.hint, sprak) : undefined;
          if (f.typ === "boolean") {
            return (
              <Rad key={f.id}>
                <OpsSwitch
                  placering="rad"
                  label={etikett}
                  hint={hint}
                  checked={visatBool(f.id, varden[f.id] === true)}
                  disabled={!ram.farAndra}
                  onChange={(nasta) => {
                    if (typeof ram.onSpara !== "function") {
                      setLitetFel(t("sparandeSaknas"));
                      return;
                    }
                    const fore = boolUtkast[f.id];
                    setBoolUtkast((nu) => ({ ...nu, [f.id]: nasta }));
                    return bakgrund(
                      () => ram.onSpara?.({ modulId: modul.id, varden: karta(egnaFalt, varden, texter, boolUtkast, { over: { [f.id]: nasta } }) }),
                      () => setBoolUtkast((nu) => {
                        const nastaKarta = { ...nu };
                        if (fore === undefined) delete nastaKarta[f.id];
                        else nastaKarta[f.id] = fore;
                        return nastaKarta;
                      }),
                    );
                  }}
                />
              </Rad>
            );
          }
          return (
            <Rad key={f.id}>
              <div className="px-4 py-3">
                <OpsField label={etikett} hint={hint}>
                  <OpsInput value={texter[f.id] ?? ""} onChange={(v) => setTexter((nu) => ({ ...nu, [f.id]: v }))} disabled={!ram.farAndra} />
                </OpsField>
              </div>
            </Rad>
          );
        })}
        {ram.egna ? <Rad><div className="px-4 py-3">{ram.egna}</div></Rad> : null}
      </Grupp>
      {ram.farAndra && egnaFalt.some((f) => f.typ === "text") ? (
        <div>
          <OpsButton
            variant="secondary"
            busyLabel={t("sparar")}
            onClick={() => {
              if (typeof ram.onSpara !== "function") {
                setLitetFel(t("sparandeSaknas"));
                return;
              }
              return bakgrund(() => ram.onSpara?.({ modulId: modul.id, varden: karta(egnaFalt, varden, texter, boolUtkast) }), () => {});
            }}
          >
            {t("spara")}
          </OpsButton>
        </div>
      ) : null}
    </section>
  );

  return (
    <div data-modul-lage="installningar" className="flex flex-col gap-6">
      {litetFel ? <p role="alert" data-installning-fel="" className="m-0 text-etikett text-danger">{litetFel}</p> : null}
      {!grupp ? <p role="status">{t("hamtar")}</p> : null}
      <section aria-labelledby={allmantId} className="flex flex-col gap-2">
        <Avsnittsrubrik id={allmantId}>{t("allmant")}</Avsnittsrubrik>
        <Grupp>
          <Rad>
            <OpsSwitch
              placering="rad"
              label={t("pa")}
              hint={arKarna(modul) ? t("karnaHint") : t("paHint")}
              checked={pa}
              disabled={!ram.farAndra || !grupp || arKarna(modul)}
              onChange={(nasta) => {
                if (!grupp) return;
                if (typeof ram.onOrdning !== "function") {
                  setLitetFel(t("ordningSaknas"));
                  return;
                }
                const nastaModuler = sattModul(moduler, modul.id, nasta);
                const nastaHuvud = huvudmenyInom(sattHuvudmeny(huvudmeny, modul.id, nasta ? fast : false), nastaModuler);
                return sparaListor({ moduler: nastaModuler, huvudmeny: nastaHuvud }, () => {
                  const jobb = [];
                  const a = ram.onOrdning?.(nastaModuler);
                  if (a) jobb.push(Promise.resolve(a));
                  if (!nasta && fast) {
                    if (typeof ram.onSparaHuvudmeny !== "function") throw new Error(t("huvudmenySaknas"));
                    const b = ram.onSparaHuvudmeny(nastaHuvud);
                    if (b) jobb.push(Promise.resolve(b));
                  }
                  return Promise.all(jobb).then(() => {});
                });
              }}
            />
          </Rad>
          <Rad>
            <OpsSwitch
              placering="rad"
              label={text(ORD_VISA_I_HUVUDMENYN.label, sprak)}
              hint={text(ORD_VISA_I_HUVUDMENYN.hint, sprak)}
              checked={fast}
              disabled={!ram.farAndra || !grupp || !pa || !modul.hubb}
              onChange={(nasta) => {
                if (!grupp) return;
                if (typeof ram.onSparaHuvudmeny !== "function") {
                  setLitetFel(t("huvudmenySaknas"));
                  return;
                }
                const nastaHuvud = sattHuvudmeny(huvudmeny, modul.id, nasta);
                return sparaListor({ moduler, huvudmeny: nastaHuvud }, () => {
                  const b = ram.onSparaHuvudmeny?.(nastaHuvud);
                  return b ? Promise.resolve(b).then(() => {}) : undefined;
                });
              }}
            />
          </Rad>
          <Rad>
            <button
              type="button"
              data-allmant="ikon"
              aria-expanded={ikonOpp}
              onClick={() => setIkonOpp((v) => !v)}
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-raised text-ink [&_svg]:size-4">{ikon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-etikett text-ink">{t("ikon")}</span>
                <span className="mt-0.5 block text-etikett text-ink-muted">{t("ikonText")}</span>
              </span>
              <span aria-hidden="true" className={cx("inline-flex shrink-0 text-ink-muted", ikonOpp && "rotate-90")}>
                <ChevronHogerIkon size={18} />
              </span>
            </button>
            {ikonOpp ? (
              <div data-ikon-opp="" className="flex justify-center px-4 pb-4">
                <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-xl bg-raised text-ink [&_svg]:size-8">{ikon}</span>
              </div>
            ) : null}
          </Rad>
          <Rad>
            <div data-allmant="ordning" className="flex min-h-11 items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-etikett text-ink">{t("ordning")}</span>
                {!pa ? <span className="mt-0.5 block text-etikett text-ink-muted">{t("dold")}</span> : null}
              </span>
              <span className="flex shrink-0 items-center">
                <IkonKnapp
                  etikett={t("upp")}
                  disabled={!ram.farAndra || !pa || plats <= 0}
                  onClick={() => {
                    if (typeof ram.onOrdning !== "function") {
                      setLitetFel(t("ordningSaknas"));
                      return;
                    }
                    const nasta = flyttaId(moduler, modul.id, -1);
                    sparaListor({ moduler: nasta, huvudmeny }, () => {
                      const a = ram.onOrdning?.(nasta);
                      return a ? Promise.resolve(a).then(() => {}) : undefined;
                    });
                  }}
                >
                  <span className="flex rotate-180"><ChevronNedIkon size={18} /></span>
                </IkonKnapp>
                <span data-ordning-plats="" className="min-w-10 text-center text-etikett tabular-nums text-ink">{plats >= 0 ? `${plats + 1}/${moduler.length}` : "-"}</span>
                <IkonKnapp
                  etikett={t("ned")}
                  disabled={!ram.farAndra || !pa || plats < 0 || plats >= moduler.length - 1}
                  onClick={() => {
                    if (typeof ram.onOrdning !== "function") {
                      setLitetFel(t("ordningSaknas"));
                      return;
                    }
                    const nasta = flyttaId(moduler, modul.id, 1);
                    sparaListor({ moduler: nasta, huvudmeny }, () => {
                      const a = ram.onOrdning?.(nasta);
                      return a ? Promise.resolve(a).then(() => {}) : undefined;
                    });
                  }}
                >
                  <ChevronNedIkon size={18} />
                </IkonKnapp>
              </span>
            </div>
          </Rad>
        </Grupp>
      </section>

      {ram.egnaForst === true ? egnaSektion : null}
      {kopplingarSektion}
      {ram.egnaForst === true ? null : egnaSektion}
      {grupp && !ram.farAndra ? <p className="m-0 text-meta text-ink-muted">{t("baraLas")}</p> : null}
    </div>
  );
}

/** @param {{ id: string, children: import("react").ReactNode }} props */
function Avsnittsrubrik({ id, children }) {
  return <h2 id={id} className="m-0 px-1 text-sektion uppercase text-accent">{children}</h2>;
}

/** @param {{ children: import("react").ReactNode }} props */
function Grupp({ children }) {
  return (
    <div className="overflow-hidden rounded-xl bg-surface">
      <ul className="m-0 list-none p-0">{children}</ul>
    </div>
  );
}

/** @param {{ children: import("react").ReactNode }} props */
function Rad({ children }) {
  return <li className="border-b border-line last:border-b-0">{children}</li>;
}

/** @param {{ etikett: string, disabled?: boolean, onClick: () => void, children: import("react").ReactNode }} props */
function IkonKnapp({ etikett, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={etikett}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-11 cursor-pointer items-center justify-center rounded-base text-ink transition-colors duration-(--duration-fast) ease-standard hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/**
 * @param {ReadonlyArray<string>} a
 * @param {ReadonlyArray<string>} b
 */
function sammaLista(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * @param {ReadonlyArray<{ id: string, typ: string }>} egna
 * @param {Record<string, boolean | string>} varden
 */
function textUtkast(egna, varden) {
  /** @type {Record<string, string>} */
  const ut = {};
  for (const f of egna) {
    if (f.typ === "text") ut[f.id] = typeof varden[f.id] === "string" ? /** @type {string} */ (varden[f.id]) : "";
  }
  return ut;
}

/**
 * @param {ReadonlyArray<{ id: string, typ: string }>} egna
 * @param {Record<string, boolean | string>} varden
 * @param {Record<string, string>} texter
 * @param {Record<string, boolean>} [boolUtkast]
 * @param {{ over?: Record<string, boolean> }} [extra]
 */
function karta(egna, varden, texter, boolUtkast = {}, extra = {}) {
  /** @type {Record<string, boolean | string>} */
  const ut = {};
  for (const f of egna) {
    if (f.typ === "text") ut[f.id] = texter[f.id] ?? "";
    else if (extra.over && Object.hasOwn(extra.over, f.id)) ut[f.id] = extra.over[f.id];
    else if (Object.hasOwn(boolUtkast, f.id)) ut[f.id] = boolUtkast[f.id];
    else ut[f.id] = varden[f.id];
  }
  return ut;
}
