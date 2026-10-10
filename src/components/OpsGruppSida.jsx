import { cx } from "../lib/cx.js";
import { gruppmarkeProps } from "../lib/gruppikoner.js";
import { text } from "../lib/sprak.js";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsSwitch } from "./OpsToggle.jsx";
import { usePersonnamn } from "./usePersonnamn.js";
import { TillbakaKnapp } from "./TillbakaKnapp.jsx";
import { AgentIkon, AndraIkon, MeddelandeIkon, PersonIkon, PlatsIkon } from "./icons.jsx";

/**
 * Gruppens detaljsida: SessionStudios `GroupDetailView` (0.32.0, #180 G2).
 *
 * ══ ⛔ MÄTT UR KÄLLAN, INTE GISSAD ═════════════════════════════════════════════════════════════════════════════
 *
 * SS `views/GroupDetailView.jsx` (webbens motsvarighet till mobilens `(tabs)/group.js`), öppnad av (i) på gruppkortet:
 * kolumnen `max-w-3xl` (768 px) med `px-4 sm:px-5`; "‹ Tillbaka" är `TillbakaKnapp` (samma chevron och klasser som panelerna, 0.88.0); rubrikraden (`:96`) med märket 56 px, namnet
 * (`text-xl font-semibold`), beskrivningen (`text-sm`), orten med kartnål (`text-xs`) och en Redigera-knapp till höger; tre snabbval i
 * `grid grid-cols-3 gap-2` (`:141`, `p-3`, ikon 20 i accent, `text-xs font-medium`); Medlemmar (`text-xs font-semibold uppercase`,
 * avatar 32, namn `text-sm`, en Ägare- eller Admin-etikett `text-[10px] uppercase`).
 *
 * ⛔ SS-SIDAN HAR ÄVEN discipliner, publik sida, arrangörspanel, affilieringar OCH kommande sessioner. Ingen av dem finns i ramverket: de är
 * SS domän eller appens (en app lägger sina egna sektioner under sidan via `children`). Det som är här är det som varje grupp har.
 *
 * ⛔ SNABBVALEN ÄR APPENS. Ramverket vet inte vad en app har att öppna (Kalender, Bibliotek, Chatt); appen skickar `{ icon, label, onClick }`, precis som
 * `GruppanelGrupp.atgarder`. Utan snabbval ritas ingen rad.
 *
 * ⛔ REDIGERA RITAS BARA FÖR ÄGARE OCH ADMIN, ur gruppens `roll` (`agare` eller `admin`), och bara när appen gav `onRedigera`. Ett `roll` som saknas ger ingen knapp: SS
 * `isGroupAdmin` (#2705) tog bort pennan från den som inte får, eftersom "redigera" till någon som inte får är ett falskt löfte. Ramverket gissar aldrig "får nog".
 *
 * ⛔ MEDLEMMARNA LÄSES UR `memberships`, som en medlem får läsa sedan 0.32.0, via `medlemsinfo(rader).medlemmar`. Namn och bild är de denormaliserade (#138), aldrig e-post.
 * En etikett Ägare eller Admin står vid dem som förvaltar, inte vid vanliga medlemmar (SS `:263-267`).
 *
 * ⛔ AGENTEN STÅR SIST, MED MÄRKET AI (lifehub.app#47). Ur `medlemsinfo(rader).agenter`. Den räknas i rubrikens antal, för den är en
 * medlem, men den har ingen roll att ändra och ingen knapp som tar bort den: ägaren stänger av den med en strömbrytare
 * (`onVaxlaAgent`), och bara ägaren ser strömbrytaren. Servern prövar ägarskapet igen (`createAgentService`). En aktiv
 * agent har knappen "Skriv till" (`onSkrivTillAgent`) för vem som helst i gruppen. En avstängd säger det, och går inte att skriva till.
 *
 * @param {object} props
 * @param {{ id: string, namn: import("../lib/sprak.js").Namn, beskrivning?: string, ort?: string, bild?: string, farg?: string, ikon?: string, roll?: "agare"|"admin"|"medlem" }} props.grupp
 * @param {ReadonlyArray<import("../lib/gruppmedlemmar.js").Gruppmedlem>} [props.medlemmar] Ur `medlemsinfo`.
 * @param {ReadonlyArray<import("../lib/gruppmedlemmar.js").Gruppagent>} [props.agenter] Ur `medlemsinfo` (lifehub.app#47).
 * @param {(b: { userId: string, status: "aktiv" | "avstangd" }) => void} [props.onVaxlaAgent] Ägarens strömbrytare. Ritas bara för `roll` agare.
 * @param {(id: string) => void} [props.onSkrivTillAgent] Öppnar ett privat samtal med agenten. Utelämnad: ingen knapp.
 * @param {ReadonlyArray<{ icon: import("react").ReactNode, label: string, onClick: () => void }>} [props.snabbval] Appens egna genvägar, max tre per rad.
 * @param {() => void} [props.onTillbaka] Utelämnad: ingen tillbaka-rad.
 * @param {() => void} [props.onRedigera] Ritar Redigera-knappen, men bara för `roll` agare eller admin.
 * @param {(id: string) => void} [props.onVisaMedlem] Gör medlemsraden till en knapp. Utelämnad: raden är text.
 * @param {string} [props.agenterHref] (0.90.0) Länk till modulen Agenter. Med den ritas ingen strömbrytare: inställningarna bor i modulen.
 * @param {(href: string, event: any) => void} [props.onNavigate] Tar klicket på länken. Utan den följer webbläsaren adressen.
 * @param {string} [props.sprak]
 * @param {{ tillbaka?: string, redigera?: string, redigeraGrupp?: string, medlemmar?: string, inga?: string, agare?: string, admin?: string, ort?: string, ai?: string, avstangd?: string, agentPa?: string, agentPaHjalp?: string, skrivTill?: string }} [props.etiketter]
 * @param {import("react").ReactNode} [props.children] Appens egna sektioner under medlemmarna.
 */
export function OpsGruppSida({ grupp, medlemmar = [], agenter = [], snabbval = [], onTillbaka, onRedigera, onVisaMedlem, onVaxlaAgent, onSkrivTillAgent, agenterHref, onNavigate, sprak, etiketter, children }) {
  const personnamn = usePersonnamn();
  if (!grupp || typeof grupp.id !== "string" || !grupp.id) {
    throw new Error("OpsGruppSida: grupp krävs, med id och namn. En detaljsida utan grupp är en tom sida.");
  }
  if (agenterHref !== undefined && (typeof agenterHref !== "string" || !agenterHref)) {
    throw new Error("OpsGruppSida: agenterHref ska vara modulens adress. En tom länk ser ut som att inställningarna finns kvar på sidan.");
  }
  const t = { tillbaka: "Tillbaka", redigera: "Redigera", redigeraGrupp: "Redigera grupp", medlemmar: "Medlemmar", inga: "Inga medlemmar", agare: "Ägare", admin: "Admin", ort: "Ort", ai: "AI", avstangd: "Avstängd", agentPa: "Agenten är på", agentPaHjalp: "Avstängd svarar den inte, varken i gruppchatten eller privat.", skrivTill: "Skriv till", agenter: "Agenter", ...(etiketter ?? {}) };
  const namn = text(grupp.namn, sprak);
  const kanRedigera = typeof onRedigera === "function" && (grupp.roll === "agare" || grupp.roll === "admin");
  const kanVaxlaAgent = !agenterHref && typeof onVaxlaAgent === "function" && grupp.roll === "agare";

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col px-4 pt-6 pb-6 sm:px-5" data-gruppsida="">
      {onTillbaka ? (
        <TillbakaKnapp onClick={onTillbaka} etikett={t.tillbaka} className="mb-3 shrink-0 self-start" />
      ) : null}

      <div className="mb-6 flex items-start gap-4" data-gruppsida-rubrik="">
        <OpsIdentity name={namn} seed={grupp.id} imageUrl={grupp.bild || undefined} {...gruppmarkeProps(grupp)} size="xl" />
        <div className="min-w-0 flex-1">
 <h1 className="m-0 text-sida text-ink">{namn}</h1>
          {grupp.beskrivning ? <p className="mt-1 mb-0 text-etikett text-ink-secondary">{grupp.beskrivning}</p> : null}
          {grupp.ort ? (
            <p className="mt-2 mb-0 inline-flex items-center gap-1 text-meta text-ink-muted">
              <PlatsIkon size={14} />
              <span className="sr-only">{t.ort}: </span>
              {grupp.ort}
            </p>
          ) : null}
        </div>
        {kanRedigera ? (
          <button
            type="button"
            onClick={onRedigera}
            aria-label={t.redigeraGrupp}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-base border border-line px-3 py-1.5 text-etikett text-ink-secondary transition-colors hover:bg-raised hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <AndraIkon size={16} />
            <span className="max-sm:hidden">{t.redigera}</span>
          </button>
        ) : null}
      </div>

      {snabbval.length > 0 ? (
        <div className="mb-6 grid grid-cols-3 gap-2" data-gruppsida-snabbval="">
          {snabbval.map((s, i) => (
            <button
              // eslint-disable-next-line react/no-array-index-key -- ⛔ snabbval har inget eget id, och listan sorteras inte om under sidans liv.
              key={i}
              type="button"
              onClick={s.onClick}
              aria-label={s.label}
              className="flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-base bg-raised p-3 text-ink transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="flex text-accent [&_svg]:size-5">{s.icon}</span>
              <span className="text-meta font-medium">{s.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      <section className="mb-6" aria-labelledby="gruppsida-medlemmar" data-gruppsida-medlemmar="">
        <h2 id="gruppsida-medlemmar" className="m-0 mb-2 flex items-center gap-1.5 text-sektion uppercase text-ink-muted">
          <PersonIkon size={14} />
          {`${t.medlemmar} (${medlemmar.length + agenter.length})`}
        </h2>
        {medlemmar.length + agenter.length === 0 ? (
          <p className="m-0 text-etikett text-ink-muted">{t.inga}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {medlemmar.map((m) => {
              // ⛔ ALDRIG ETT ID SOM NAMN (#218): medlemskapets namn, den inloggades eget, annars "Namn saknas".
              const { text: visat, saknas } = personnamn(m.namn, m.id);
              const rad = (
                <>
                  <OpsIdentity name={visat} seed={m.id} imageUrl={m.bild || undefined} size="medlem" />
                  <span className="min-w-0 flex-1">
                    <span className="text-etikett text-ink" data-namn-saknas={saknas ? "" : undefined}>{visat}</span>
                    {m.roll === "agare" || m.roll === "admin" ? (
                      <span className="ml-2 text-liten uppercase tracking-wide text-ink-muted">{m.roll === "agare" ? t.agare : t.admin}</span>
                    ) : null}
                  </span>
                </>
              );
              return (
                <li key={m.id}>
                  {onVisaMedlem ? (
                    <button
                      type="button"
                      onClick={() => onVisaMedlem(m.id)}
                      className={cx("flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-base p-2 text-left transition-colors hover:bg-raised", "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent")}
                    >
                      {rad}
                    </button>
                  ) : (
                    <div className="flex min-h-11 w-full items-center gap-3 rounded-base p-2">{rad}</div>
                  )}
                </li>
              );
            })}
            {agenter.map((a) => {
              const namnet = a.namn || "Agent";
              const aktiv = a.status === "aktiv";
              return (
                <li key={a.id} data-agentrad={a.status} className="flex flex-col gap-1">
                  <div className="flex min-h-11 w-full items-center gap-3 rounded-base p-2">
                    <OpsIdentity name={namnet} seed={a.id} icon={AgentIkon} size="medlem" rund />
                    <span className={cx("min-w-0 flex-1", !aktiv && "text-ink-muted")}>
                      <span className="text-etikett text-ink">{namnet}</span>
                      <span className="ml-2 rounded-full bg-accent-subtle px-1.5 py-0.5 text-liten font-semibold uppercase tracking-wide text-accent">{t.ai}</span>
                      {aktiv ? null : <span className="ml-2 text-liten uppercase tracking-wide text-ink-muted">{t.avstangd}</span>}
                    </span>
                    {aktiv && onSkrivTillAgent ? (
                      <button
                        type="button"
                        onClick={() => onSkrivTillAgent(a.id)}
                        aria-label={`${t.skrivTill} ${namnet}`}
                        className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-base border border-line px-3 py-1.5 text-etikett text-ink-secondary transition-colors hover:bg-raised hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <MeddelandeIkon size={16} />
                        <span className="max-sm:hidden">{t.skrivTill}</span>
                      </button>
                    ) : null}
                  </div>
                  {kanVaxlaAgent ? (
                    <div className="pl-2">
                      <OpsSwitch label={t.agentPa} hint={t.agentPaHjalp} checked={aktiv} onChange={(pa) => onVaxlaAgent({ userId: a.id, status: pa ? "aktiv" : "avstangd" })} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {agenterHref ? (
        <a
          href={agenterHref}
          data-agenter-lank=""
          onClick={(e) => onNavigate?.(agenterHref, e)}
          className="mb-6 inline-flex min-h-11 items-center self-start rounded-base text-etikett font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t.agenter}
        </a>
      ) : null}
      {children}
    </div>
  );
}
