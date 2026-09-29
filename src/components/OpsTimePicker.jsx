import * as Select from "@radix-ui/react-select";
import { cx } from "../lib/cx.js";
import { faltTriggerKlass, faltYtaKlass, valjAlternativKlass } from "../lib/radKlass.js";
import { useFieldBinding } from "./OpsField.jsx";
import { BockIkon, ChevronNedIkon } from "./icons.jsx";

/**
 * Tidsväljare: timme och minut, 24 timmar (0.31.0).
 *
 * ══ ⛔ SAMMA KOMPONENT SOM SESSIONSTUDIO ═════════════════════════════════
 *
 * CP 2026-09-29: "Ny händelse: datum går inte att välja, och det finns ingen tidsväljare. Skall vara exakt samma
 * komponenter som i sessionstudio." SS `ThemedTimeSelect.jsx:1-119`: två listor, timme och minut, med ett kolon
 * emellan (`:`, `text-muted`), sifferbredd med `tabular-nums`, listan `max-h-52` som rullar. Ingen inmatning för hand,
 * ingen rå `input type=time`. Värdet är en sträng `"HH:MM"` (`parseTimeHHMM`/`joinTimeHHMM`, `:16-27`).
 *
 * ⛔ VÄRDET ÄR EN STRÄNG, INTE ETT `Date`, av samma skäl som `OpsDatePicker`: en ren tid kan inte skifta dygn av en
 * tidszon.
 *
 * ⛔ TVÅ LISTOR I ETT FÄLT. Etiketten pekar på timmen (fältets id); minuten har ett eget namn ur `minutAriaLabel`.
 * Väljs bara ena delen fylls den andra med `00`, som SS (`ThemedTimeSelect.jsx:82,96`).
 * Med `allowEmpty` finns ett val `--` som tömmer tiden (`onChange(undefined)`).
 *
 * ⛔ LISTORNA ÖPPNAS ÖVER EN MODAL. De ritas på `--z-dropdown`, som ligger över `--z-modal` sedan 0.31.0 (se tokens),
 * och mäts inuti `OpsModal` i check-skalyta.
 */

const TIMMAR = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTER = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const TOM = "__tom";

/**
 * @param {string | undefined} v @returns {{ timme: string, minut: string } | null}
 */
export function delaTid(v) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? "").trim());
  if (!m) return null;
  const t = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return { timme: String(t).padStart(2, "0"), minut: String(min).padStart(2, "0") };
}

/**
 * @param {object} props
 * @param {string} [props.value] Tid som `"HH:MM"`, 24 timmar.
 * @param {(tid: string | undefined) => void} props.onChange
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.allowEmpty] Ett val `--` som tömmer tiden.
 * @param {string} [props.timAriaLabel] Namnet på timlistan när väljaren står utanför en OpsField, eller som tillägg.
 * @param {string} [props.minutAriaLabel]
 */
export function OpsTimePicker({ value, onChange, disabled = false, allowEmpty = false, timAriaLabel = "Timme", minutAriaLabel = "Minut" }) {
  const f = useFieldBinding();
  const tid = delaTid(value);
  const timme = tid?.timme ?? "";
  const minut = tid?.minut ?? "";

  /** @param {"timme"|"minut"} del @param {string} v */
  const satt = (del, v) => {
    if (v === TOM) {
      onChange(undefined);
      return;
    }
    const t = del === "timme" ? v : timme || "00";
    const m = del === "minut" ? v : minut || "00";
    onChange(`${t}:${m}`);
  };

  /** @param {"timme"|"minut"} del @param {string[]} varden @param {string} nu @param {string} etikett @param {string | undefined} id */
  const lista = (del, varden, nu, etikett, id) => (
    <Select.Root value={nu === "" ? undefined : nu} onValueChange={(v) => satt(del, v)} disabled={disabled}>
      <Select.Trigger
        id={id}
        aria-label={etikett}
        aria-invalid={f.invalid || undefined}
        className={cx(faltTriggerKlass({ invalid: f.invalid, filled: nu !== "" }), "min-w-0 flex-1 tabular-nums")}
      >
        <Select.Value placeholder="--" />
        <Select.Icon className="text-ink-muted">
          <ChevronNedIkon />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={4} className={cx(faltYtaKlass, "overflow-hidden")}>
          <Select.Viewport className="max-h-52 overscroll-contain p-1">
            {allowEmpty ? (
              <Select.Item value={TOM} className={valjAlternativKlass({ dampad: true })}>
                <Select.ItemText>--</Select.ItemText>
              </Select.Item>
            ) : null}
            {varden.map((v) => (
              <Select.Item key={v} value={v} className={cx(valjAlternativKlass(), "tabular-nums")}>
                <Select.ItemText>{v}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto shrink-0 text-accent">
                  <BockIkon size={14} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );

  return (
    <div role="group" className="flex w-full min-w-0 items-center gap-1">
      {lista("timme", TIMMAR, timme, timAriaLabel, f.id)}
      <span aria-hidden="true" className="shrink-0 px-0.5 text-meta text-ink-muted">
        :
      </span>
      {lista("minut", MINUTER, minut, minutAriaLabel, undefined)}
    </div>
  );
}
