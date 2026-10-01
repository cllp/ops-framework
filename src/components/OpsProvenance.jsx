import { cx } from "../lib/cx.js";
import { AgentIkon } from "./icons.jsx";

/**
 * Proveniens: producerades det här av en människa, en agent, eller automatik?
 *
 * ⛔ Begreppet är inte påhittat. bolag-ops hade `--human`, `--agent` och
 * `--auto` innan ramverket fanns, och TAM kommer att behöva exakt samma
 * skillnad. När två plattformar oberoende av varandra uppfinner samma sak hör
 * det hemma i kontraktet.
 *
 * ⛔ Ordet skrivs alltid ut. bolag-ops har i dag en `.role-dot`, alltså en
 * färgad prick som ensam bär betydelsen. Det är samma fel som ramverket
 * förbjuder för identitet: pricken går inte att läsa upp, den säger ingenting
 * till den som inte redan lärt sig koden, och var tjugonde man ser inte
 * skillnad på två av färgerna.
 */

const SLAG = {
  human: { klass: "bg-human-bg text-human", text: "Människa" },
  agent: { klass: "bg-agent-bg text-agent", text: "Agent" },
  auto: { klass: "bg-auto-bg text-auto", text: "Automatik" },
};

/**
 * @param {object} props
 * @param {"human"|"agent"|"auto"} props.kind
 * @param {string} [props.label] Egen text, till exempel ett agentnamn. Ersätter standardordet.
 */
export function OpsProvenance({ kind, label }) {
  const s = SLAG[kind];
  if (!s) {
    throw new Error(`OpsProvenance: okänt kind "${kind}". Giltiga: ${Object.keys(SLAG).join(", ")}.`);
  }
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-meta font-semibold leading-tight", s.klass)}>
      {/* ⛔ AGENTEN BÄR SIN ROBOT (0.43.0, #224, CP 2026-10-01). Före 0.43.0 skiljde sig en agents rad "Skapad av ops-agent" från en
          människas BARA i färgen, eftersom `label` ersatte ordet "Agent": precis felet filhuvudet förbjuder. Ikonen syns utan
          att man lärt sig färgerna, och ordet läses upp för skärmläsaren även när `label` ersätter det synliga ordet. */}
      {kind === "agent" ? <AgentIkon size={12} /> : null}
      {label !== undefined ? <span className="sr-only">{`${s.text}: `}</span> : null}
      {label ?? s.text}
    </span>
  );
}
