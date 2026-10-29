import { useState } from "react";
import { kalendermottagare, delningarAvKalender } from "../lib/kalenderdelning.js";
import { forvalda } from "../lib/ord.js";
import { GruppIkon, PersonIkon } from "./icons.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField } from "./OpsField.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { OpsSelect } from "./OpsSelect.jsx";

/**
 * Dialogen Dela för en av mina kalendrar (0.154.0, cllp/lifehub.app#485): vem kalendern delas med, Sluta dela per rad, och att dela med gruppen eller en person.
 *
 * ══ ⛔ SAMMA ORD SOM BIBLIOTEKET, OCH DET SOM FINNS FÖRE DET SOM SKAPAS (interaktionsdesign 1 och 3) ══════════════════════
 *
 * CP 2026-10-28: "med samma principer som bibliotek mm". Därför heter det Dela, och dialogen visar först vem kalendern redan delas med, med Sluta dela på varje rad
 * (beslutets "det som delas syns i Dela-menyn, med vem och hur, och varje delning går att stänga där"). Under listan: Dela med gruppen (ett tryck, gruppen är den
 * aktiva), och Dela med en person (en väljare och en knapp). En mening säger hur: den du delar med ser händelserna men kan inte ändra dem.
 *
 * ⛔ EN GRUPP I TAGET. Delas kalendern med en annan grupp säger knappen "i stället", och raden som byts står i listan. Skälet står i `lib/kalenderdelning.js`.
 *
 * ⛔ PANELEN RITAR, APPEN OCH REGLERNA AVGÖR. Dialogen vet inte vem som får dela: reglerna prövar ägaren, kalendern och gruppen vid varje skrivning, och ett fel
 * står i dialogen, aldrig tyst. Väntan syns på knappen som tryckts (`OpsButton` med ett löfte och `busyLabel`).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {{ id: string, namn: string }} props.kalender
 * @param {ReadonlyArray<import("../lib/kalenderdelning.js").Kalenderdelning>} props.delningar Ägarens delningar, alla kalendrar (dialogen väljer ut sin).
 * @param {{ id: string, namn: string } | null} [props.grupp] Den aktiva gruppen. Utan den finns inget Dela med gruppen.
 * @param {ReadonlyArray<{ uid: string, namn: string }>} [props.personer] De man kan dela med, vanligen gruppens medlemmar utom en själv.
 * @param {(m: import("../lib/kalenderdelning.js").Kalendermottagare) => string | undefined} [props.namnFor] Namnet på en mottagare i listan. Saknas det används `personer` och `grupp`.
 * @param {(kalenderId: string, mottagare: import("../lib/kalenderdelning.js").Kalendermottagare) => Promise<unknown>} props.onDela
 * @param {(delning: import("../lib/kalenderdelning.js").Kalenderdelning) => Promise<unknown>} props.onSlutaDela
 * @param {boolean} [props.arkiverad] (granskningen av PR 468) Kalendern är arkiverad och delas inte längre. Dialogen visar då bara vem den delas med och Sluta dela,
 *   med en rad som säger det: reglerna nekar en ny delning av en arkiverad kalender, och en knapp som nekas är en död knapp.
 * @param {string} [props.sprak]
 */
export function KalenderDelning({ open, onOpenChange, kalender, delningar, grupp = null, personer = [], namnFor, onDela, onSlutaDela, arkiverad = false, sprak = "sv" }) {
  const o = /** @type {Record<keyof typeof ORD_KALENDERDELNINGSDIALOG, string>} */ (forvalda(ORD_KALENDERDELNINGSDIALOG, sprak));
  const [vald, setVald] = useState("");
  const [fel, setFel] = useState("");
  const egna = delningarAvKalender(delningar, kalender.id);
  const gruppensRad = egna.find((d) => d.groupId !== undefined) ?? null;
  const delasMedPersoner = new Set(egna.filter((d) => d.person !== undefined).map((d) => /** @type {string} */ (d.person)));
  const kvar = personer.filter((p) => !delasMedPersoner.has(p.uid));

  /** @param {import("../lib/kalenderdelning.js").Kalenderdelning} d */
  const namn = (d) => {
    const m = kalendermottagare(d);
    const egen = namnFor ? namnFor(m) : undefined;
    if (egen) return egen;
    if ("person" in m) return personer.find((p) => p.uid === m.person)?.namn || o.okandPerson;
    return grupp && grupp.id === m.grupp ? grupp.namn : o.okandGrupp;
  };

  /** Ett anrop med felet i dialogen: knappen väntar på löftet och blir tryckbar igen. @param {() => Promise<unknown>} f */
  const kor = async (f) => {
    setFel("");
    try {
      await f();
    } catch (e) {
      setFel(delningsfel(e, o));
    }
  };

  // Gruppen att dela med, när kalendern inte redan delas med just den.
  const delaMedGruppen = !arkiverad && grupp && (!gruppensRad || gruppensRad.groupId !== grupp.id) ? grupp : null;
  return (
    <OpsModal
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setFel("");
          setVald("");
        }
        onOpenChange(v);
      }}
      title={o.titel.replace("{namn}", kalender.namn)}
      description={o.beskrivning}
      size="sm"
      closeLabel={o.stang}
      footer={
        <OpsButton variant="secondary" fullWidth onClick={() => onOpenChange(false)}>
          {o.klar}
        </OpsButton>
      }
    >
      <div data-kalenderdelning={kalender.id} className="flex flex-col gap-4">
        <section aria-label={o.delasMed} className="flex flex-col gap-2">
          <p className="m-0 text-meta font-medium text-ink-secondary">{o.delasMed}</p>
          {egna.length === 0 ? (
            <p data-kalenderdelning-tom="" className="m-0 text-etikett text-ink-muted">
              {o.ingen}
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {egna.map((d) => (
                <li key={d.id} data-kalenderdelning-rad={d.id} className="flex min-w-0 items-center gap-2 rounded-base border border-line bg-canvas p-2">
                  <span aria-hidden="true" className="flex shrink-0 text-ink-muted">
                    {d.groupId !== undefined ? <GruppIkon size={16} /> : <PersonIkon size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-etikett text-ink">{namn(d)}</span>
                    <span className="block text-meta text-ink-muted">{d.groupId !== undefined ? o.helaGruppen : o.enPerson}</span>
                  </span>
                  <OpsButton variant="ghost" size="sm" busyLabel={o.slutar} ariaLabel={o.slutaDelaMed.replace("{namn}", namn(d))} onClick={() => kor(() => onSlutaDela(d))}>
                    {o.slutaDela}
                  </OpsButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        {delaMedGruppen ? (
          <div className="flex flex-col gap-1">
            <OpsButton variant="secondary" busyLabel={o.delar} onClick={() => kor(() => onDela(kalender.id, { grupp: delaMedGruppen.id }))}>
              {(gruppensRad ? o.delaMedGruppenIStallet : o.delaMedGruppen).replace("{namn}", delaMedGruppen.namn)}
            </OpsButton>
            {gruppensRad ? <p className="m-0 text-hjalp text-ink-muted">{o.enGruppITaget.replace("{namn}", namn(gruppensRad))}</p> : null}
          </div>
        ) : null}

        {arkiverad ? (
          <p data-kalenderdelning-arkiverad="" className="m-0 text-meta text-ink-muted">
            {o.arkiverad}
          </p>
        ) : kvar.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <OpsField label={o.delaMedPerson}>
                <OpsSelect options={kvar.map((p) => ({ value: p.uid, label: p.namn }))} value={vald} onChange={setVald} placeholder={o.valjPerson} />
              </OpsField>
            </div>
            <OpsButton
              variant="primary"
              disabled={!vald}
              busyLabel={o.delar}
              onClick={() =>
                kor(async () => {
                  await onDela(kalender.id, { person: vald });
                  setVald("");
                })
              }
            >
              {o.dela}
            </OpsButton>
          </div>
        ) : personer.length > 0 ? (
          <p className="m-0 text-meta text-ink-muted">{o.allaHarDen}</p>
        ) : null}

        {fel ? (
          <p role="alert" data-kalenderdelning-fel="" className="m-0 text-meta text-danger">
            {fel}
          </p>
        ) : null}
      </div>
    </OpsModal>
  );
}

/**
 * Ett fel från dialogens anrop som en mening på dialogens språk (granskningen av PR 468).
 *
 * ⛔ ETT NEJ FRÅN REGLERNA ÄR INTE FIRESTORES ENGELSKA. "Missing or insufficient permissions." säger ingenting till den som ville dela: det som hänt är nästan alltid
 * att kalendern arkiverats eller att man inte längre är med i gruppen, i en annan flik eller på en annan enhet. Ett fel med en Firebase-kod (`permission-denied`,
 * `unavailable` och de andra) får en mening; ett fel utan kod är appens eget, och appen har redan skrivit det för den som läser.
 *
 * @param {unknown} e @param {Record<string, string>} o
 * @returns {string}
 */
export function delningsfel(e, o) {
  const kod = e && typeof e === "object" && "code" in e ? String(/** @type {any} */ (e).code) : "";
  const ren = kod.replace(/^firestore\//, "");
  if (ren === "permission-denied") return o.felNekad;
  if (ren === "unavailable" || ren === "deadline-exceeded") return o.felNatet;
  if (kod) return o.felOkant;
  return e instanceof Error ? e.message : String(e);
}

/** Dialogens ord på båda språken. `{namn}` byts mot kalenderns, gruppens eller personens namn. */
export const ORD_KALENDERDELNINGSDIALOG = {
  titel: { sv: "Dela {namn}", en: "Share {namn}" },
  beskrivning: { sv: "Den du delar med ser händelserna men kan inte ändra dem.", en: "Whoever you share with sees the events but cannot change them." },
  delasMed: { sv: "Delas med", en: "Shared with" },
  ingen: { sv: "Delas inte med någon.", en: "Not shared with anyone." },
  helaGruppen: { sv: "Hela gruppen, bara läsning", en: "The whole group, read only" },
  enPerson: { sv: "Bara läsning", en: "Read only" },
  slutaDela: { sv: "Sluta dela", en: "Stop sharing" },
  slutaDelaMed: { sv: "Sluta dela med {namn}", en: "Stop sharing with {namn}" },
  slutar: { sv: "Slutar dela…", en: "Stopping…" },
  delaMedGruppen: { sv: "Dela med {namn}", en: "Share with {namn}" },
  delaMedGruppenIStallet: { sv: "Dela med {namn} i stället", en: "Share with {namn} instead" },
  enGruppITaget: { sv: "Den delas med {namn} nu. En kalender delas med en grupp i taget.", en: "It is shared with {namn} now. A calendar is shared with one group at a time." },
  delaMedPerson: { sv: "Dela med en person", en: "Share with a person" },
  valjPerson: { sv: "Välj en person", en: "Choose a person" },
  dela: { sv: "Dela", en: "Share" },
  delar: { sv: "Delar…", en: "Sharing…" },
  allaHarDen: { sv: "Alla i gruppen har redan kalendern.", en: "Everyone in the group already has the calendar." },
  okandPerson: { sv: "En person", en: "A person" },
  okandGrupp: { sv: "En grupp", en: "A group" },
  arkiverad: { sv: "Kalendern är arkiverad och delas inte längre. Sluta dela tar bort raderna.", en: "The calendar is archived and no longer shared. Stop sharing removes the rows." },
  felNekad: {
    sv: "Det gick inte. Kalendern kan vara arkiverad, eller så är du inte längre med i gruppen.",
    en: "That did not work. The calendar may be archived, or you are no longer in the group.",
  },
  felNatet: { sv: "Det gick inte att nå servern. Försök igen.", en: "The server could not be reached. Try again." },
  felOkant: { sv: "Det gick inte att spara delningen. Försök igen.", en: "The sharing could not be saved. Try again." },
  klar: { sv: "Klar", en: "Done" },
  stang: { sv: "Stäng", en: "Close" },
};
