import { useEffect, useState } from "react";
import { agentIHref, agentInstallningsHref, AGENTER_ID } from "../lib/agenter.js";
import { arInstallningslage } from "../lib/apparark.js";
import { ordet } from "../lib/ord.js";
import { AgentIkon, ChevronHogerIkon } from "./icons.jsx";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsCard } from "./OpsCard.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField, OpsInput, OpsTextarea } from "./OpsField.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsModulRam } from "./OpsModulRam.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsSwitch } from "./OpsToggle.jsx";
import { TillbakaKnapp } from "./TillbakaKnapp.jsx";

/**
 * Modulen Agenter (0.90.0).
 *
 * CP hittar agentens inställningar för långt från samtalet. Visningen listar
 * gruppens agenter. Kugghjulet, och ett tryck på agenten i chatten, öppnar
 * inställningarna för just den agenten.
 *
 * 0.90.2: CP, live på 0.90.0, "super messy, I understand nothing of the enormous
 * list". Första skärmen är ett kort. Resten är fyra rader. Ett avsnitt i taget.
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
  avsnittLista: { sv: "Inställningar för agenten", en: "Settings for the agent" },
  tillbaka: { sv: "Tillbaka", en: "Back" },
  spara: { sv: "Spara", en: "Save" },
  sparat: { sv: "Sparat.", en: "Saved." },
  om: { sv: "Om agenten", en: "About the agent" },
  omRad: { sv: "Namn, roll och beskrivning", en: "Name, role and description" },
  omHjalp: { sv: "Så här presenteras agenten i gruppen.", en: "This is how the agent is presented in the group." },
  namn: { sv: "Namn", en: "Name" },
  roll: { sv: "Roll", en: "Role" },
  beskrivning: { sv: "Beskrivning", en: "Description" },
  namnHint: { sv: "Det namn gruppen ser.", en: "The name the group sees." },
  rollHint: { sv: "Till exempel assistent eller sekreterare.", en: "For example assistant or secretary." },
  beskrivningHint: { sv: "En mening om vad agenten gör.", en: "One sentence about what the agent does." },
  pa: { sv: "Agenten är på", en: "The agent is on" },
  paHint: { sv: "Avstängd svarar den inte, varken i gruppchatten eller privat.", en: "When off it does not reply, neither in the group chat nor in private." },
  kan: { sv: "Vad den kan", en: "What it can do" },
  kanRad: { sv: "Vad agenten får använda", en: "What the agent may use" },
  kanHjalp: { sv: "Slå på det agenten får använda. Tryck Spara när du är klar.", en: "Turn on what the agent may use. Press Save when you are done." },
  ingaVerktyg: { sv: "Inga verktyg.", en: "No tools." },
  verktygUtanNamn: { sv: "Ett verktyg", en: "A tool" },
  verktygUtanText: { sv: "Vad det gör är inte beskrivet.", en: "What it does is not described." },
  kunskap: { sv: "Kunskap och minne", en: "Knowledge and memory" },
  kunskapRad: { sv: "Instruktioner, kunskap och minne", en: "Instructions, knowledge and memory" },
  kunskapHjalp: { sv: "Det agenten ska veta, och det den får minnas.", en: "What the agent should know, and what it may remember." },
  modell: { sv: "Modell", en: "Model" },
  modellAvsnitt: { sv: "Modell och nycklar", en: "Model and keys" },
  avancerat: { sv: "Avancerat", en: "Advanced" },
  modellHjalp: { sv: "Modellen väljs av appen. Den ändras inte här.", en: "The app chooses the model. It is not changed here." },
  ingenModell: { sv: "Ingen modell angiven.", en: "No model given." },
  nycklar: { sv: "Nycklar", en: "Keys" },
  nycklarText: { sv: "Nycklarna ligger i kontot. De sparas inte bland agentens inställningar.", en: "The keys stay in the account. They are not stored with the agent's settings." },
  nycklarSaknas: { sv: "Nycklarna är inte kopplade i appen.", en: "The keys are not wired in the app." },
  instruktioner: { sv: "Instruktioner", en: "Instructions" },
  instruktionerHint: { sv: "Vad agenten ska göra i den här gruppen.", en: "What the agent should do in this group." },
  ingaInstruktioner: { sv: "Inga instruktioner.", en: "No instructions." },
  sparaInstruktioner: { sv: "Spara instruktioner", en: "Save instructions" },
  ingaSkills: { sv: "Ingen kunskap tillagd.", en: "No knowledge added." },
  text: { sv: "Text", en: "Text" },
  anvandKunskap: { sv: "Använd den här kunskapen", en: "Use this knowledge" },
  anvandKunskapHint: { sv: "Av betyder att agenten inte använder texten.", en: "Off means the agent does not use the text." },
  alltidMed: { sv: "Alltid med", en: "Always included" },
  alltidMedHint: { sv: "Texten följer med i varje svar.", en: "The text is included in every reply." },
  publik: { sv: "Får nämnas i ärenden", en: "May be mentioned in cases" },
  publikHint: { sv: "Av betyder att texten stannar i appen. På betyder att den får följa med när agenten svarar i ett ärende.", en: "Off means the text stays in the app. On means it may follow when the agent replies in a case." },
  sparaSkill: { sv: "Spara kunskap", en: "Save knowledge" },
  nySkill: { sv: "Ny kunskap", en: "New knowledge" },
  redigera: { sv: "Redigera", en: "Edit" },
  taBort: { sv: "Ta bort", en: "Remove" },
  importera: { sv: "Importera en fil", en: "Import a file" },
  importeraHint: { sv: "Välj en fil med kunskapen. Den ska ha ett namn och en beskrivning.", en: "Choose a file with the knowledge. It should have a name and a description." },
  minne: { sv: "Minne", en: "Memory" },
  anvandMinne: { sv: "Använd minnet i svaren", en: "Use memory in replies" },
  minnetPa: { sv: "Minnet är på.", en: "Memory is on." },
  minnetAv: { sv: "Minnet är av.", en: "Memory is off." },
  ingetMinne: { sv: "Inget minne.", en: "No memory." },
  nyMinnesrad: { sv: "Ny minnesrad", en: "New memory line" },
  sparaMinne: { sv: "Spara minne", en: "Save memory" },
  sparandeSaknas: { sv: "Sparandet är inte kopplat. Ingenting sparades.", en: "Saving is not connected. Nothing was saved." },
  importSaknas: { sv: "Importen är inte kopplad. Filen lästes inte.", en: "Import is not connected. The file was not read." },
};

/** Avsnitt som får en egen sida. Allt annat, även en tom parameter, är översikten. */
const AVSNITT = ["om", "kan", "kunskap", "modell"];

/**
 * @param {string} href
 * @returns {{ sokvag: string, qs: string, hash: string }}
 */
function delaAdress(href) {
  const h = typeof href === "string" ? href : "";
  const hashI = h.indexOf("#");
  const hash = hashI < 0 ? "" : h.slice(hashI);
  const utan = hashI < 0 ? h : h.slice(0, hashI);
  const q = utan.indexOf("?");
  return { sokvag: q < 0 ? utan : utan.slice(0, q), qs: q < 0 ? "" : utan.slice(q + 1), hash };
}

/**
 * Vilket avsnitt adressen pekar på. Tom sträng är översikten: en okänd eller
 * utelämnad parameter är ett svar, inte ett kast.
 *
 * @param {string} href
 */
function lasAvsnitt(href) {
  const v = new URLSearchParams(delaAdress(href).qs).get("avsnitt") ?? "";
  return AVSNITT.includes(v) ? v : "";
}

/**
 * Samma adress, med avsnittet satt eller borttaget. Övriga parametrar står kvar.
 *
 * @param {string} href
 * @param {string} avsnitt
 */
function medAvsnitt(href, avsnitt) {
  const { sokvag, qs, hash } = delaAdress(href);
  const p = new URLSearchParams(qs);
  if (avsnitt) p.set("avsnitt", avsnitt);
  else p.delete("avsnitt");
  const q = p.toString();
  return `${sokvag}${q ? `?${q}` : ""}${hash}`;
}

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
    return <p data-agenter-lasfel="" role="alert" className="m-0 text-etikett text-ink">{listfel}</p>;
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
          activeHref={activeHref}
          onNavigate={onNavigate}
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
 * @param {object} props
 * @param {(nyckel: keyof typeof ORD_OPSAGENTER) => string} props.t
 * @param {{ id: string, namn: string, status?: string, bild?: string }} props.vald
 * @param {string} props.activeHref
 * @param {(href: string, event: any) => void} [props.onNavigate]
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
    t, vald, activeHref, onNavigate, installning, farAndra, sparar, granser, onSparaIdentitet, onVaxla, kanVaxla,
    onSparaInstruktioner, onSparaVerktyg, onSparaMinnePa, onSparaSkill, onTaBortSkill, onSparaMinne, onTaBortMinne, onLasSkill,
  } = props;
  const [lokaltFel, setLokaltFel] = useState("");
  const [sparat, setSparat] = useState("");
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
      setSparat("");
      setLokaltFel(t("sparandeSaknas"));
      return;
    }
    setLokaltFel("");
    setSparat("");
    try {
      const svar = arbete();
      if (svar && typeof svar.then === "function") {
        svar.then(
          () => setSparat(t("sparat")),
          (e) => {
            setSparat("");
            setLokaltFel(e instanceof Error ? e.message : String(e));
          },
        );
        return;
      }
      setSparat(t("sparat"));
    } catch (e) {
      setSparat("");
      setLokaltFel(e instanceof Error ? e.message : String(e));
    }
  };

  const avsnitt = lasAvsnitt(activeHref);
  const ga = (/** @type {string} */ nasta) => {
    const href = medAvsnitt(activeHref, nasta);
    onNavigate?.(href, { preventDefault() {}, stopPropagation() {} });
  };
  const visningsnamn = installning?.namn || vald.namn || "Agent";
  const rollText = installning?.roll || t("ingenRoll");
  const modellNamn = props.modell?.namn || t("ingenModell");

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
  const besked = (
    <>
      {lokaltFel ? <p role="alert" className="m-0 text-brod text-ink">{lokaltFel}</p> : null}
      {skillFel ? <p role="alert" className="m-0 text-brod text-ink">{skillFel}</p> : null}
      {sparat ? <p role="status" className="m-0 text-etikett text-ink">{sparat}</p> : null}
    </>
  );

  if (avsnitt === "") {
    return (
      <div data-agent-oversikt="" className="flex flex-col gap-4">
        {besked}
        <div data-agent-kort="" className="flex flex-col gap-3 rounded-xl bg-surface p-4">
          <div className="flex items-center gap-3">
            {/* Märket är medlemskapets bild. Det sparas inte en gång till. */}
            <OpsIdentity name={visningsnamn} seed={vald.id} imageUrl={vald.bild || undefined} icon={AgentIkon} size="md" rund />
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-brod font-semibold text-ink">{visningsnamn}</p>
              <p className="m-0 truncate text-etikett text-ink-muted">{rollText}</p>
            </div>
          </div>
          {kanVaxla ? (
            <OpsSwitch label={t("pa")} hint={t("paHint")} checked={aktiv} disabled={!farAndra} onChange={(pa) => kor(() => onVaxla?.({ id: vald.id, status: pa ? "aktiv" : "avstangd" }), onVaxla)} />
          ) : (
            <p className="m-0 text-etikett text-ink">{aktiv ? t("aktiv") : t("avstangd")}</p>
          )}
          <div>
            <p className="m-0 text-hjalp text-ink-muted">{t("modell")}</p>
            <p className="m-0 text-etikett text-ink">{modellNamn}</p>
          </div>
        </div>
        <nav aria-label={t("avsnittLista")} className="rounded-xl bg-surface p-2">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            <AvsnittsRad href={medAvsnitt(activeHref, "om")} titel={t("om")} hint={t("omRad")} onNavigate={onNavigate} />
            <AvsnittsRad href={medAvsnitt(activeHref, "kan")} titel={t("kan")} hint={t("kanRad")} onNavigate={onNavigate} />
            <AvsnittsRad href={medAvsnitt(activeHref, "kunskap")} titel={t("kunskap")} hint={t("kunskapRad")} onNavigate={onNavigate} />
            <AvsnittsRad href={medAvsnitt(activeHref, "modell")} titel={t("modellAvsnitt")} hint={t("avancerat")} onNavigate={onNavigate} />
          </ul>
        </nav>
      </div>
    );
  }

  return (
    <div data-agent-avsnitt={avsnitt} className="flex flex-col gap-4">
      <TillbakaKnapp etikett={t("tillbaka")} onClick={() => ga("")} />
      {besked}
      {avsnitt === "om" ? (
        <AvsnittsYta titel={t("om")} hjalp={t("omHjalp")}>
          {farAndra ? (
            <>
              <OpsField label={t("namn")} hint={t("namnHint")}>
                <OpsInput value={namn} onChange={setNamn} maxLength={granser.namn} />
              </OpsField>
              <OpsField label={t("roll")} hint={t("rollHint")}>
                <OpsInput value={roll} onChange={setRoll} maxLength={granser.roll} />
              </OpsField>
              <OpsField label={t("beskrivning")} hint={t("beskrivningHint")}>
                <OpsInput value={beskrivning} onChange={setBeskrivning} maxLength={granser.beskrivning} />
              </OpsField>
              <div>
                <OpsButton variant="primary" busy={sparar} disabled={sparar || !namn.trim()} onClick={() => kor(() => onSparaIdentitet?.({ namn, beskrivning, roll }), onSparaIdentitet)}>
                  {t("spara")}
                </OpsButton>
              </div>
            </>
          ) : (
            <>
              <OpsField label={t("namn")}><p className="m-0 text-etikett text-ink">{visningsnamn}</p></OpsField>
              <OpsField label={t("roll")}><p className="m-0 text-etikett text-ink">{rollText}</p></OpsField>
              <OpsField label={t("beskrivning")}><p className="m-0 text-etikett text-ink">{installning?.beskrivning || t("ingenBeskrivning")}</p></OpsField>
            </>
          )}
        </AvsnittsYta>
      ) : null}
      {avsnitt === "kan" ? (
        <AvsnittsYta titel={t("kan")} hjalp={t("kanHjalp")}>
          {props.verktyg.length === 0 ? <p className="m-0 text-etikett text-ink">{t("ingaVerktyg")}</p> : null}
          {props.verktyg.map((v, i) => {
            const text = verktygsText(v, t);
            return (
              <div key={`${i}:${text.etikett}`}>
                {farAndra ? (
                  <OpsSwitch label={text.etikett} hint={text.not || undefined} checked={verktygsval[v.namn] === true} onChange={(pa) => setVerktygsval((k) => ({ ...k, [v.namn]: pa }))} />
                ) : (
                  <>
                    <p className="m-0 text-etikett text-ink">{`${text.etikett}: ${v.pa ? t("aktiv") : t("avstangd")}`}</p>
                    {text.not ? <p className="m-0 text-hjalp text-ink-muted">{text.not}</p> : null}
                  </>
                )}
              </div>
            );
          })}
          {farAndra && props.verktyg.length > 0 ? (
            <div>
              <OpsButton variant="primary" busy={sparar} disabled={sparar} onClick={() => kor(() => onSparaVerktyg?.(verktygsval), onSparaVerktyg)}>
                {t("spara")}
              </OpsButton>
            </div>
          ) : null}
        </AvsnittsYta>
      ) : null}
      {avsnitt === "kunskap" ? (
        <AvsnittsYta titel={t("kunskap")} hjalp={t("kunskapHjalp")}>
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
              <OpsSwitch label={t("anvandKunskap")} hint={t("anvandKunskapHint")} checked={redigerar?.aktiv !== false} onChange={(v) => sattSkill({ aktiv: v })} />
              <OpsSwitch label={t("alltidMed")} hint={t("alltidMedHint")} checked={redigerar?.alltidMed === true} onChange={(v) => sattSkill({ alltidMed: v })} />
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
        </AvsnittsYta>
      ) : null}
      {avsnitt === "modell" ? (
        <AvsnittsYta titel={t("modellAvsnitt")} hjalp={t("modellHjalp")}>
          <p className="m-0 text-hjalp text-ink-muted">{t("avancerat")}</p>
          <div>
            <p className="m-0 text-brod font-semibold text-ink">{t("modell")}</p>
            <p className="m-0 text-etikett text-ink">{modellNamn}</p>
            {props.modell?.hint ? <p className="m-0 text-hjalp text-ink-muted">{props.modell.hint}</p> : null}
          </div>
          <div>
            <p className="m-0 text-brod font-semibold text-ink">{t("nycklar")}</p>
            <p className="m-0 text-hjalp text-ink-muted">{t("nycklarText")}</p>
            {props.byok ?? <p className="m-0 text-etikett text-ink">{t("nycklarSaknas")}</p>}
          </div>
        </AvsnittsYta>
      ) : null}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.href
 * @param {string} props.titel
 * @param {string} props.hint
 * @param {(href: string, event: any) => void} [props.onNavigate]
 */
function AvsnittsRad({ href, titel, hint, onNavigate }) {
  return (
    <li>
      <a
        href={href}
        onClick={(e) => onNavigate?.(href, e)}
        className="flex min-h-14 w-full items-center gap-3 rounded-card px-3 py-3 text-left no-underline hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-brod font-semibold text-ink">{titel}</span>
          <span className="text-etikett text-ink-muted">{hint}</span>
        </span>
        <span aria-hidden="true" className="inline-flex shrink-0 text-ink-muted">
          <ChevronHogerIkon size={18} />
        </span>
      </a>
    </li>
  );
}

/**
 * @param {object} props
 * @param {string} props.titel
 * @param {string} props.hjalp
 * @param {import("react").ReactNode} props.children
 */
function AvsnittsYta({ titel, hjalp, children }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface p-4">
      <header className="flex flex-col gap-1">
        <h2 className="m-0 text-brod font-semibold text-ink">{titel}</h2>
        <p className="m-0 text-etikett text-ink-muted">{hjalp}</p>
      </header>
      {children}
    </section>
  );
}

/**
 * Etiketten är beskrivningen. Id:t används bara som nyckel i kartan som sparas,
 * och ritas aldrig. Saknas beskrivningen står en mening, inte id:t.
 *
 * @param {{ beskrivning?: string, not?: string }} v
 * @param {(nyckel: keyof typeof ORD_OPSAGENTER) => string} t
 */
function verktygsText(v, t) {
  const etikett = (v.beskrivning || "").trim();
  const not = (v.not || "").trim();
  return {
    etikett: etikett || t("verktygUtanNamn"),
    not: not || (etikett ? "" : t("verktygUtanText")),
  };
}
