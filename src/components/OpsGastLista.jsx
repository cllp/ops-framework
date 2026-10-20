import { useEffect, useId, useRef, useState } from "react";
import { SIGNERAD_SEKUNDER } from "../lib/delning.js";
import { GAST_PLATSER_GRATIS, MAX_GASTNAMN, gastId, gastStatus, normaliseraGastepost } from "../lib/gast.js";
import { definierade, forvalda } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { OpsPill } from "./OpsPill.jsx";

/**
 * Orden i gästlistan, på svenska och engelska (0.131.0, cllp/lifehub.app#389). Statusorden hör till `GASTSTATUSAR` och är de enda platserna de skrivs ut på.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSGASTLISTA = {
  rubrik: { sv: "Gäster", en: "Guests" },
  platser: { sv: "{anvanda} av {totalt} gratis platser", en: "{anvanda} of {totalt} free places" },
  platserFulla: { sv: "Gruppen har {totalt} gäster och det är taket. Betalning för fler kommer. Bjud in personen som medlem i stället.", en: "The group has {totalt} guests, which is the limit. Paying for more is coming. Invite the person as a member instead." },
  ingress: {
    sv: "En gäst får ett mejl med en länk och kan rösta, inget mer. Inget konto, ingen inloggning.",
    en: "A guest gets an email with a link and can vote, nothing more. No account, no sign-in.",
  },
  inga: { sv: "Inga gäster har bjudits in till den här omröstningen.", en: "No guests have been invited to this vote." },
  epostEtikett: { sv: "E-postadress", en: "Email address" },
  namnEtikett: { sv: "Namn (valfritt)", en: "Name (optional)" },
  bjud: { sv: "Bjud in utan konto", en: "Invite without an account" },
  skickaIgen: { sv: "Skicka igen", en: "Send again" },
  skickaIgenNamn: { sv: "Skicka länken igen till {vem}", en: "Send the link again to {vem}" },
  draTillbaka: { sv: "Dra tillbaka", en: "Withdraw" },
  draTillbakaNamn: { sv: "Dra tillbaka inbjudan till {vem}", en: "Withdraw the invitation to {vem}" },
  bjudIgen: { sv: "Bjud in igen", en: "Invite again" },
  bjudIgenNamn: { sv: "Bjud in {vem} igen", en: "Invite {vem} again" },
  status_vantar: { sv: "Inbjuden", en: "Invited" },
  status_utgangen: { sv: "Länken har gått ut", en: "Link expired" },
  status_inloggad: { sv: "Har loggat in", en: "Has signed in" },
  "status_har-rostat": { sv: "Har röstat", en: "Has voted" },
  status_aterkallad: { sv: "Återkallad", en: "Withdrawn" },
  felEpost: { sv: "Det där ser inte ut som en e-postadress.", en: "That does not look like an email address." },
  felNamn: { sv: "Namnet får vara högst {max} tecken.", en: "The name can be at most {max} characters." },
  felBrev: { sv: "Inbjudan finns men mejlet gick inte att skicka. Tryck Skicka igen.", en: "The invitation exists but the email could not be sent. Press Send again." },
  felEjBehorig: { sv: "Du får inte bjuda in gäster till den här omröstningen.", en: "You may not invite guests to this vote." },
  felReserv: { sv: "Det gick inte. Försök igen.", en: "That did not work. Try again." },
  // ── Hela gruppen (0.132.0) ──
  ingressGrupp: {
    sv: "En gäst får ett mejl med en länk och kan följa gruppen utan konto: chatten, kalendern, ärendena och biblioteket. Gästen kan svara och rösta i kalendern, inget mer.",
    en: "A guest gets an email with a link and can follow the group without an account: the chat, the calendar, the cases and the library. The guest can answer and vote in the calendar, nothing more.",
  },
  ingaGrupp: { sv: "Inga gäster har bjudits in till gruppen.", en: "No guests have been invited to the group." },
  bjudGrupp: { sv: "Bjud in gäst till hela gruppen", en: "Invite a guest to the whole group" },
  omfang_grupp: { sv: "Hela gruppen", en: "The whole group" },
  omfang_sak: { sv: "Omröstning", en: "Vote" },
  omfang_sak_titel: { sv: "Omröstning: {titel}", en: "Vote: {titel}" },
  draTillbakaAlla: { sv: "Dra tillbaka alla", en: "Withdraw all" },
  draTillbakaAllaNamn: { sv: "Dra tillbaka alla inbjudningar till {vem}", en: "Withdraw all invitations to {vem}" },
  radera: { sv: "Radera uppgifter", en: "Delete data" },
  raderaNamn: { sv: "Radera uppgifterna om {vem}", en: "Delete the data about {vem}" },
  bekraftaGruppTitel: { sv: "Bjud in {vem} till hela gruppen?", en: "Invite {vem} to the whole group?" },
  bekraftaGruppSer: {
    sv: "Gästen ser gruppens chatt, med hela historiken från början, och allt i kalendern, ärendena och biblioteket. Gästen kan svara och rösta i kalendern men inte skriva eller ändra något.",
    en: "The guest sees the group's chat, with the whole history from the beginning, and everything in the calendar, the cases and the library. The guest can answer and vote in the calendar but cannot write or change anything.",
  },
  bekraftaGruppInte: { sv: "Gästen ser inte medlemmarnas e-postadresser och kommer inte åt något annat i appen.", en: "The guest does not see the members' email addresses and cannot reach anything else in the app." },
  bekraftaGruppTillbaka: {
    sv: "Det gästen hunnit läsa eller ladda ned går inte att ta tillbaka. Dras inbjudan tillbaka stängs åtkomsten vid gästens nästa anrop, och en fil som redan öppnats går att nå i högst {minuter} minuter till.",
    en: "What the guest has already read or downloaded cannot be taken back. If the invitation is withdrawn, access is closed at the guest's next request, and a file that has already been opened can be reached for at most {minuter} more minutes.",
  },
  bekraftaGruppKnapp: { sv: "Bjud in", en: "Invite" },
  bekraftaRaderaTitel: { sv: "Radera uppgifterna om {vem}?", en: "Delete the data about {vem}?" },
  bekraftaRaderaText: {
    sv: "Inbjudningarna, inloggningarna, räknarna, svaren och rösterna tas bort och platsen blir ledig. Det går inte att ångra. Personen kan bjudas in igen, som en ny gäst.",
    en: "The invitations, the sign-ins, the counters, the answers and the votes are removed and the place becomes free. It cannot be undone. The person can be invited again, as a new guest.",
  },
  bekraftaRaderaKnapp: { sv: "Radera", en: "Delete" },
  avbryt: { sv: "Avbryt", en: "Cancel" },
  stang: { sv: "Stäng", en: "Close" },
};

/** Felkoderna ur tjänsten (`GASTFELKODER`) som vyn har en egen text för. Övriga får felets eget meddelande, eller reservtexten. */
const FELKOD_TILL_ORD = /** @type {Record<string, string>} */ ({
  "platser-slut": "platserFulla",
  "ogiltig-epost": "felEpost",
  "ogiltigt-namn": "felNamn",
  "brev-misslyckades": "felBrev",
  "ej-behorig": "felEjBehorig",
});

/** Tonen på statusmärket. Den som kräver att någon gör något (utgången) är varningen, det som är klart är grönt. */
const STATUSTON = /** @type {const} */ ({ vantar: "neutral", utgangen: "warning", inloggad: "info", "har-rostat": "success", aterkallad: "neutral" });

/**
 * @typedef {object} Gast
 * @property {string} id Inbjudans id (dokumentets id). Det appen skickar tillbaka till `onSkickaOm` och `onAterkalla`.
 * @property {string} epost
 * @property {string} [namn]
 * @property {"aterkallad" | "utgangen" | "har-rostat" | "inloggad" | "vantar"} [status] Ur `lista` (tjänsten). Saknas den härleds den här ur raden (`gastStatus`).
 * @property {number | null} [aterkallad]
 * @property {number | null} [forstInloggad]
 * @property {number | null} [lankGiltigTill]
 */

/**
 * @typedef {object} PersonInbjudan
 * @property {string} id
 * @property {{ slag: string }} omfang
 * @property {string | null} [titel] Händelsens rubrik, för en inbjudan till en omröstning.
 * @property {"aterkallad" | "utgangen" | "har-rostat" | "inloggad" | "vantar"} [status]
 */

/**
 * @typedef {object} Person
 * @property {string} gastId
 * @property {string} epost
 * @property {string} [namn]
 * @property {"aterkallad" | "utgangen" | "har-rostat" | "inloggad" | "vantar"} [status] Den mest aktiva av personens inbjudningar.
 * @property {ReadonlyArray<PersonInbjudan>} inbjudningar
 */

/**
 * Gästerna på en omröstning, för en medlem: lista, bjud in, skicka igen, dra tillbaka, och hur många av de gratis platserna som används (0.131.0, cllp/lifehub.app#389).
 *
 * ══ ⛔ VYN RITAR, SERVERN AVGÖR ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Komponenten vet inte vem som får bjuda in: den ritar formuläret bara när appen ger `onBjud`, och tjänsten (`createGastService`) prövar medlemskapet och appens regel (`farBjuda`)
 * på nytt vid varje anrop. Ritningen är en artighet och inget skydd. Taket (`GAST_PLATSER_GRATIS`) likaså: vyn visar "3 av 5" och spärrar knappen vid 5, men det som stoppar den sjätte är att
 * platsdokumentet inte går att skapa. Vyn läser aldrig en nyckel, en länk eller en session, för de finns inte i raderna den får.
 *
 * ⛔ ETT FEL SOM KOMMER MED EN KOD (`fel.kod`, `GASTFELKODER`) FÅR EN EGEN TEXT, OCH ETT SOM INTE GÖR DET FÅR SITT EGET MEDDELANDE. Ett fel som tystas är en inbjudan som ser skickad ut.
 *
 * ⛔ TOMT ÄR ETT SVAR. En lista utan gäster säger det (`inga`), så att "inga" inte går att förväxla med "inte hämtad".
 *
 * ⛔ KNAPPARNA VISAR VÄNTAN SJÄLVA (`OpsButton` sedan 0.129.0): ger `onBjud`, `onSkickaOm` och `onAterkalla` ett löfte är knappen upptagen tills det är klart.
 *
 * @param {object} props
 * @param {ReadonlyArray<Gast>} [props.gaster] Gästerna på den här omröstningen (tjänstens `lista(...).gaster`, eller appens läsning av `gastinbjudningar`). Antingen den eller `personer`.
 * @param {ReadonlyArray<Person>} [props.personer] (0.132.0) Gästerna i hela gruppen, en rad per person med inbjudningarna under (tjänstens `lista({ groupId }).personer`). Ger gruppläget.
 * @param {{ anvanda: number, totalt: number }} props.platser Hur många av platserna som används (tjänstens `lista(...).platser`). Serverns siffra, inte en räkning av raderna: platserna är serverns bokföring.
 * @param {ReadonlyArray<string>} [props.harRostat] `gastId` för de gäster som appen vet har röstat. Ger status `har-rostat`.
 * @param {(inmatning: { epost: string, namn: string }) => void | Promise<unknown>} [props.onBjud] Bjuder in, eller bjuder in en återkallad igen. Utelämnad: ingen knapp och inget formulär.
 * @param {(inmatning: { epost: string, namn: string }) => void | Promise<unknown>} [props.onBjudGrupp] (0.132.0) Bjuder in till hela gruppen, efter att medlemmen bekräftat i dialogen. Bara i gruppläget.
 * @param {(arg: { id: string }) => void | Promise<unknown>} [props.onSkickaOm]
 * @param {(arg: { id: string }) => void | Promise<unknown>} [props.onAterkalla]
 * @param {(arg: { gastId: string }) => void | Promise<unknown>} [props.onAterkallaAlla] (0.132.0) Drar tillbaka alla personens inbjudningar i gruppen. Bara i gruppläget.
 * @param {(arg: { gastId: string, epost: string }) => void | Promise<unknown>} [props.onRadera] (0.132.0) Raderar personens uppgifter, efter att medlemmen bekräftat i dialogen. Utelämnad: ingen knapp.
 * @param {number} [props.nu] Millisekunder, för "länken har gått ut". Förval `Date.now()`. Provens enda sätt att låta en länk gå ut.
 * @param {string} [props.sprak]
 * @param {Partial<Record<keyof typeof ORD_OPSGASTLISTA, string>>} [props.ord] Egna texter, som vinner över ordboken.
 */
export function OpsGastLista({ gaster, personer, platser, harRostat = [], onBjud, onBjudGrupp, onSkickaOm, onAterkalla, onAterkallaAlla, onRadera, nu, sprak = "sv", ord }) {
  if (personer !== undefined && gaster !== undefined) {
    throw new Error("OpsGastLista: ange antingen gaster (en omröstning) eller personer (hela gruppen), inte båda. Två listor över samma gäster hade kunnat säga olika saker.");
  }
  const gruppLage = personer !== undefined;
  const rader = gruppLage ? personer : gaster;
  if (!Array.isArray(rader)) {
    throw new Error(`OpsGastLista: ${gruppLage ? "personer" : "gaster"} måste vara en lista, tom när det inte finns några. Utan den går det inte att skilja 'inga gäster' från 'inte hämtad'.`);
  }
  if (!platser || !Number.isInteger(platser.anvanda) || !Number.isInteger(platser.totalt) || platser.anvanda < 0 || platser.totalt < 1) {
    throw new Error("OpsGastLista: platser krävs, { anvanda, totalt } med heltal (tjänstens lista().platser). Vyn gissar inte serverns siffra.");
  }
  if (gruppLage) {
    for (const p of rader) {
      if (!p || typeof p.gastId !== "string" || typeof p.epost !== "string" || !Array.isArray(p.inbjudningar)) throw new Error("OpsGastLista: varje person har { gastId, epost, inbjudningar } (tjänstens lista({ groupId }).personer).");
      for (const i of p.inbjudningar) if (!i || typeof i.id !== "string" || typeof i.omfang?.slag !== "string") throw new Error("OpsGastLista: varje inbjudan har { id, omfang: { slag } }.");
    }
    if (onBjud !== undefined) throw new Error("OpsGastLista: onBjud hör till listan över en omröstning. Hela gruppen bjuds in med onBjudGrupp.");
  } else {
    for (const g of rader) {
      if (!g || typeof g.id !== "string" || typeof g.epost !== "string") throw new Error("OpsGastLista: varje gäst har { id, epost }.");
    }
    if (onBjudGrupp !== undefined || onAterkallaAlla !== undefined) throw new Error("OpsGastLista: onBjudGrupp och onAterkallaAlla hör till listan över hela gruppen (personer).");
  }
  for (const [namn, f] of /** @type {const} */ ([["onBjud", onBjud], ["onBjudGrupp", onBjudGrupp], ["onSkickaOm", onSkickaOm], ["onAterkalla", onAterkalla], ["onAterkallaAlla", onAterkallaAlla], ["onRadera", onRadera]])) {
    if (f !== undefined && typeof f !== "function") throw new Error(`OpsGastLista: ${namn} måste vara en funktion (eller utelämnas).`);
  }
  const t = { ...forvalda(ORD_OPSGASTLISTA, sprak), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  const rubrikId = useId();
  const [epost, setEpost] = useState("");
  const [namn, setNamn] = useState("");
  const [fel, setFel] = useState("");
  const [radfel, setRadfel] = useState(/** @type {Record<string, string>} */ ({}));
  const [bekrafta, setBekrafta] = useState(/** @type {{ slag: "grupp", epost: string, namn: string } | { slag: "radera", gastId: string, epost: string, namn: string } | null} */ (null));
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);

  const fulla = platser.anvanda >= platser.totalt;
  const rostat = new Set(harRostat);
  const klocka = nu ?? Date.now();

  /** @param {unknown} e @returns {string} */
  function felText(e) {
    const kod = e && typeof e === "object" ? /** @type {{ kod?: unknown }} */ (e).kod : undefined;
    const ordNyckel = typeof kod === "string" ? FELKOD_TILL_ORD[kod] : undefined;
    if (ordNyckel) return t[ordNyckel].replace("{totalt}", String(platser.totalt)).replace("{max}", String(MAX_GASTNAMN));
    return e instanceof Error && e.message ? e.message : t.felReserv;
  }

  async function bjud() {
    if (!onBjud) return;
    setFel("");
    if (normaliseraGastepost(epost) === null) {
      setFel(t.felEpost);
      return;
    }
    if (namn.trim().length > MAX_GASTNAMN) {
      setFel(t.felNamn.replace("{max}", String(MAX_GASTNAMN)));
      return;
    }
    try {
      await onBjud({ epost: epost.trim(), namn: namn.trim() });
      if (levande.current) {
        setEpost("");
        setNamn("");
      }
    } catch (e) {
      if (levande.current) setFel(felText(e));
      // ⛔ Felet sväljs inte: knappen blir ledig igen och meddelandet står kvar i formuläret. Inget unhandledrejection behövs eftersom felet har ett ställe att synas på.
    }
  }

  /**
   * @param {string} id
   * @param {(arg: any) => void | Promise<unknown>} fn
   * @param {any} arg
   */
  async function pa(id, fn, arg) {
    setRadfel((r) => ({ ...r, [id]: "" }));
    try {
      await fn(arg);
    } catch (e) {
      if (levande.current) setRadfel((r) => ({ ...r, [id]: felText(e) }));
    }
  }

  /** Öppnar bekräftelsen för att bjuda in till hela gruppen. Adressen prövas först, så att dialogen aldrig öppnas för något som ändå skulle nekas. */
  function begarGrupp(/** @type {string} */ e, /** @type {string} */ n) {
    setFel("");
    if (normaliseraGastepost(e) === null) {
      setFel(t.felEpost);
      return;
    }
    if (n.trim().length > MAX_GASTNAMN) {
      setFel(t.felNamn.replace("{max}", String(MAX_GASTNAMN)));
      return;
    }
    setBekrafta({ slag: "grupp", epost: e.trim(), namn: n.trim() });
  }

  async function genomforBekraftelse() {
    const b = bekrafta;
    if (!b) return;
    setBekrafta(null);
    if (b.slag === "grupp") {
      if (!onBjudGrupp) return;
      try {
        await onBjudGrupp({ epost: b.epost, namn: b.namn });
        if (levande.current) {
          setEpost("");
          setNamn("");
        }
      } catch (e) {
        if (levande.current) setFel(felText(e));
      }
      return;
    }
    if (onRadera) await pa(b.gastId, onRadera, { gastId: b.gastId, epost: b.epost });
  }

  /** @param {string} omfangSlag @param {string | null | undefined} titel */
  function omfangText(omfangSlag, titel) {
    if (omfangSlag === "grupp") return t.omfang_grupp;
    return titel ? t.omfang_sak_titel.replace("{titel}", titel) : t.omfang_sak;
  }

  const bekraftaVem = bekrafta ? (bekrafta.namn ? bekrafta.namn : bekrafta.epost) : "";

  return (
    <section data-gastlista="" data-gastlista-lage={gruppLage ? "grupp" : "sak"} aria-labelledby={rubrikId} className="mt-4 flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={rubrikId} className="m-0 text-sektion uppercase text-ink-muted">{t.rubrik}</h2>
        <p data-gastlista-platser="" className="m-0 text-etikett text-ink-secondary">
          {t.platser.replace("{anvanda}", String(platser.anvanda)).replace("{totalt}", String(platser.totalt))}
        </p>
      </div>

      {rader.length === 0 ? (
        <p data-gastlista-tom="" className="m-0 text-etikett text-ink-muted">{gruppLage ? t.ingaGrupp : t.inga}</p>
      ) : gruppLage ? (
        <ul data-gastlista-lista="" className="m-0 flex list-none flex-col gap-2 p-0">
          {/** @type {ReadonlyArray<Person>} */ (rader).map((p) => {
            const vem = p.namn ? p.namn : p.epost;
            const status = /** @type {keyof typeof STATUSTON} */ (p.status ?? "vantar");
            const harAktiv = p.inbjudningar.some((i) => i.status !== "aterkallad");
            return (
              <li key={p.gastId} data-gast-person={p.gastId} data-gast-status={status} className="flex min-w-0 flex-col gap-2 rounded-base border border-line bg-raised p-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex min-w-0 flex-col">
                    <span data-gast-namn="" className="min-w-0 text-brod text-ink wrap-anywhere">{vem}</span>
                    {p.namn ? <span data-gast-epost="" className="min-w-0 text-meta text-ink-muted wrap-anywhere">{p.epost}</span> : null}
                  </div>
                  <OpsPill tone={STATUSTON[status]}>{t[`status_${status}`]}</OpsPill>
                </div>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {p.inbjudningar.map((i) => {
                    const istatus = /** @type {keyof typeof STATUSTON} */ (i.status ?? "vantar");
                    const aterkallad = istatus === "aterkallad";
                    return (
                      <li key={i.id} data-gast-inbjudan={i.id} data-gast-omfang={i.omfang.slag} data-gast-status={istatus} className="flex min-w-0 flex-col gap-2 border-t border-line pt-2">
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <span data-gast-omfangstext="" className="min-w-0 text-etikett text-ink-secondary wrap-anywhere">{omfangText(i.omfang.slag, i.titel)}</span>
                          <OpsPill tone={STATUSTON[istatus]}>{t[`status_${istatus}`]}</OpsPill>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {aterkallad ? (
                            i.omfang.slag === "grupp" && onBjudGrupp ? (
                              <OpsButton size="sm" variant="secondary" ariaLabel={t.bjudIgenNamn.replace("{vem}", vem)} onClick={() => begarGrupp(p.epost, p.namn ?? "")}>
                                {t.bjudIgen}
                              </OpsButton>
                            ) : null
                          ) : (
                            <>
                              {onSkickaOm ? (
                                <OpsButton size="sm" variant="secondary" ariaLabel={`${t.skickaIgenNamn.replace("{vem}", vem)} (${omfangText(i.omfang.slag, i.titel)})`} onClick={() => pa(p.gastId, onSkickaOm, { id: i.id })}>
                                  {t.skickaIgen}
                                </OpsButton>
                              ) : null}
                              {onAterkalla ? (
                                <OpsButton size="sm" variant="ghost" ariaLabel={`${t.draTillbakaNamn.replace("{vem}", vem)} (${omfangText(i.omfang.slag, i.titel)})`} onClick={() => pa(p.gastId, onAterkalla, { id: i.id })}>
                                  {t.draTillbaka}
                                </OpsButton>
                              ) : null}
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {(onAterkallaAlla && harAktiv) || onRadera ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
                    {onAterkallaAlla && harAktiv ? (
                      <OpsButton size="sm" variant="ghost" ariaLabel={t.draTillbakaAllaNamn.replace("{vem}", vem)} onClick={() => pa(p.gastId, onAterkallaAlla, { gastId: p.gastId })}>
                        {t.draTillbakaAlla}
                      </OpsButton>
                    ) : null}
                    {onRadera ? (
                      <OpsButton size="sm" variant="ghost" ariaLabel={t.raderaNamn.replace("{vem}", vem)} onClick={() => setBekrafta({ slag: "radera", gastId: p.gastId, epost: p.epost, namn: p.namn ?? "" })}>
                        {t.radera}
                      </OpsButton>
                    ) : null}
                  </div>
                ) : null}
                {radfel[p.gastId] ? <p role="alert" data-gast-fel="" className="m-0 text-etikett text-danger wrap-anywhere">{radfel[p.gastId]}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul data-gastlista-lista="" className="m-0 flex list-none flex-col gap-2 p-0">
          {/** @type {ReadonlyArray<Gast>} */ (rader).map((g) => {
            const vem = g.namn ? g.namn : g.epost;
            const status = /** @type {keyof typeof STATUSTON} */ (g.status ?? gastStatus(g, { nu: klocka, harRostat: rostat.has(gastIdEllerTom(g.epost)) }));
            const aterkallad = status === "aterkallad";
            return (
              <li key={g.id} data-gast={g.id} data-gast-status={status} className="flex min-w-0 flex-col gap-2 rounded-base border border-line bg-raised p-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex min-w-0 flex-col">
                    <span data-gast-namn="" className="min-w-0 text-brod text-ink wrap-anywhere">{vem}</span>
                    {g.namn ? <span data-gast-epost="" className="min-w-0 text-meta text-ink-muted wrap-anywhere">{g.epost}</span> : null}
                  </div>
                  <OpsPill tone={STATUSTON[status]}>{t[`status_${status}`]}</OpsPill>
                </div>
                {onBjud || onSkickaOm || onAterkalla || onRadera ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {aterkallad ? (
                      onBjud ? (
                        <OpsButton size="sm" variant="secondary" ariaLabel={t.bjudIgenNamn.replace("{vem}", vem)} onClick={() => pa(g.id, onBjud, { epost: g.epost, namn: g.namn ?? "" })}>
                          {t.bjudIgen}
                        </OpsButton>
                      ) : null
                    ) : (
                      <>
                        {onSkickaOm ? (
                          <OpsButton size="sm" variant="secondary" ariaLabel={t.skickaIgenNamn.replace("{vem}", vem)} onClick={() => pa(g.id, onSkickaOm, { id: g.id })}>
                            {t.skickaIgen}
                          </OpsButton>
                        ) : null}
                        {onAterkalla ? (
                          <OpsButton size="sm" variant="ghost" ariaLabel={t.draTillbakaNamn.replace("{vem}", vem)} onClick={() => pa(g.id, onAterkalla, { id: g.id })}>
                            {t.draTillbaka}
                          </OpsButton>
                        ) : null}
                      </>
                    )}
                    {onRadera ? (
                      <OpsButton size="sm" variant="ghost" ariaLabel={t.raderaNamn.replace("{vem}", vem)} onClick={() => setBekrafta({ slag: "radera", gastId: gastIdEllerTom(g.epost), epost: g.epost, namn: g.namn ?? "" })}>
                        {t.radera}
                      </OpsButton>
                    ) : null}
                  </div>
                ) : null}
                {radfel[g.id] || radfel[gastIdEllerTom(g.epost)] ? <p role="alert" data-gast-fel="" className="m-0 text-etikett text-danger wrap-anywhere">{radfel[g.id] || radfel[gastIdEllerTom(g.epost)]}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      {onBjud || onBjudGrupp ? (
        <form
          data-gastlista-form=""
          noValidate
          className="flex min-w-0 flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <p className="m-0 text-etikett text-ink-secondary">{gruppLage ? t.ingressGrupp : t.ingress}</p>
          {fulla ? <p data-gastlista-fulla="" role="status" className="m-0 text-etikett text-ink">{t.platserFulla.replace("{totalt}", String(platser.totalt))}</p> : null}
          <OpsField label={t.epostEtikett}>
            <OpsInput value={epost} onChange={setEpost} type="email" autoComplete="off" disabled={fulla} tal={false} />
          </OpsField>
          <OpsField label={t.namnEtikett}>
            <OpsInput value={namn} onChange={setNamn} autoComplete="off" maxLength={MAX_GASTNAMN} disabled={fulla} tal={false} />
          </OpsField>
          {fel ? <p role="alert" data-gastlista-bjudfel="" className="m-0 text-etikett text-danger wrap-anywhere">{fel}</p> : null}
          <div>
            {gruppLage ? (
              <OpsButton variant="primary" disabled={fulla || epost.trim() === ""} onClick={() => begarGrupp(epost, namn)}>
                {t.bjudGrupp}
              </OpsButton>
            ) : (
              <OpsButton variant="primary" disabled={fulla || epost.trim() === ""} onClick={bjud}>
                {t.bjud}
              </OpsButton>
            )}
          </div>
        </form>
      ) : null}

      {bekrafta ? (
        <OpsModal
          open
          onOpenChange={(o) => {
            if (!o) setBekrafta(null);
          }}
          size="sm"
          title={(bekrafta.slag === "grupp" ? t.bekraftaGruppTitel : t.bekraftaRaderaTitel).replace("{vem}", bekraftaVem)}
          closeLabel={t.stang}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <OpsButton variant="secondary" onClick={() => setBekrafta(null)}>
                {t.avbryt}
              </OpsButton>
              <OpsButton variant={bekrafta.slag === "grupp" ? "primary" : "danger"} onClick={genomforBekraftelse}>
                {bekrafta.slag === "grupp" ? t.bekraftaGruppKnapp : t.bekraftaRaderaKnapp}
              </OpsButton>
            </div>
          }
        >
          {bekrafta.slag === "grupp" ? (
            <div data-gastlista-bekrafta="grupp" className="flex min-w-0 flex-col gap-3 text-brod text-ink-secondary">
              <p className="m-0 font-medium text-ink">{t.bekraftaGruppSer}</p>
              <p className="m-0">{t.bekraftaGruppInte}</p>
              <p className="m-0">{t.bekraftaGruppTillbaka.replace("{minuter}", String(Math.round(SIGNERAD_SEKUNDER / 60)))}</p>
            </div>
          ) : (
            <p data-gastlista-bekrafta="radera" className="m-0 text-brod text-ink-secondary">{t.bekraftaRaderaText}</p>
          )}
        </OpsModal>
      ) : null}
    </section>
  );
}

/**
 * Gästens identitet ur adressen, eller en tom text om raden bär en adress som inte går att härleda ur (en gammal eller trasig rad ska inte fälla hela listan).
 * @param {string} epost
 * @returns {string}
 */
function gastIdEllerTom(epost) {
  try {
    return gastId(epost);
  } catch {
    return "";
  }
}

export { GAST_PLATSER_GRATIS };
