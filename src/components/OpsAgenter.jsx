import { useEffect, useId, useState } from "react";
import { agentIHref, agentInstallningsHref, AGENTER_ID } from "../lib/agenter.js";
import { arInstallningslage } from "../lib/apparark.js";
import { ordet } from "../lib/ord.js";
import { AgentIkon } from "./icons.jsx";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsCard } from "./OpsCard.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField, OpsInput, OpsTextarea } from "./OpsField.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsModulRam } from "./OpsModulRam.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsSwitch } from "./OpsToggle.jsx";

/**
 * Modulen Agenter (0.90.0).
 *
 * CP hittar agentens inställningar för långt från samtalet. Visningen listar
 * gruppens agenter. Kugghjulet, och ett tryck på agenten i chatten, öppnar
 * inställningarna för just den agenten: Allmänt, Kopplingar och egna.
 *
 * ⛔ INGEN EGEN LAGRING. Namn, roll, verktyg, minne och skills är fält appen
 * redan sparar. Modellen är den appen redan anropar. Nyckeln ritas av appens
 * valv och skrivs aldrig här. En andra samling hade glidit isär från den första.
 *
 * ⛔ GRÄNSERNA KOMMER IN. Talen bor i appens validering. En kopia här hade
 * varit en andra sanning den dagen taket ändras.
 */

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_OPSAGENTER = {
  tom: { sv: "Gruppen har ingen agent.", en: "The group has no agent." },
  lasfel: { sv: "Agenterna gick inte att läsa.", en: "The agents could not be read." },
  lista: { sv: "Gruppens agenter", en: "The group's agents" },
  oppna: { sv: "Öppna inställningar för", en: "Open settings for" },
  installningar: { sv: "Inställningar", en: "Settings" },
  ingenRoll: { sv: "Ingen roll.", en: "No role." },
  ingenBeskrivning: { sv: "Ingen beskrivning.", en: "No description." },
  lasRubrik: { sv: "Skrivskyddad", en: "Read only" },
  aktiv: { sv: "På", en: "On" },
  avstangd: { sv: "Avstängd", en: "Off" },
  skrivTill: { sv: "Skriv till", en: "Write to" },
  valj: { sv: "Välj en agent", en: "Choose an agent" },
  valjText: { sv: "Inställningarna gäller en agent i taget.", en: "The settings apply to one agent at a time." },
  horInte: { sv: "Agenten hör inte till gruppen.", en: "The agent does not belong to the group." },
  hamtar: { sv: "Hämtar inställningarna.", en: "Loading the settings." },
  saknasRubrik: { sv: "Inga inställningar ännu", en: "No settings yet" },
  saknas: { sv: "Agenten har inga egna inställningar. Utan dem svarar den som i dag.", en: "The agent has no settings of its own. Without them it answers as it does today." },
  lasfelRubrik: { sv: "Inställningarna gick inte att läsa", en: "The settings could not be read" },
  sparfelRubrik: { sv: "Ändringen sparades inte", en: "The change was not saved" },
  skrivskyddad: { sv: "Du kan läsa inställningarna. Bara ägare och admin kan ändra dem.", en: "You can read the settings. Only the owner and an admin can change them." },
  allmant: { sv: "Allmänt", en: "General" },
  namn: { sv: "Namn", en: "Name" },
  roll: { sv: "Roll", en: "Role" },
  beskrivning: { sv: "Beskrivning", en: "Description" },
  ikon: { sv: "Ikon", en: "Icon" },
  ikonText: { sv: "Agentens märke. Det sparas inte en gång till.", en: "The agent's mark. It is not stored a second time." },
  pa: { sv: "Agenten är på", en: "The agent is on" },
  paHint: { sv: "Avstängd svarar den inte, varken i gruppchatten eller privat.", en: "When off it does not reply, neither in the group chat nor in private." },
  sparaIdentitet: { sv: "Spara allmänt", en: "Save general" },
  kopplingar: { sv: "Kopplingar", en: "Connections" },
  modell: { sv: "Modell", en: "Model" },
  ingenModell: { sv: "Ingen modell angiven.", en: "No model given." },
  nycklar: { sv: "Nycklar", en: "Keys" },
  nycklarText: { sv: "Nycklarna ligger i kontot. De sparas inte bland agentens inställningar.", en: "The keys stay in the account. They are not stored with the agent's settings." },
  nycklarSaknas: { sv: "Nycklarna är inte kopplade i appen.", en: "The keys are not wired in the app." },
  verktyg: { sv: "Verktyg", en: "Tools" },
  ingaVerktyg: { sv: "Inga verktyg.", en: "No tools." },
  sparaVerktyg: { sv: "Spara verktyg", en: "Save tools" },
  egna: { sv: "Egna inställningar", en: "Own settings" },
  instruktioner: { sv: "Instruktioner", en: "Instructions" },
  instruktionerHint: { sv: "Vad agenten ska göra i den här gruppen.", en: "What the agent should do in this group." },
  ingaInstruktioner: { sv: "Inga instruktioner.", en: "No instructions." },
  sparaInstruktioner: { sv: "Spara instruktioner", en: "Save instructions" },
  behorigheter: { sv: "Vad agenten får göra", en: "What the agent may do" },
  behorigheterText: { sv: "Kunskapen nedan, och verktygen under Kopplingar, är det agenten får använda.", en: "The knowledge below, and the tools under Connections, are what the agent may use." },
  ingaSkills: { sv: "Ingen kunskap tillagd.", en: "No knowledge added." },
  text: { sv: "Text", en: "Text" },
  alltidMed: { sv: "Alltid med", en: "Always included" },
  publik: { sv: "Får nämnas i ärenden", en: "May be mentioned in cases" },
  publikHint: { sv: "Av betyder att texten stannar i appen. På betyder att den får följa med när agenten svarar i ett ärende.", en: "Off means the text stays in the app. On means it may follow when the agent replies in a case." },
  sparaSkill: { sv: "Spara kunskap", en: "Save knowledge" },
  nySkill: { sv: "Ny kunskap", en: "New knowledge" },
  redigera: { sv: "Redigera", en: "Edit" },
  taBort: { sv: "Ta bort", en: "Remove" },
  importera: { sv: "Importera en fil", en: "Import a file" },
  importeraHint: { sv: "Första raden ska vara ---, och fälten name och description ska stå där.", en: "The first line should be ---, and the fields name and description should be there." },
  minne: { sv: "Minne", en: "Memory" },
  anvandMinne: { sv: "Använd minnet i svaren", en: "Use memory in replies" },
  minnetPa: { sv: "Minnet är på.", en: "Memory is on." },
  minnetAv: { sv: "Minnet är av.", en: "Memory is off." },
  ingetMinne: { sv: "Inget minne.", en: "No memory." },
  nyMinnesrad: { sv: "Ny minnesrad", en: "New memory line" },
  sparaMinne: { sv: "Spara minne", en: "Save memory" },
  sparandeSaknas: { sv: "Sparandet är inte kopplat. Ingenting sparades.", en: "Saving is not connected. Nothing was saved." },
  importSaknas: { sv: "Importen är inte kopplad. Filen lästes inte.", en: "Import is not connected. The file was not read." },
  filLasFel: { sv: "Filen lästes inte", en: "The file was not read" },
};

const GRANSER = ["namn", "beskrivning", "roll", "instruktioner", "minne", "skillNamn", "skillBeskrivning", "skillText"];

/**
 * Manifestet, så att id, namn och kort har ett hem.
 *
 * ⛔ INGEN SAMLING. Appen äger dokumentet. Kortet gör att modulen syns i Appar.
 *
 * @returns {Record<string, any>} Råmanifestet. Appen kör det genom `validateModuler`.
 */
export function agenterManifest() {
  const ikon = <AgentIkon size={20} />;
  return {
    id: AGENTER_ID,
    namn: { sv: "Agenter", en: "Agents" },
    nav: [],
    routes: [],
    samlingar: [],
    kallor: {},
    skapar: [],
    hubb: {
      ikon,
      rutt: "/agenter",
      startsida: "lista",
      delar: [{ id: "lista", namn: { sv: "Agenter", en: "Agents" }, ikon, rutt: "/agenter/lista" }],
    },
  };
}

/**
 * @param {unknown} granser
 * @returns {Record<string, number>}
 */
function kravGranser(granser) {
  if (!granser || typeof granser !== "object") {
    throw new Error("OpsAgenter: granser krävs. Talen bor i appens validering, och vyn kopierar dem inte.");
  }
  const o = /** @type {Record<string, unknown>} */ (granser);
  for (const k of GRANSER) {
    if (typeof o[k] !== "number" || o[k] < 1) {
      throw new Error(`OpsAgenter: granser.${k} krävs som ett tal större än noll.`);
    }
  }
  return /** @type {Record<string, number>} */ (o);
}

/**
 * @param {object} props
 * @param {import("../lib/modul.js").Modul} props.modul
 * @param {string} props.activeHref
 * @param {string} props.hubHref
 * @param {string} [props.hubEtikett]
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} [props.sprak]
 * @param {import("./OpsModulRam.jsx").ModulRam | null} [props.ram]
 * @param {ReadonlyArray<{ id: string, namn: string, status?: string, bild?: string }>} props.agenter
 * @param {"laddar" | "saknas" | "finns" | "fel" | "tom"} [props.status]
 * @param {string} [props.fel]
 * @param {string} [props.sparfel]
 * @param {boolean} [props.sparar]
 * @param {{ namn?: string, beskrivning?: string, roll?: string, instruktioner?: string, minnePa?: boolean, version?: number } | null} [props.installning]
 * @param {ReadonlyArray<{ id: string, namn: string, beskrivning?: string, text?: string, aktiv?: boolean, alltidMed?: boolean, publik?: boolean, kalla?: string }>} [props.skills]
 * @param {ReadonlyArray<{ namn: string, beskrivning?: string, not?: string, pa: boolean }>} [props.verktyg]
 * @param {ReadonlyArray<{ id: string, text: string }>} [props.minne]
 * @param {{ namn: string, hint?: string } | null} [props.modell]
 * @param {import("react").ReactNode} [props.byok] Appens valv. Ramverket ritar inte nyckeln.
 * @param {Record<string, number>} props.granser
 * @param {(v: { namn: string, beskrivning: string, roll: string }) => void | Promise<void>} [props.onSparaIdentitet]
 * @param {(text: string) => void | Promise<void>} [props.onSparaInstruktioner]
 * @param {(karta: Record<string, boolean>) => void | Promise<void>} [props.onSparaVerktyg]
 * @param {(pa: boolean) => void | Promise<void>} [props.onSparaMinnePa]
 * @param {(s: { namn: string, beskrivning: string, text: string, aktiv: boolean, alltidMed: boolean, publik: boolean, kalla?: string, ersatter?: string }) => void | Promise<void>} [props.onSparaSkill]
 * @param {(id: string) => void | Promise<void>} [props.onTaBortSkill]
 * @param {(text: string) => void | Promise<void>} [props.onSparaMinne]
 * @param {(id: string) => void | Promise<void>} [props.onTaBortMinne]
 * @param {(text: string) => { namn: string, beskrivning: string, text: string } | { fel: string }} [props.onLasSkill]
 * @param {(b: { id: string, status: "aktiv" | "avstangd" }) => void | Promise<void>} [props.onVaxla]
 * @param {boolean} [props.kanVaxla]
 * @param {(id: string) => void} [props.onSkrivTill]
 * @param {string} [props.listfel] När listan inte gick att läsa. Tom sträng betyder att listan är läst, och en tom lista är då noll agenter.
 */
export function OpsAgenter({
  modul,
  activeHref,
  hubHref,
  hubEtikett,
  onNavigate,
  sprak: sprakProp,
  ram = null,
  agenter,
  status = "finns",
  fel = "",
  sparfel = "",
  sparar = false,
  installning = null,
  skills = [],
  verktyg = [],
  minne = [],
  modell = null,
  byok = null,
  granser,
  onSparaIdentitet,
  onSparaInstruktioner,
  onSparaVerktyg,
  onSparaMinnePa,
  onSparaSkill,
  onTaBortSkill,
  onSparaMinne,
  onTaBortMinne,
  onLasSkill,
  onVaxla,
  kanVaxla = false,
  onSkrivTill,
  listfel = "",
}) {
  const sprakKontext = useOpsSprak();
  if (!Array.isArray(agenter)) {
    throw new Error("OpsAgenter: agenter krävs som en lista. En tom lista är ett svar, en utelämnad prop är det inte.");
  }
  const tak = kravGranser(granser);
  const sprak = sprakProp ?? sprakKontext;
  const t = (/** @type {keyof typeof ORD_OPSAGENTER} */ nyckel) => ordet(ORD_OPSAGENTER, nyckel, sprak);
  const agentId = agentIHref(activeHref);
  const vald = agenter.find((a) => a.id === agentId) ?? null;
  const installningar = Boolean(ram) && arInstallningslage(activeHref);
  const kropp = installningar ? (
    <AgentKropp
      key={`${agentId}:${installning?.version ?? 0}:${skills.length}:${minne.length}`}
      t={t}
      agenter={agenter}
      vald={vald}
      activeHref={activeHref}
      onNavigate={onNavigate}
      status={status}
      fel={fel}
      sparfel={sparfel}
      sparar={sparar}
      installning={installning}
      skills={skills}
      verktyg={verktyg}
      minne={minne}
      modell={modell}
      byok={byok}
      granser={tak}
      farAndra={ram?.farAndra === true}
      onSparaIdentitet={onSparaIdentitet}
      onSparaInstruktioner={onSparaInstruktioner}
      onSparaVerktyg={onSparaVerktyg}
      onSparaMinnePa={onSparaMinnePa}
      onSparaSkill={onSparaSkill}
      onTaBortSkill={onTaBortSkill}
      onSparaMinne={onSparaMinne}
      onTaBortMinne={onTaBortMinne}
      onLasSkill={onLasSkill}
      onVaxla={onVaxla}
      kanVaxla={kanVaxla}
    />
  ) : undefined;

  return (
    <OpsModulRam
      modul={modul}
      activeHref={activeHref}
      hubHref={hubHref}
      hubEtikett={hubEtikett}
      onNavigate={onNavigate}
      sprak={sprak}
      rubrikNamn={installningar && vald?.namn ? vald.namn : undefined}
      ram={ram ? { ...ram, kropp } : null}
    >
      <AgentLista t={t} agenter={agenter} activeHref={activeHref} onNavigate={onNavigate} onSkrivTill={onSkrivTill} listfel={listfel} />
    </OpsModulRam>
  );
}

/**
 * @param {object} props
 * @param {(nyckel: keyof typeof ORD_OPSAGENTER) => string} props.t
 * @param {ReadonlyArray<{ id: string, namn: string, status?: string, bild?: string }>} props.agenter
 * @param {string} props.activeHref
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {(id: string) => void} [props.onSkrivTill]
 * @param {string} [props.listfel]
 */
function AgentLista({ t, agenter, activeHref, onNavigate, onSkrivTill, listfel = "" }) {
  if (listfel) {
    return (
      <div data-agenter-lasfel="">
        <OpsBanner tone="danger" title={listfel} />
      </div>
    );
  }
  if (agenter.length === 0) {
    return <p data-agenter-tom="" className="m-0 text-etikett text-ink">{t("tom")}</p>;
  }
  return (
    <ul aria-label={t("lista")} data-agenter-lista="" className="m-0 flex list-none flex-col gap-2 p-0">
      {agenter.map((a) => {
        const namn = a.namn || "Agent";
        const href = agentInstallningsHref(activeHref, a.id);
        const aktiv = a.status !== "avstangd";
        return (
          <li key={a.id} data-agent={a.id} className="flex flex-col gap-1 rounded-base border border-line p-3">
            <div className="flex items-center gap-3">
              <OpsIdentity name={namn} seed={a.id} imageUrl={a.bild || undefined} icon={AgentIkon} size="medlem" rund />
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-brod text-ink">{namn}</p>
                <p className="m-0 text-meta text-ink-muted">{aktiv ? t("aktiv") : t("avstangd")}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={href}
                data-agent-installningar={a.id}
                aria-label={`${t("oppna")} ${namn}`}
                onClick={(e) => onNavigate?.(href, e)}
                className="inline-flex min-h-11 items-center rounded-base text-etikett font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {t("installningar")}
              </a>
              {aktiv && onSkrivTill ? (
                <OpsButton onClick={() => onSkrivTill(a.id)}>{t("skrivTill")}</OpsButton>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * @param {object} props
 * @param {(nyckel: keyof typeof ORD_OPSAGENTER) => string} props.t
 * @param {ReadonlyArray<{ id: string, namn: string, status?: string, bild?: string }>} props.agenter
 * @param {{ id: string, namn: string, status?: string, bild?: string } | null} props.vald
 * @param {string} props.activeHref
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {"laddar" | "saknas" | "finns" | "fel" | "tom"} props.status
 * @param {string} props.fel
 * @param {string} props.sparfel
 * @param {boolean} props.sparar
 * @param {{ namn?: string, beskrivning?: string, roll?: string, instruktioner?: string, minnePa?: boolean } | null} props.installning
 * @param {ReadonlyArray<{ id: string, namn: string, beskrivning?: string, text?: string, aktiv?: boolean, alltidMed?: boolean, publik?: boolean, kalla?: string }>} props.skills
 * @param {ReadonlyArray<{ namn: string, beskrivning?: string, not?: string, pa: boolean }>} props.verktyg
 * @param {ReadonlyArray<{ id: string, text: string }>} props.minne
 * @param {{ namn: string, hint?: string } | null} props.modell
 * @param {import("react").ReactNode} props.byok
 * @param {Record<string, number>} props.granser
 * @param {boolean} props.farAndra
 * @param {Function} [props.onSparaIdentitet]
 * @param {Function} [props.onSparaInstruktioner]
 * @param {Function} [props.onSparaVerktyg]
 * @param {Function} [props.onSparaMinnePa]
 * @param {Function} [props.onSparaSkill]
 * @param {Function} [props.onTaBortSkill]
 * @param {Function} [props.onSparaMinne]
 * @param {Function} [props.onTaBortMinne]
 * @param {(text: string) => { namn: string, beskrivning: string, text: string } | { fel: string }} [props.onLasSkill]
 * @param {Function} [props.onVaxla]
 * @param {boolean} props.kanVaxla
 */
function AgentKropp({
  t, agenter, vald, activeHref, onNavigate, status, fel, sparfel, sparar, installning, skills, verktyg, minne, modell, byok, granser, farAndra,
  onSparaIdentitet, onSparaInstruktioner, onSparaVerktyg, onSparaMinnePa, onSparaSkill, onTaBortSkill, onSparaMinne, onTaBortMinne, onLasSkill, onVaxla, kanVaxla,
}) {
  if (!vald) {
    return (
      <div data-modul-lage="installningar" className="flex flex-col gap-3">
        <p className="m-0 text-brod text-ink">{agenter.length === 0 ? t("tom") : agentIHref(activeHref) ? t("horInte") : t("valjText")}</p>
        {agenter.length > 0 && !agentIHref(activeHref) ? (
          <ul aria-label={t("valj")} className="m-0 flex list-none flex-col gap-2 p-0">
            {agenter.map((a) => {
              const href = agentInstallningsHref(activeHref, a.id);
              const namn = a.namn || "Agent";
              return (
                <li key={a.id}>
                  <a
                    href={href}
                    data-agent-val={a.id}
                    onClick={(e) => onNavigate?.(href, e)}
                    className="inline-flex min-h-11 items-center text-etikett font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {namn}
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div data-modul-lage="installningar" data-agent-installningar={vald.id} className="flex flex-col gap-6">
      {farAndra ? null : <OpsBanner tone="info" title={t("lasRubrik")}>{t("skrivskyddad")}</OpsBanner>}
      {status === "saknas" ? <OpsBanner tone="info" title={t("saknasRubrik")}>{t("saknas")}</OpsBanner> : null}
      {status === "fel" ? <OpsBanner tone="danger" title={t("lasfelRubrik")}>{fel}</OpsBanner> : null}
      {sparfel ? <OpsBanner tone="danger" title={t("sparfelRubrik")}>{sparfel}</OpsBanner> : null}
      {status === "laddar" ? <OpsEmpty title={t("hamtar")} busy busyLabel={t("hamtar")} /> : (
        <AgentFalt
          t={t}
          vald={vald}
          installning={installning}
          skills={skills}
          verktyg={verktyg}
          minne={minne}
          modell={modell}
          byok={byok}
          granser={granser}
          farAndra={farAndra}
          sparar={sparar}
          onSparaIdentitet={onSparaIdentitet}
          onSparaInstruktioner={onSparaInstruktioner}
          onSparaVerktyg={onSparaVerktyg}
          onSparaMinnePa={onSparaMinnePa}
          onSparaSkill={onSparaSkill}
          onTaBortSkill={onTaBortSkill}
          onSparaMinne={onSparaMinne}
          onTaBortMinne={onTaBortMinne}
          onLasSkill={onLasSkill}
          onVaxla={onVaxla}
          kanVaxla={kanVaxla}
        />
      )}
    </div>
  );
}

/**
 * Avsnittsrubrik i agentens inställningar (0.90.1, lifehub.app#146).
 *
 * `OpsSectionLabel` är profilens rubrik och väger 700, för där mäter
 * SessionStudio `font-bold`. Inställningar mäter `text-xs font-semibold`:
 * 12 px, vikt 600, versaler, accent. Samma roll som `text-sektion`.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {import("react").ReactNode} props.children
 */
function Avsnittsrubrik({ id, children }) {
  return <h2 id={id} className="m-0 text-sektion font-semibold uppercase text-accent">{children}</h2>;
}

/**
 * @param {object} props
 * @param {(nyckel: keyof typeof ORD_OPSAGENTER) => string} props.t
 * @param {{ id: string, namn: string, status?: string, bild?: string }} props.vald
 * @param {{ namn?: string, beskrivning?: string, roll?: string, instruktioner?: string, minnePa?: boolean } | null} props.installning
 * @param {ReadonlyArray<{ id: string, namn: string, beskrivning?: string, text?: string, aktiv?: boolean, alltidMed?: boolean, publik?: boolean, kalla?: string }>} props.skills
 * @param {ReadonlyArray<{ namn: string, beskrivning?: string, not?: string, pa: boolean }>} props.verktyg
 * @param {ReadonlyArray<{ id: string, text: string }>} props.minne
 * @param {{ namn: string, hint?: string } | null} props.modell
 * @param {import("react").ReactNode} props.byok
 * @param {Record<string, number>} props.granser
 * @param {boolean} props.farAndra
 * @param {boolean} props.sparar
 * @param {Function} [props.onSparaIdentitet]
 * @param {Function} [props.onSparaInstruktioner]
 * @param {Function} [props.onSparaVerktyg]
 * @param {Function} [props.onSparaMinnePa]
 * @param {Function} [props.onSparaSkill]
 * @param {Function} [props.onTaBortSkill]
 * @param {Function} [props.onSparaMinne]
 * @param {Function} [props.onTaBortMinne]
 * @param {(text: string) => { namn: string, beskrivning: string, text: string } | { fel: string }} [props.onLasSkill]
 * @param {Function} [props.onVaxla]
 * @param {boolean} props.kanVaxla
 */
function AgentFalt(props) {
  const {
    t, vald, installning, farAndra, sparar, granser, onSparaIdentitet, onVaxla, kanVaxla,
    onSparaInstruktioner, onSparaVerktyg, onSparaMinnePa, onSparaSkill, onTaBortSkill, onSparaMinne, onTaBortMinne, onLasSkill,
  } = props;
  const allmantId = useId();
  const kopplingarId = useId();
  const egnaId = useId();
  const [lokaltFel, setLokaltFel] = useState("");
  const [namn, setNamn] = useState(installning?.namn || vald.namn || "");
  const [roll, setRoll] = useState(installning?.roll || "");
  const [beskrivning, setBeskrivning] = useState(installning?.beskrivning || "");
  const [instruktioner, setInstruktioner] = useState(installning?.instruktioner || "");
  const [verktygsval, setVerktygsval] = useState(() => Object.fromEntries(props.verktyg.map((v) => [v.namn, v.pa])));
  const [minneText, setMinneText] = useState("");
  const [skillFel, setSkillFel] = useState("");
  const [redigerar, setRedigerar] = useState(/** @type {null | { id: string, namn: string, beskrivning: string, text: string, aktiv: boolean, alltidMed: boolean, publik: boolean, kalla: string }} */ (null));

  useEffect(() => {
    setVerktygsval(Object.fromEntries(props.verktyg.map((v) => [v.namn, v.pa])));
  }, [props.verktyg]);

  const kor = (/** @type {() => void | Promise<void>} */ arbete, /** @type {unknown} */ fn) => {
    if (typeof fn !== "function") {
      setLokaltFel(t("sparandeSaknas"));
      return;
    }
    setLokaltFel("");
    try {
      const svar = arbete();
      if (svar && typeof svar.then === "function") svar.catch((e) => setLokaltFel(e instanceof Error ? e.message : String(e)));
    } catch (e) {
      setLokaltFel(e instanceof Error ? e.message : String(e));
    }
  };

  /** @param {Partial<{ id: string, namn: string, beskrivning: string, text: string, aktiv: boolean, alltidMed: boolean, publik: boolean, kalla: string }>} del */
  const sattSkill = (del) => setRedigerar((r) => ({
    id: r?.id ?? "",
    namn: r?.namn ?? "",
    beskrivning: r?.beskrivning ?? "",
    text: r?.text ?? "",
    aktiv: r?.aktiv !== false,
    alltidMed: r?.alltidMed === true,
    publik: r?.publik === true,
    kalla: r?.kalla ?? "",
    ...del,
  }));

  const aktiv = vald.status !== "avstangd";

  return (
    <>
      {lokaltFel ? <OpsBanner tone="danger" title={t("sparfelRubrik")}>{lokaltFel}</OpsBanner> : null}
      {skillFel ? <OpsBanner tone="danger" title={t("filLasFel")}>{skillFel}</OpsBanner> : null}
      <section aria-labelledby={allmantId} className="flex flex-col gap-3">
        <Avsnittsrubrik id={allmantId}>{t("allmant")}</Avsnittsrubrik>
        <div data-allmant="ikon" className="flex items-center gap-3">
          <OpsIdentity name={namn || vald.namn || "Agent"} seed={vald.id} imageUrl={vald.bild || undefined} icon={AgentIkon} size="md" rund />
          <div>
            <p className="m-0 text-brod text-ink">{t("ikon")}</p>
            <p className="m-0 text-meta text-ink-muted">{t("ikonText")}</p>
          </div>
        </div>
        {kanVaxla ? (
          <OpsSwitch label={t("pa")} hint={t("paHint")} checked={aktiv} disabled={!farAndra} onChange={(pa) => kor(() => onVaxla?.({ id: vald.id, status: pa ? "aktiv" : "avstangd" }), onVaxla)} />
        ) : (
          <p className="m-0 text-etikett text-ink">{aktiv ? t("aktiv") : t("avstangd")}</p>
        )}
        {farAndra ? (
          <>
            <OpsField label={t("namn")}>
              <OpsInput value={namn} onChange={setNamn} maxLength={granser.namn} />
            </OpsField>
            <OpsField label={t("roll")}>
              <OpsInput value={roll} onChange={setRoll} maxLength={granser.roll} />
            </OpsField>
            <OpsField label={t("beskrivning")}>
              <OpsInput value={beskrivning} onChange={setBeskrivning} maxLength={granser.beskrivning} />
            </OpsField>
            <div>
              <OpsButton variant="primary" busy={sparar} disabled={sparar || !namn.trim()} onClick={() => kor(() => onSparaIdentitet?.({ namn, beskrivning, roll }), onSparaIdentitet)}>
                {t("sparaIdentitet")}
              </OpsButton>
            </div>
          </>
        ) : (
          <>
            <OpsField label={t("namn")}><p className="m-0 text-etikett text-ink">{installning?.namn || vald.namn || "Agent"}</p></OpsField>
            <OpsField label={t("roll")}><p className="m-0 text-etikett text-ink">{installning?.roll || t("ingenRoll")}</p></OpsField>
            <OpsField label={t("beskrivning")}><p className="m-0 text-etikett text-ink">{installning?.beskrivning || t("ingenBeskrivning")}</p></OpsField>
          </>
        )}
      </section>

      <section aria-labelledby={kopplingarId} className="flex flex-col gap-3">
        <Avsnittsrubrik id={kopplingarId}>{t("kopplingar")}</Avsnittsrubrik>
        <div data-koppling="modell">
          <p className="m-0 text-brod font-semibold text-ink">{t("modell")}</p>
          {props.modell?.namn ? <p className="m-0 text-brod text-ink">{props.modell.namn}</p> : <p className="m-0 text-etikett text-ink">{t("ingenModell")}</p>}
          {props.modell?.hint ? <p className="m-0 text-meta text-ink-muted">{props.modell.hint}</p> : null}
        </div>
        <div data-koppling="nycklar">
          <p className="m-0 text-brod font-semibold text-ink">{t("nycklar")}</p>
          <p className="m-0 text-meta text-ink-muted">{t("nycklarText")}</p>
          {props.byok ?? <p className="m-0 text-etikett text-ink">{t("nycklarSaknas")}</p>}
        </div>
        <div data-koppling="verktyg" className="flex flex-col gap-3">
          <p className="m-0 text-brod font-semibold text-ink">{t("verktyg")}</p>
          {props.verktyg.length === 0 ? <p className="m-0 text-etikett text-ink">{t("ingaVerktyg")}</p> : null}
          {props.verktyg.map((v) => (
            <div key={v.namn}>
              {farAndra ? (
                <OpsSwitch label={v.beskrivning || v.namn} checked={verktygsval[v.namn] === true} onChange={(pa) => setVerktygsval((k) => ({ ...k, [v.namn]: pa }))} />
              ) : (
                <p className="m-0 text-etikett text-ink">{`${v.beskrivning || v.namn}: ${v.pa ? t("aktiv") : t("avstangd")}`}</p>
              )}
              {v.not ? <p className="m-0 text-hjalp text-ink-muted">{v.not}</p> : null}
            </div>
          ))}
          {farAndra && props.verktyg.length > 0 ? (
            <div>
              <OpsButton variant="primary" busy={sparar} disabled={sparar} onClick={() => kor(() => onSparaVerktyg?.(verktygsval), onSparaVerktyg)}>
                {t("sparaVerktyg")}
              </OpsButton>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby={egnaId} className="flex flex-col gap-3">
        <Avsnittsrubrik id={egnaId}>{t("egna")}</Avsnittsrubrik>
        <p className="m-0 text-brod font-semibold text-ink">{t("behorigheter")}</p>
        <p className="m-0 text-meta text-ink-muted">{t("behorigheterText")}</p>
        {farAndra ? (
          <>
            <OpsField label={t("instruktioner")} hint={t("instruktionerHint")}>
              <OpsTextarea value={instruktioner} onChange={setInstruktioner} maxLength={granser.instruktioner} rows={6} />
            </OpsField>
            <div>
              <OpsButton variant="secondary" busy={sparar} disabled={sparar} onClick={() => kor(() => onSparaInstruktioner?.(instruktioner), onSparaInstruktioner)}>
                {t("sparaInstruktioner")}
              </OpsButton>
            </div>
          </>
        ) : (
          <p className="m-0 text-etikett text-ink">{installning?.instruktioner || t("ingaInstruktioner")}</p>
        )}
        {props.skills.length === 0 && !redigerar ? <p className="m-0 text-etikett text-ink">{t("ingaSkills")}</p> : null}
        {props.skills.map((s) => (
          <OpsCard key={s.id}>
            <div className="flex flex-col gap-2">
              <p className="m-0 text-etikett text-ink">{s.namn}</p>
              {s.beskrivning ? <p className="m-0 text-etikett text-ink">{s.beskrivning}</p> : null}
              {farAndra ? (
                <div className="flex flex-wrap gap-2">
                  <OpsButton onClick={() => { setSkillFel(""); setRedigerar({ id: s.id, namn: s.namn, beskrivning: s.beskrivning ?? "", text: s.text ?? "", aktiv: s.aktiv !== false, alltidMed: s.alltidMed === true, publik: s.publik === true, kalla: s.kalla ?? "" }); }}>{t("redigera")}</OpsButton>
                  <OpsButton onClick={() => kor(() => onTaBortSkill?.(s.id), onTaBortSkill)}>{t("taBort")}</OpsButton>
                </div>
              ) : null}
            </div>
          </OpsCard>
        ))}
        {farAndra ? (
          <OpsCard>
            <div className="flex flex-col gap-4">
              <OpsField label={t("namn")}>
                <OpsInput value={redigerar?.namn ?? ""} onChange={(v) => sattSkill({ namn: v })} maxLength={granser.skillNamn} />
              </OpsField>
              <OpsField label={t("beskrivning")}>
                <OpsInput value={redigerar?.beskrivning ?? ""} onChange={(v) => sattSkill({ beskrivning: v })} maxLength={granser.skillBeskrivning} />
              </OpsField>
              <OpsField label={t("text")}>
                <OpsTextarea value={redigerar?.text ?? ""} onChange={(v) => sattSkill({ text: v })} maxLength={granser.skillText} rows={4} />
              </OpsField>
              <OpsSwitch label={t("aktiv")} checked={redigerar?.aktiv !== false} onChange={(v) => sattSkill({ aktiv: v })} />
              <OpsSwitch label={t("alltidMed")} checked={redigerar?.alltidMed === true} onChange={(v) => sattSkill({ alltidMed: v })} />
              <OpsSwitch label={t("publik")} hint={t("publikHint")} checked={redigerar?.publik === true} onChange={(v) => sattSkill({ publik: v })} />
              <div className="flex flex-wrap gap-2">
                <OpsButton
                  variant="primary"
                  busy={sparar}
                  disabled={sparar || !(redigerar?.namn ?? "").trim()}
                  onClick={() => kor(() => onSparaSkill?.({
                    namn: redigerar?.namn ?? "",
                    beskrivning: redigerar?.beskrivning ?? "",
                    text: redigerar?.text ?? "",
                    aktiv: redigerar?.aktiv !== false,
                    alltidMed: redigerar?.alltidMed === true,
                    publik: redigerar?.publik === true,
                    kalla: redigerar?.kalla ?? "",
                    ...(redigerar?.id ? { ersatter: redigerar.id } : {}),
                  }), onSparaSkill)}
                >
                  {t("sparaSkill")}
                </OpsButton>
                <OpsButton onClick={() => { setRedigerar(null); setSkillFel(""); }}>{t("nySkill")}</OpsButton>
              </div>
              <OpsField label={t("importera")} hint={t("importeraHint")}>
                <input
                  aria-label={t("importera")}
                  type="file"
                  accept=".md,text/markdown"
                  className="min-h-11 text-etikett text-ink"
                  onChange={(e) => {
                    const fil = e.target.files?.[0];
                    e.target.value = "";
                    if (!fil) return;
                    if (typeof onLasSkill !== "function") {
                      setSkillFel(t("importSaknas"));
                      return;
                    }
                    void fil.text().then((text) => {
                      const last = onLasSkill(text);
                      if ("fel" in last) {
                        setSkillFel(last.fel);
                        return;
                      }
                      setSkillFel("");
                      kor(() => onSparaSkill?.({ namn: last.namn, beskrivning: last.beskrivning, text: last.text, aktiv: true, alltidMed: false, publik: false, kalla: fil.name.slice(0, 40) }), onSparaSkill);
                    });
                  }}
                />
              </OpsField>
            </div>
          </OpsCard>
        ) : null}
        <p className="m-0 text-brod font-semibold text-ink">{t("minne")}</p>
        {farAndra ? (
          <OpsSwitch label={t("anvandMinne")} checked={installning ? installning.minnePa !== false : true} onChange={(pa) => kor(() => onSparaMinnePa?.(pa), onSparaMinnePa)} />
        ) : (
          <p className="m-0 text-etikett text-ink">{installning && installning.minnePa === false ? t("minnetAv") : t("minnetPa")}</p>
        )}
        {props.minne.length === 0 ? <p className="m-0 text-etikett text-ink">{t("ingetMinne")}</p> : null}
        {props.minne.map((m) => (
          <OpsCard key={m.id}>
            <div className="flex flex-col gap-2">
              <p className="m-0 text-etikett text-ink">{m.text}</p>
              {farAndra ? <OpsButton onClick={() => kor(() => onTaBortMinne?.(m.id), onTaBortMinne)}>{t("taBort")}</OpsButton> : null}
            </div>
          </OpsCard>
        ))}
        {farAndra ? (
          <>
            <OpsField label={t("nyMinnesrad")}>
              <OpsTextarea value={minneText} onChange={setMinneText} maxLength={granser.minne} rows={3} />
            </OpsField>
            <div>
              <OpsButton variant="primary" busy={sparar} disabled={sparar || !minneText.trim()} onClick={() => { const text = minneText; kor(async () => { await onSparaMinne?.(text); setMinneText(""); }, onSparaMinne); }}>
                {t("sparaMinne")}
              </OpsButton>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}
