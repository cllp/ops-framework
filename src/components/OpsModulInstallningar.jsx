import { useEffect, useId, useState } from "react";
import { installningarFor, installningsVarden, sattHuvudmeny } from "../lib/modulinstallningar.js";
import { text } from "../lib/sprak.js";
import { Delrubrik, delrubrik, useInstallningspanel } from "./OpsInstallningar.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsSwitch } from "./OpsToggle.jsx";

/**
 * Inställningarna för gruppens appar, en panel för alla moduler (0.88.0).
 *
 * ══ ⛔ SAMMA PANEL FÖR VARJE MODUL ════════════════════════════════════════
 *
 * CP 2026-10-09: grunden ska vara gemensam, inte en ruta som bara Bibliotek har.
 * Varje installerad modul får ett avsnitt. Har den ett kort står "Visa i huvudmenyn"
 * först, och den skrivs till `groups.huvudmeny` via `onSparaHuvudmeny`. Modulens
 * egna fält, om den deklarerat några, skrivs via `onSpara` till samlingen appen namnger.
 *
 * ⛔ PANELEN SKRIVER INGENTING SJÄLV. Appen äger gruppen och källan. Ett saknat
 * anrop visas, det tystas inte: en brytare som inte gör något ser ut som att valet sparades.
 *
 * ⛔ `agare` KRÄVS SOM true ELLER false. Utan propen hade en ägare sett avstängda
 * brytare och trott att inställningen saknas.
 */

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_OPSMODULINSTALLNINGAR = {
  hamtar: { sv: "Hämtar appens inställningar.", en: "Loading the app settings." },
  inga: { sv: "Gruppen har inga appar installerade.", en: "The group has no apps installed." },
  tom: { sv: "Inga inställningar för den här appen.", en: "No settings for this app." },
  baraAgare: { sv: "Bara gruppens ägare ändrar de här inställningarna.", en: "Only the group's owner changes these settings." },
  huvudmenySaknas: { sv: "Huvudmenyn är inte kopplad. Ikonen ändrades inte.", en: "The main menu is not connected. The icon did not change." },
  sparandeSaknas: { sv: "Inställningarna är inte kopplade. Ingenting sparades.", en: "The settings are not connected. Nothing was saved." },
  spara: { sv: "Spara", en: "Save" },
  lista: { sv: "Appens inställningar", en: "App settings" },
};

/**
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/modul.js").Modul>} props.moduler Appens registrerade moduler.
 * @param {{ moduler: ReadonlyArray<string>, huvudmeny?: ReadonlyArray<string> | null } | null} props.grupp Den aktiva gruppen, eller null medan den läses.
 * @param {boolean} props.agare Sant bara när den inloggade är gruppens ägare.
 * @param {Readonly<Record<string, Readonly<Record<string, boolean | string>>>>} [props.sparade] Modulens egna värden, nycklat på modul-id. Pinnen läses inte härifrån.
 * @param {boolean} [props.laddar]
 * @param {string | null} [props.fel] Läsningen av de egna värdena misslyckades. Pinnen visas ändå, den kommer ur gruppen.
 * @param {(huvudmeny: string[]) => void | Promise<void>} [props.onSparaHuvudmeny]
 * @param {(inmatning: { modulId: string, varden: Record<string, boolean | string> }) => void | Promise<void>} [props.onSpara]
 */
export function OpsModulInstallningar({ moduler, grupp, agare, sparade = {}, laddar = false, fel = null, onSparaHuvudmeny, onSpara }) {
  if (typeof agare !== "boolean") {
    throw new Error("OpsModulInstallningar: agare krävs och ska vara true eller false. Utan propen ser en ägare ut som någon som bara får läsa.");
  }
  if (!Array.isArray(moduler)) {
    throw new Error("OpsModulInstallningar: moduler krävs, appens registrerade moduler. Utan listan finns inget att ställa in.");
  }
  const sprak = useOpsSprak();
  const t = (/** @type {keyof typeof ORD_OPSMODULINSTALLNINGAR} */ nyckel) => text(ORD_OPSMODULINSTALLNINGAR[nyckel], sprak);
  const installerade = (grupp?.moduler ?? [])
    .map((id) => moduler.find((m) => m.id === id))
    .filter((m) => Boolean(m));

  return (
    <div data-modulinstallningar="" className="flex flex-col gap-4">
      {fel ? <p role="alert">{fel}</p> : null}
      {laddar ? <p role="status">{t("hamtar")}</p> : null}
      {!grupp ? null : installerade.length === 0 ? (
        <p data-modulinstallningar-tom="">{t("inga")}</p>
      ) : (
        <ul aria-label={t("lista")} className="m-0 flex list-none flex-col gap-4 p-0">
          {installerade.map((modul) => (
            <li key={/** @type {import("../lib/modul.js").Modul} */ (modul).id}>
              <ModulAvsnitt
                modul={/** @type {import("../lib/modul.js").Modul} */ (modul)}
                grupp={grupp}
                agare={agare}
                sparade={sparade[/** @type {import("../lib/modul.js").Modul} */ (modul).id] ?? null}
                sprak={sprak}
                ord={t}
                onSparaHuvudmeny={onSparaHuvudmeny}
                onSpara={onSpara}
              />
            </li>
          ))}
        </ul>
      )}
      {grupp && !agare ? <p className="m-0 text-meta text-ink-muted">{t("baraAgare")}</p> : null}
    </div>
  );
}

/**
 * @param {object} props
 * @param {import("../lib/modul.js").Modul} props.modul
 * @param {{ huvudmeny?: ReadonlyArray<string> | null }} props.grupp
 * @param {boolean} props.agare
 * @param {Readonly<Record<string, boolean | string>> | null} props.sparade
 * @param {string} props.sprak
 * @param {(nyckel: keyof typeof ORD_OPSMODULINSTALLNINGAR) => string} props.ord
 * @param {(huvudmeny: string[]) => void | Promise<void>} [props.onSparaHuvudmeny]
 * @param {(inmatning: { modulId: string, varden: Record<string, boolean | string> }) => void | Promise<void>} [props.onSpara]
 */
function ModulAvsnitt({ modul, grupp, agare, sparade, sprak, ord, onSparaHuvudmeny, onSpara }) {
  const panel = useInstallningspanel();
  const rubrikId = useId();
  const namn = text(modul.namn, sprak);
  const rubriken = delrubrik(namn, rubrikId, panel);
  const falt = installningarFor(modul);
  const varden = installningsVarden({ modul, grupp, sparade });
  const egna = falt.filter((f) => f.hem === "samling");
  const [fel, setFel] = useState("");
  const [texter, setTexter] = useState(() => textUtkast(egna, varden));
  useEffect(() => {
    setTexter(textUtkast(egna, varden));
  }, [sparade]);

  const kor = (/** @type {() => void | Promise<void>} */ arbete, /** @type {string} */ saknas) => {
    setFel("");
    try {
      const svar = arbete();
      if (svar && typeof svar.then === "function") svar.catch((e) => setFel(e instanceof Error ? e.message : String(e)));
    } catch (e) {
      setFel(e instanceof Error ? e.message : String(e));
    }
    if (saknas) setFel(saknas);
  };

  return (
    <section data-modulinstallning={modul.id} aria-labelledby={rubriken.etikettId} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {modul.hubb ? (
          <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-5">
            {/** @type {import("react").ReactNode} */ (modul.hubb.ikon)}
          </span>
        ) : null}
        <Delrubrik niva={rubriken.niva} id={rubriken.etikettId === rubrikId ? rubrikId : undefined}>{namn}</Delrubrik>
      </div>
      {falt.length === 0 ? <p className="m-0 text-etikett text-ink-muted">{ord("tom")}</p> : null}
      {falt.map((f) => {
        const etikett = text(f.namn, sprak);
        const hint = f.hint ? text(f.hint, sprak) : undefined;
        if (f.typ === "boolean" && f.hem === "huvudmeny") {
          return (
            <OpsSwitch
              key={f.id}
              label={etikett}
              hint={hint}
              checked={varden[f.id] === true}
              disabled={!agare}
              onChange={(pa) => {
                if (typeof onSparaHuvudmeny !== "function") {
                  setFel(ord("huvudmenySaknas"));
                  return;
                }
                setFel("");
                const nasta = sattHuvudmeny(grupp.huvudmeny, modul.id, pa);
                try {
                  const svar = onSparaHuvudmeny(nasta);
                  if (svar && typeof svar.then === "function") svar.catch((e) => setFel(e instanceof Error ? e.message : String(e)));
                } catch (e) {
                  setFel(e instanceof Error ? e.message : String(e));
                }
              }}
            />
          );
        }
        if (f.typ === "boolean") {
          return (
            <OpsSwitch
              key={f.id}
              label={etikett}
              hint={hint}
              checked={varden[f.id] === true}
              disabled={!agare}
              onChange={(pa) => {
                if (typeof onSpara !== "function") {
                  setFel(ord("sparandeSaknas"));
                  return;
                }
                kor(() => onSpara({ modulId: modul.id, varden: { ...karta(egna, varden, texter), [f.id]: pa } }), "");
              }}
            />
          );
        }
        return (
          <OpsField key={f.id} label={etikett} hint={hint}>
            <OpsInput
              value={texter[f.id] ?? ""}
              onChange={(v) => setTexter((nu) => ({ ...nu, [f.id]: v }))}
              disabled={!agare}
            />
          </OpsField>
        );
      })}
      {fel ? <p role="alert">{fel}</p> : null}
      {agare && egna.some((f) => f.typ === "text") ? (
        <div>
          <OpsButton
            variant="secondary"
            onClick={() => {
              if (typeof onSpara !== "function") {
                setFel(ord("sparandeSaknas"));
                return;
              }
              kor(() => onSpara({ modulId: modul.id, varden: karta(egna, varden, texter) }), "");
            }}
          >
            {ord("spara")}
          </OpsButton>
        </div>
      ) : null}
    </section>
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
 * @param {ReadonlyArray<{ id: string, typ: string, hem: string }>} egna
 * @param {Record<string, boolean | string>} varden
 * @param {Record<string, string>} texter
 */
function karta(egna, varden, texter) {
  /** @type {Record<string, boolean | string>} */
  const ut = {};
  for (const f of egna) {
    ut[f.id] = f.typ === "text" ? (texter[f.id] ?? "") : varden[f.id];
  }
  return ut;
}
