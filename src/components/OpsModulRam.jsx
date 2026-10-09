import { useEffect, useId, useState } from "react";
import { arInstallningslage, flyttaId, medInstallningslage, sattModul, utanInstallningslage } from "../lib/apparark.js";
import { cx } from "../lib/cx.js";
import { formatDateTime } from "../lib/format.js";
import { lasKopplingslage } from "../lib/kopplingar.js";
import { huvudmenyInom, installningsVarden, ORD_VISA_I_HUVUDMENYN, sattHuvudmeny, VISA_I_HUVUDMENYN } from "../lib/modulinstallningar.js";
import { ordet } from "../lib/ord.js";
import { text } from "../lib/sprak.js";
import { KugghjulIkon } from "./icons.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsSectionLabel } from "./OpsSectionLabel.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsSwitch } from "./OpsToggle.jsx";
import { OpsView } from "./OpsView.jsx";
import { modulTillbaka } from "../lib/modulram.js";

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
 * Avsnitten, i ordning:
 * 1. Allmänt. På och av, Visa i huvudmenyn, ikonen, ordningen och synligheten.
 *    På, av, pinne och ordning skriver `groups.moduler` och `groups.huvudmeny`,
 *    samma fält som 0.88.0. Ikonen är manifestets och går inte att byta här:
 *    en sparad ikon hade varit en andra källa. Synligheten är det som följer
 *    av de två fälten, inte en egen behörighet.
 *    ⛔ CP 2026-10-09: de här fälten ritas bara här, inte i Redigera grupp.
 *    Gruppvyn installerar och avinstallerar, och kan länka hit.
 * 2. Kopplingar. Det modulen deklarerar. Hemligheten ritas aldrig.
 * 3. Modulens egna inställningar. Manifestets fält från 0.88.0, och därefter
 *    appens slot. Saknas båda står det att det inte finns några.
 */

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_OPSMODULRAM = {
  installningar: { sv: "Inställningar", en: "Settings" },
  oppna: { sv: "Inställningar", en: "Settings" },
  klar: { sv: "Klar", en: "Done" },
  allmant: { sv: "Allmänt", en: "General" },
  pa: { sv: "På", en: "On" },
  paHint: { sv: "Appen är installerad i gruppen.", en: "The app is installed in the group." },
  ikon: { sv: "Ikon", en: "Icon" },
  ikonText: { sv: "Appens ikon.", en: "The app's icon." },
  ordning: { sv: "Ordning", en: "Order" },
  plats: { sv: "Plats", en: "Position" },
  av: { sv: "av", en: "of" },
  upp: { sv: "Flytta upp", en: "Move up" },
  ned: { sv: "Flytta ned", en: "Move down" },
  synlighet: { sv: "Synlighet", en: "Visibility" },
  syns: { sv: "Syns för alla i gruppen.", en: "Visible to everyone in the group." },
  synsHuvud: { sv: "Syns för alla i gruppen, och i huvudmenyn.", en: "Visible to everyone in the group, and in the main menu." },
  dold: { sv: "Avstängd. Den syns inte i Appar.", en: "Off. It does not appear in Apps." },
  kopplingar: { sv: "Kopplingar", en: "Connections" },
  ingaKopplingar: { sv: "Inga kopplingar.", en: "No connections." },
  ansluten: { sv: "Ansluten", en: "Connected" },
  ejAnsluten: { sv: "Ej ansluten", en: "Not connected" },
  fel: { sv: "Fel", en: "Error" },
  anslut: { sv: "Anslut", en: "Connect" },
  kopplaFran: { sv: "Koppla från", en: "Disconnect" },
  behorigheter: { sv: "Behörigheter", en: "Permissions" },
  ingaBehorigheter: { sv: "Inga behörigheter angivna.", en: "No permissions listed." },
  senasteSynk: { sv: "Senaste synk", en: "Last sync" },
  ingenSynk: { sv: "Ingen synk.", en: "No sync." },
  egna: { sv: "Egna inställningar", en: "Own settings" },
  ingaEgna: { sv: "Inga egna inställningar.", en: "No own settings." },
  hamtar: { sv: "Hämtar inställningarna.", en: "Loading the settings." },
  baraLas: { sv: "Bara ägare och admin ändrar de här inställningarna.", en: "Only the owner and an admin change these settings." },
  ordningSaknas: { sv: "Ordningen är inte kopplad. Ingenting sparades.", en: "The order is not connected. Nothing was saved." },
  huvudmenySaknas: { sv: "Huvudmenyn är inte kopplad. Ikonen ändrades inte.", en: "The main menu is not connected. The icon did not change." },
  sparandeSaknas: { sv: "Inställningarna är inte kopplade. Ingenting sparades.", en: "The settings are not connected. Nothing was saved." },
  anslutningSaknas: { sv: "Kopplingen är inte ansluten i appen. Ingenting hände.", en: "The connection is not wired in the app. Nothing happened." },
  spara: { sv: "Spara", en: "Save" },
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
 * @param {object} props
 * @param {import("../lib/modul.js").Modul} props.modul
 * @param {string} props.activeHref
 * @param {string} props.hubHref
 * @param {string} [props.hubEtikett]
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} [props.sprak]
 * @param {ModulRam | null} [props.ram]
 * @param {string} [props.rubrikNamn] Ersätter modulens namn i rubriken. Agenter sätter agentens namn.
 * @param {import("react").ReactNode} props.children Visningen. Dold i inställningsläget.
 */
export function OpsModulRam({ modul, activeHref, hubHref, hubEtikett, onNavigate, sprak: sprakProp, ram = null, rubrikNamn, children }) {
  kravRam(ram, "OpsModulRam");
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const installningar = Boolean(ram) && arInstallningslage(activeHref);
  const namn = typeof rubrikNamn === "string" && rubrikNamn.trim() ? rubrikNamn.trim() : text(modul.namn, sprak);
  const rubrik = installningar ? `${namn} · ${ordet(ORD_OPSMODULRAM, "installningar", sprak)}` : namn;
  const visaKnapp = ram != null && (installningar || ram.farAndra);
  return (
    <OpsView
      tillbaka={{
        ...modulTillbaka({ namn: rubrik, hubHref, hubEtikett, onNavigate, sprak, modulId: modul.id }),
        ...(visaKnapp ? { atgard: (
          <ModulLageKnapp ram={ram} activeHref={activeHref} onNavigate={onNavigate} sprak={sprak} installningar={installningar} />
        ) } : {}),
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
 * @property {{ lage?: Readonly<Record<string, unknown>>, onAnslut?: (id: string) => void | Promise<void>, onKopplaFran?: (id: string) => void | Promise<void> }} [kopplingar]
 * @property {ReadonlyArray<import("../lib/kopplingar.js").Kopplingsdeklaration>} [deklarationer] När manifestet inte bär kopplingarna än (appen pinnad på en äldre ramverksversion).
 * @property {import("react").ReactNode} [egna] Modulens egen slot. Tomt läge när den saknas och manifestet inte har fält.
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
  const [fel, setFel] = useState("");
  const kor = (/** @type {() => void | Promise<void>} */ arbete, /** @type {string} */ saknas) => {
    if (saknas) {
      setFel(saknas);
      return;
    }
    setFel("");
    try {
      const svar = arbete();
      if (svar && typeof svar.then === "function") svar.catch((e) => setFel(e instanceof Error ? e.message : String(e)));
    } catch (e) {
      setFel(e instanceof Error ? e.message : String(e));
    }
  };
  const grupp = ram.grupp ?? null;
  const pa = Boolean(grupp?.moduler?.includes(modul.id));
  const lista = grupp?.moduler ?? [];
  const plats = lista.indexOf(modul.id);
  const fast = Boolean(grupp?.huvudmeny?.includes(modul.id));
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

  const skrivOrdning = (/** @type {string[]} */ nasta) => {
    kor(() => {
      if (typeof ram.onOrdning !== "function") return;
      return ram.onOrdning(nasta);
    }, typeof ram.onOrdning === "function" ? "" : t("ordningSaknas"));
  };

  return (
    <div data-modul-lage="installningar" className="flex flex-col gap-6">
      {fel ? <p role="alert">{fel}</p> : null}
      {!grupp ? <p role="status">{t("hamtar")}</p> : null}
      <section aria-labelledby={allmantId} className="flex flex-col gap-3">
        <div id={allmantId}><OpsSectionLabel>{t("allmant")}</OpsSectionLabel></div>
        <OpsSwitch
          label={t("pa")}
          hint={t("paHint")}
          checked={pa}
          disabled={!ram.farAndra || !grupp}
          onChange={(nasta) => {
            if (!grupp) return;
            const moduler = sattModul(grupp.moduler, modul.id, nasta);
            const huvud = huvudmenyInom(sattHuvudmeny(grupp.huvudmeny, modul.id, nasta ? fast : false), moduler);
            skrivOrdning(moduler);
            if (!nasta && fast) {
              kor(() => ram.onSparaHuvudmeny?.(huvud), typeof ram.onSparaHuvudmeny === "function" ? "" : t("huvudmenySaknas"));
            }
          }}
        />
        <OpsSwitch
          label={text(ORD_VISA_I_HUVUDMENYN.label, sprak)}
          hint={text(ORD_VISA_I_HUVUDMENYN.hint, sprak)}
          checked={varden[VISA_I_HUVUDMENYN] === true}
          disabled={!ram.farAndra || !grupp || !pa || !modul.hubb}
          onChange={(nasta) => {
            if (!grupp) return;
            const huvud = sattHuvudmeny(grupp.huvudmeny, modul.id, nasta);
            kor(() => ram.onSparaHuvudmeny?.(huvud), typeof ram.onSparaHuvudmeny === "function" ? "" : t("huvudmenySaknas"));
          }}
        />
        <div data-allmant="ikon" className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-xl bg-raised text-ink [&_svg]:size-6">
            {modul.hubb ? /** @type {import("react").ReactNode} */ (modul.hubb.ikon) : null}
          </span>
          <div>
            <p className="m-0 text-brod text-ink">{t("ikon")}</p>
            <p className="m-0 text-meta text-ink-muted">{t("ikonText")}</p>
          </div>
        </div>
        <div data-allmant="ordning" className="flex flex-wrap items-center gap-2">
          <p className="m-0 min-w-0 flex-1 text-brod text-ink">
            {t("ordning")}. {pa ? `${t("plats")} ${plats + 1} ${t("av")} ${lista.length}` : t("dold")}
          </p>
          <OpsButton variant="secondary" disabled={!ram.farAndra || !pa || plats <= 0} onClick={() => skrivOrdning(flyttaId(lista, modul.id, -1))}>
            {t("upp")}
          </OpsButton>
          <OpsButton variant="secondary" disabled={!ram.farAndra || !pa || plats < 0 || plats >= lista.length - 1} onClick={() => skrivOrdning(flyttaId(lista, modul.id, 1))}>
            {t("ned")}
          </OpsButton>
        </div>
        <p data-allmant="synlighet" className="m-0 text-brod text-ink">
          <span className="font-semibold">{t("synlighet")}. </span>
          {!pa ? t("dold") : fast ? t("synsHuvud") : t("syns")}
        </p>
      </section>

      <section aria-labelledby={kopplingarId} className="flex flex-col gap-3">
        <div id={kopplingarId}><OpsSectionLabel>{t("kopplingar")}</OpsSectionLabel></div>
        {deklarationer.length === 0 ? <p data-kopplingar-tom="">{t("ingaKopplingar")}</p> : null}
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {deklarationer.map((k) => {
            const lage = lasKopplingslage(ram.kopplingar?.lage?.[k.id]);
            const statusText = lage.status === "ansluten" ? t("ansluten") : lage.status === "fel" ? t("fel") : t("ejAnsluten");
            return (
              <li key={k.id} data-koppling={k.id} className="flex flex-col gap-2 rounded-base border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="m-0 text-brod font-semibold text-ink">{text(k.namn, sprak)}</p>
                    {k.hint ? <p className="m-0 text-meta text-ink-muted">{text(k.hint, sprak)}</p> : null}
                  </div>
                  <p className="m-0 text-etikett font-semibold text-ink" data-koppling-status={lage.status}>{statusText}</p>
                </div>
                <div>
                  <p className="m-0 text-meta text-ink-muted">{t("behorigheter")}</p>
                  {k.behorigheter.length === 0 ? <p className="m-0 text-brod text-ink">{t("ingaBehorigheter")}</p> : (
                    <ul className="m-0 list-disc pl-5">
                      {k.behorigheter.map((b) => <li key={b.sv}>{text(b, sprak)}</li>)}
                    </ul>
                  )}
                </div>
                <p className="m-0 text-brod text-ink">
                  {t("senasteSynk")}: {lage.senasteSynk == null ? t("ingenSynk") : formatDateTime(lage.senasteSynk, { locale: sprak === "en" ? "en" : "sv" })}
                </p>
                {lage.fel ? <p role="alert" className="m-0 text-brod text-ink">{lage.fel}</p> : null}
                {ram.farAndra ? (
                  <div>
                    {lage.status === "ansluten" || lage.status === "fel" ? (
                      <OpsButton
                        variant="secondary"
                        onClick={() => kor(() => ram.kopplingar?.onKopplaFran?.(k.id), typeof ram.kopplingar?.onKopplaFran === "function" ? "" : t("anslutningSaknas"))}
                      >
                        {t("kopplaFran")}
                      </OpsButton>
                    ) : (
                      <OpsButton
                        variant="primary"
                        onClick={() => kor(() => ram.kopplingar?.onAnslut?.(k.id), typeof ram.kopplingar?.onAnslut === "function" ? "" : t("anslutningSaknas"))}
                      >
                        {t("anslut")}
                      </OpsButton>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby={egnaId} className="flex flex-col gap-3">
        <div id={egnaId}><OpsSectionLabel>{t("egna")}</OpsSectionLabel></div>
        {egnaFalt.length === 0 && !ram.egna ? <p data-egna-tom="">{t("ingaEgna")}</p> : null}
        {egnaFalt.map((f) => {
          const etikett = text(f.namn, sprak);
          const hint = f.hint ? text(f.hint, sprak) : undefined;
          if (f.typ === "boolean") {
            return (
              <OpsSwitch
                key={f.id}
                label={etikett}
                hint={hint}
                checked={varden[f.id] === true}
                disabled={!ram.farAndra}
                onChange={(nasta) => {
                  kor(
                    () => ram.onSpara?.({ modulId: modul.id, varden: { ...karta(egnaFalt, varden, texter), [f.id]: nasta } }),
                    typeof ram.onSpara === "function" ? "" : t("sparandeSaknas"),
                  );
                }}
              />
            );
          }
          return (
            <OpsField key={f.id} label={etikett} hint={hint}>
              <OpsInput value={texter[f.id] ?? ""} onChange={(v) => setTexter((nu) => ({ ...nu, [f.id]: v }))} disabled={!ram.farAndra} />
            </OpsField>
          );
        })}
        {ram.farAndra && egnaFalt.some((f) => f.typ === "text") ? (
          <div>
            <OpsButton
              variant="secondary"
              onClick={() => kor(() => ram.onSpara?.({ modulId: modul.id, varden: karta(egnaFalt, varden, texter) }), typeof ram.onSpara === "function" ? "" : t("sparandeSaknas"))}
            >
              {t("spara")}
            </OpsButton>
          </div>
        ) : null}
        {ram.egna ?? null}
      </section>
      {grupp && !ram.farAndra ? <p className="m-0 text-meta text-ink-muted">{t("baraLas")}</p> : null}
    </div>
  );
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
 */
function karta(egna, varden, texter) {
  /** @type {Record<string, boolean | string>} */
  const ut = {};
  for (const f of egna) ut[f.id] = f.typ === "text" ? (texter[f.id] ?? "") : varden[f.id];
  return ut;
}
