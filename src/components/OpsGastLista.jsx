import { useEffect, useId, useRef, useState } from "react";
import { SIGNERAD_SEKUNDER } from "../lib/delning.js";
import { GAST_PLATSER_GRATIS, GASTLANKDAGAR, MAX_GASTNAMN, gastId, gastStatus, normaliseraGastepost, normaliseraGasttelefon } from "../lib/gast.js";
import { cx } from "../lib/cx.js";
import { definierade, forvalda } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { OpsPill } from "./OpsPill.jsx";
import { OpsSegmented } from "./OpsSegmented.jsx";
import { OpsCheckbox, OpsSwitch } from "./OpsToggle.jsx";
import { ChevronNedIkon } from "./icons.jsx";

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
  skickaIgenPagar: { sv: "Skickar…", en: "Sending…" },
  skickaIgenKlar: { sv: "En ny länk är skickad till {vem}. Den gäller i {dagar} dagar, och den förra länken fungerar inte längre.", en: "A new link has been sent to {vem}. It is valid for {dagar} days, and the previous link no longer works." },
  kopieraLank: { sv: "Kopiera länk", en: "Copy link" },
  kopieraLankNamn: { sv: "Kopiera länken till {vem}", en: "Copy the link to {vem}" },
  kopieraLankPagar: { sv: "Hämtar länken…", en: "Getting the link…" },
  kopieraLankFaltNamn: { sv: "Länk till {vem}", en: "Link for {vem}" },
  kopieraLankKnapp: { sv: "Kopiera", en: "Copy" },
  kopieraLankKopierad: { sv: "Kopierad", en: "Copied" },
  kopieraLankMarkerad: { sv: "Markerad, kopiera den med Kopiera i menyn", en: "Selected, copy it with Copy in the menu" },
  kopieraLankGiltig: { sv: "Samma länk som i mejlet. Den gäller till {datum}.", en: "The same link as in the email. It is valid until {datum}." },
  kopieraLankInget: { sv: "Inget mejl skickades.", en: "No email was sent." },
  kopieraLankDela: { sv: "Dela", en: "Share" },
  kopieraLankDelaRubrik: { sv: "Inbjudan till {grupp}", en: "Invitation to {grupp}" },
  kopieraLankDelaRubrikUtanGrupp: { sv: "Inbjudan", en: "Invitation" },
  // ⛔ (0.200.0, cllp/ops-framework#540) Gästen skriver inget: länken loggar in direkt. Texten sade förut att gästen skulle skriva sin adress (eller sitt nummer), och en sådan text hade skickat gästen
  // att leta efter ett fält som inte finns. En text för båda slagen, eftersom de inte längre skiljer sig (regel 2).
  kopieraLankDelaText: { sv: "Öppna länken. Du behöver inget konto.", en: "Open the link. You do not need an account." },
  kopieraLankDelaFel: { sv: "Det gick inte att dela. Kopiera länken i stället.", en: "Could not share. Copy the link instead." },
  felValv: { sv: "Länken kunde inte sparas för kopiering. Inbjudan finns: tryck Skicka igen.", en: "The link could not be saved for copying. The invitation exists: press Send again." },
  felIngenKopia: { sv: "Den här länken skapades innan länkar sparades. Tryck Skicka igen en gång, sedan går den att kopiera.", en: "This link was created before links were saved. Press Send again once, then it can be copied." },
  felUtgangen: { sv: "Länken har gått ut. Tryck Skicka igen för en ny.", en: "The link has expired. Press Send again for a new one." },
  draTillbaka: { sv: "Dra tillbaka", en: "Withdraw" },
  draTillbakaNamn: { sv: "Dra tillbaka inbjudan till {vem}", en: "Withdraw the invitation to {vem}" },
  draTillbakaPagar: { sv: "Drar tillbaka…", en: "Withdrawing…" },
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
    // (0.203.0, lifehub.app#691) Nedladdning är av för en ny gäst. Texten sade förut att gästen kan ladda ned, och det är inte längre sant förrän någon slagit på det.
    sv: "En gäst får ett mejl med en länk och kan följa gruppen utan konto: läsa och skriva i chatten, svara och rösta i kalendern och läsa och spela i biblioteket. Ladda ned filer får gästen bara om det slås på. Gästen ser inte gruppens ärenden, bara de som gruppen delegerar till hen.",
    en: "A guest gets an email with a link and can follow the group without an account: read and write in the chat, answer and vote in the calendar, and read and play in the library. The guest may download files only if that is switched on. The guest does not see the group's cases, only those the group delegates to them.",
  },
  ingaGrupp: { sv: "Inga gäster har bjudits in till gruppen.", en: "No guests have been invited to the group." },
  bjudGrupp: { sv: "Bjud in gäst till hela gruppen", en: "Invite a guest to the whole group" },
  omfang_grupp: { sv: "Hela gruppen", en: "The whole group" },
  omfang_sak: { sv: "Omröstning", en: "Vote" },
  omfang_sak_titel: { sv: "Omröstning: {titel}", en: "Vote: {titel}" },
  // (0.146.0) En inbjudan att svara på en händelse (`delta`) och vad gästen svarat. Svaret hör bara till en delta-rad (`deltasvar`); en omröstning eller hela gruppen har inget.
  omfang_delta: { sv: "Svar på händelse", en: "Reply to event" },
  omfang_delta_titel: { sv: "Svar på händelse: {titel}", en: "Reply to event: {titel}" },
  svar_kommer: { sv: "Kommer", en: "Coming" },
  svar_kommerInte: { sv: "Kommer inte", en: "Not coming" },
  svar_kanske: { sv: "Kanske", en: "Maybe" },
  svar_osvarat: { sv: "Har inte svarat", en: "Has not answered" },
  draTillbakaAlla: { sv: "Dra tillbaka alla", en: "Withdraw all" },
  draTillbakaAllaNamn: { sv: "Dra tillbaka alla inbjudningar till {vem}", en: "Withdraw all invitations to {vem}" },
  radera: { sv: "Radera uppgifter", en: "Delete data" },
  raderaNamn: { sv: "Radera uppgifterna om {vem}", en: "Delete the data about {vem}" },
  bekraftaGruppTitel: { sv: "Bjud in {vem} till hela gruppen?", en: "Invite {vem} to the whole group?" },
  bekraftaGruppSer: {
    sv: "Gästen ser gruppens chatt, med hela historiken från början, och kan skriva i den. Gästen ser kalendern och händelserna och kan svara och rösta, och kan läsa och spela i biblioteket. Gästen ser inte gruppens ärenden, bara de som gruppen delegerar till hen, och kan kommentera dem och markera dem klara.",
    en: "The guest sees the group's chat, with the whole history from the beginning, and can write in it. The guest sees the calendar and the events and can answer and vote, and can read and play in the library. The guest does not see the group's cases, only those the group delegates to them, and can comment on them and mark them done.",
  },
  // (0.203.0) Vad formulärets val betyder, i dialogen. Utan val (Bjud in igen på en rad) står ingen av dem: det sparade värdet ändras då inte.
  bekraftaGruppLaddaNedPa: { sv: "Gästen får också ladda ned filer ur biblioteket, så länge gruppen tillåter nedladdning.", en: "The guest may also download files from the library, as long as the group allows downloads." },
  bekraftaGruppLaddaNedAv: { sv: "Gästen får inte ladda ned filer.", en: "The guest may not download files." },
  bekraftaGruppInte: { sv: "Gästen ser inte medlemmarnas e-postadresser, kan inte ladda upp eller bifoga något och kommer inte åt något annat i appen. Det gästen skriver märks Gäst.", en: "The guest does not see the members' email addresses, cannot upload or attach anything and cannot reach anything else in the app. What the guest writes is marked Guest." },
  bekraftaGruppTillbaka: {
    sv: "Det gästen hunnit läsa eller ladda ned går inte att ta tillbaka. Dras inbjudan tillbaka stängs åtkomsten vid gästens nästa anrop, och en fil som redan öppnats går att nå i högst {minuter} minuter till.",
    en: "What the guest has already read or downloaded cannot be taken back. If the invitation is withdrawn, access is closed at the guest's next request, and a file that has already been opened can be reached for at most {minuter} more minutes.",
  },
  bekraftaGruppKnapp: { sv: "Bjud in", en: "Invite" },
  bekraftaGruppPagar: { sv: "Skickar inbjudan…", en: "Sending the invitation…" },
  bekraftaRaderaTitel: { sv: "Radera uppgifterna om {vem}?", en: "Delete the data about {vem}?" },
  bekraftaRaderaText: {
    sv: "Inbjudningarna, inloggningarna, räknarna, svaren, rösterna och meddelandena i chatten och kommentarerna på ärenden som delegerats till gästen tas bort, ärendena slutar peka på gästen, och platsen blir ledig. Det går inte att ångra. Personen kan bjudas in igen, som en ny gäst.",
    en: "The invitations, the sign-ins, the counters, the answers, the votes and the messages in the chat and the comments on cases delegated to the guest are removed, the cases no longer point to the guest, and the place becomes free. It cannot be undone. The person can be invited again, as a new guest.",
  },
  bekraftaRaderaKnapp: { sv: "Radera", en: "Delete" },
  bekraftaRaderaPagar: { sv: "Raderar…", en: "Deleting…" },
  avbryt: { sv: "Avbryt", en: "Cancel" },
  stang: { sv: "Stäng", en: "Close" },
  // ── Telefon (0.197.0, cllp/lifehub.app#661): inbjudan med ett nummer, länken delas från den egna telefonen ──
  kontaktVal: { sv: "Bjud in med", en: "Invite with" },
  // Ingressen när Telefon är valt: gruppens ingress börjar med att gästen får ett mejl, och det gör en gäst med telefon inte.
  ingressGruppTelefon: {
    sv: "En gäst får en länk som du delar, till exempel som sms, och kan följa gruppen utan konto: läsa och skriva i chatten, svara och rösta i kalendern och läsa och spela i biblioteket. Ladda ned filer får gästen bara om det slås på. Gästen ser inte gruppens ärenden, bara de som gruppen delegerar till hen.",
    en: "A guest gets a link that you share, for example as a text message, and can follow the group without an account: read and write in the chat, answer and vote in the calendar, and read and play in the library. The guest may download files only if that is switched on. The guest does not see the group's cases, only those the group delegates to them.",
  },
  kontaktEpost: { sv: "E-post", en: "Email" },
  kontaktTelefon: { sv: "Telefon", en: "Phone" },
  telefonEtikett: { sv: "Telefonnummer", en: "Phone number" },
  telefonHjalp: { sv: "Inget sms skickas härifrån. Du får länken och delar den med Dela, till exempel som sms från din telefon.", en: "No text message is sent from here. You get the link and share it with Share, for example as a text from your phone." },
  felTelefon: { sv: "Det där ser inte ut som ett telefonnummer. Skriv det med riktnummer, 070 123 45 67, eller med landsnummer, +46 70 123 45 67.", en: "That does not look like a phone number. Write it with the area code, 070 123 45 67, or with the country code, +46 70 123 45 67." },
  telefonLank: { sv: "Inbjudan är klar. Dela länken med {vem}.", en: "The invitation is ready. Share the link with {vem}." },
  telefonUtanLank: { sv: "Inbjudan finns. Tryck Kopiera länk på gästens rad för att dela den.", en: "The invitation exists. Press Copy link on the guest's row to share it." },
  kopieraLankGiltigTelefon: { sv: "Länken gäller till {datum}.", en: "The link is valid until {datum}." },
  kopieraLankIngetTelefon: { sv: "Inget sms skickades. Dela länken själv.", en: "No text message was sent. Share the link yourself." },
  nyLank: { sv: "Ny länk", en: "New link" },
  nyLankNamn: { sv: "Ge {vem} en ny länk", en: "Give {vem} a new link" },
  nyLankPagar: { sv: "Skapar…", en: "Creating…" },
  // ── Nedladdning per gäst (0.203.0, lifehub.app#691): av som förval, i formuläret och på varje gruppinbjudan ──
  laddaNed: { sv: "Får ladda ned filer", en: "May download files" },
  // ── Hopfällbara gästkort i gruppläget (0.204.0, CP 2026-11-08) ──
  visaDetaljer: { sv: "Visa detaljer för {vem}", en: "Show details for {vem}" },
  nyLankKlar: { sv: "En ny länk är skapad. Den gäller i {dagar} dagar, och den förra länken fungerar inte längre. Dela den nya.", en: "A new link has been created. It is valid for {dagar} days, and the previous link no longer works. Share the new one." },
  // ── I gruppens medlemsvy (`OpsMedlemmar`, 0.132.0): gästen är ett val i Roll ──
  rollGast: { sv: "Gäst (utan konto)", en: "Guest (no account)" },
  medlemsNotMedGast: {
    sv: "Inloggningen är Google. En adress utan Google-konto kan bjudas in som gäst.",
    en: "Sign-in is Google. An address without a Google account can be invited as a guest.",
  },
};

/** Felkoderna ur tjänsten (`GASTFELKODER`) som vyn har en egen text för. Övriga får felets eget meddelande, eller reservtexten. */
const FELKOD_TILL_ORD = /** @type {Record<string, string>} */ ({
  "platser-slut": "platserFulla",
  "ogiltig-epost": "felEpost",
  "ogiltig-telefon": "felTelefon",
  "ogiltigt-namn": "felNamn",
  "brev-misslyckades": "felBrev",
  "ej-behorig": "felEjBehorig",
  "valv-misslyckades": "felValv",
  "ingen-kopia": "felIngenKopia",
  utgangen: "felUtgangen",
});

/** (0.146.0) Tonen på ett deltasvar. `null` (inte svarat än) är ingen varning: det är ett läge. */
const SVARSTON = /** @type {const} */ ({ kommer: "success", kommerInte: "neutral", kanske: "info", osvarat: "neutral" });

/** Tonen på statusmärket. Den som kräver att någon gör något (utgången) är varningen, det som är klart är grönt. */
const STATUSTON = /** @type {const} */ ({ vantar: "neutral", utgangen: "warning", inloggad: "info", "har-rostat": "success", aterkallad: "neutral" });

/**
 * Texten för ett fel ur tjänsten: ett med `kod` (`GASTFELKODER`) får en egen text, ett utan får sitt meddelande, och ett utan meddelande reservtexten. Delad med `OpsMedlemmar`, så att ett fel från
 * en gästinbjudan säger samma sak var den än görs.
 *
 * ⛔ EXPORTERAD FRÅN FILEN FÖR `OpsMedlemmar`, INTE UR RAMVERKET (`src/index.js`).
 *
 * @param {unknown} e
 * @param {Record<string, string>} t Orden (`forvalda(ORD_OPSGASTLISTA, sprak)`).
 * @param {number} totalt Taket, för texten "Gruppen har {totalt} gäster".
 * @returns {string}
 */
export function gastFelText(e, t, totalt) {
  const kod = e && typeof e === "object" ? /** @type {{ kod?: unknown }} */ (e).kod : undefined;
  const ordNyckel = typeof kod === "string" ? FELKOD_TILL_ORD[kod] : undefined;
  if (ordNyckel) return t[ordNyckel].replace("{totalt}", String(totalt)).replace("{max}", String(MAX_GASTNAMN));
  return e instanceof Error && e.message ? e.message : t.felReserv;
}

/**
 * Länken till en inbjudan (0.189.0): ett skrivskyddat fält, en Kopiera-knapp och, där webbläsaren kan dela (`navigator.share`, telefonens delningsmeny: SMS, WhatsApp, mejl), en Dela-knapp
 * (CP 2026-11-05: "en bra sak är att kunna skicka den via SMS också eller på annat sätt till den jag vill bjuda in"). Båda anropas direkt i klickhanteraren, eftersom webbläsaren kräver ett
 * användartryck. ⛔ Misslyckas kopieringen (ingen `navigator.clipboard`, eller den kastar) markeras texten och det står vad medlemmen gör i stället; misslyckas delningen (utom att personen
 * stängde menyn: `AbortError`) står det att länken går att kopiera. Inget tyst fel (regel 5).
 *
 * (0.197.0) `telefon`: länken gäller ett telefonnummer. Raden under säger att inget sms skickades i stället för "samma länk som i mejlet". (Delningens text är densamma för båda slagen sedan 0.200.0.)
 *
 * @param {{ lank: { url: string, lankGiltigTill?: number }, vem: string, t: Record<string, string>, sprak: string, gruppnamn?: string, telefon?: boolean }} props
 */
function GastLank({ lank, vem, t, sprak, gruppnamn, telefon = false }) {
  const { url, lankGiltigTill } = lank;
  const ruta = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [besked, setBesked] = useState("");
  const kanDela = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const datum = Number.isFinite(lankGiltigTill) ? new Intl.DateTimeFormat(sprak === "en" ? "en-GB" : "sv-SE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(/** @type {number} */ (lankGiltigTill))) : "";
  async function kopiera() {
    setBesked("");
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") throw new Error("ingen urklippsfunktion");
      await navigator.clipboard.writeText(url);
      setBesked(t.kopieraLankKopierad);
    } catch {
      ruta.current?.querySelector("input")?.select();
      setBesked(t.kopieraLankMarkerad);
    }
  }
  async function dela() {
    setBesked("");
    try {
      await navigator.share({ title: gruppnamn ? t.kopieraLankDelaRubrik.replace("{grupp}", gruppnamn) : t.kopieraLankDelaRubrikUtanGrupp, text: t.kopieraLankDelaText, url });
    } catch (e) {
      if (/** @type {{ name?: string }} */ (e)?.name === "AbortError") return;
      setBesked(t.kopieraLankDelaFel);
    }
  }
  return (
    <div ref={ruta} data-gast-lank={telefon ? "telefon" : ""} className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <OpsInput value={url} onChange={() => {}} readOnly tal={false} ariaLabel={t.kopieraLankFaltNamn.replace("{vem}", vem)} />
        </div>
        <OpsButton size="sm" variant="secondary" onClick={kopiera}>
          {t.kopieraLankKnapp}
        </OpsButton>
        {kanDela ? (
          <OpsButton size="sm" variant="secondary" onClick={dela}>
            {t.kopieraLankDela}
          </OpsButton>
        ) : null}
      </div>
      <p className="m-0 text-etikett text-ink-secondary wrap-anywhere">
        {datum ? `${(telefon ? t.kopieraLankGiltigTelefon : t.kopieraLankGiltig).replace("{datum}", datum)} ` : ""}
        {telefon ? t.kopieraLankIngetTelefon : t.kopieraLankInget}
      </p>
      {besked ? <p role="status" data-gast-lank-besked="" className="m-0 text-etikett text-ink-secondary wrap-anywhere">{besked}</p> : null}
    </div>
  );
}

/**
 * Bekräftelsen innan en gäst bjuds in till hela gruppen, eller innan en gästs uppgifter raderas. Den säger vad medlemmen annars inte ser: gästen läser chattens hela historik, och det går inte att ta tillbaka.
 * Delad med `OpsMedlemmar` (en inbjudan där är samma sak som här).
 *
 * ⛔ EXPORTERAD FRÅN FILEN FÖR `OpsMedlemmar`, INTE UR RAMVERKET (`src/index.js`).
 *
 * ⛔ DIALOGEN STÅR KVAR TILLS SERVERN SVARAT (CP 2026-11-05: "Finns ingen progress-bar när man klickar på bjuden så man kan komma att trycka många
 * gånger"). Förut stängde den som anropade dialogen först och väntade sedan på servern. Då syntes ingenting under väntan, och formulärets knapp
 * var tryckbar igen med adressen kvar, så varje nytt tryck bjöd in en gång till. Nu ger `onBekrafta` ett löfte: knappen är upptagen (snurra och
 * spärr, `OpsButton`), Avbryt och stängningen gör ingenting under tiden, och den som anropade stänger dialogen när löftet är klart.
 *
 * (0.203.0) `laddaNed` på en gruppinbjudan: formulärets val, och dialogen säger vad det betyder. Utelämnat (Bjud in igen på en rad, `OpsMedlemmar`) står inget om nedladdning, eftersom det sparade värdet då inte ändras.
 *
 * @param {{ bekrafta: { slag: "grupp", epost?: string, telefon?: string, namn: string, laddaNed?: boolean } | { slag: "radera", gastId: string, epost?: string, telefon?: string, namn: string }, t: Record<string, string>, onBekrafta: () => Promise<unknown>, onAvbryt: () => void }} props
 */
export function GastBekraftelse({ bekrafta, t, onBekrafta, onAvbryt }) {
  const vem = bekrafta.namn || bekrafta.epost || bekrafta.telefon || "";
  const [pagar, setPagar] = useState(false);
  const pagarRef = useRef(false);
  const avbryt = () => {
    if (!pagarRef.current) onAvbryt();
  };
  const genomfor = async () => {
    pagarRef.current = true;
    setPagar(true);
    try {
      await onBekrafta();
    } finally {
      pagarRef.current = false;
      setPagar(false);
    }
  };
  return (
    <OpsModal
      open
      onOpenChange={(o) => {
        if (!o) avbryt();
      }}
      size="sm"
      title={(bekrafta.slag === "grupp" ? t.bekraftaGruppTitel : t.bekraftaRaderaTitel).replace("{vem}", vem)}
      closeLabel={t.stang}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <OpsButton variant="secondary" onClick={avbryt} disabled={pagar}>
            {t.avbryt}
          </OpsButton>
          <OpsButton variant={bekrafta.slag === "grupp" ? "primary" : "danger"} onClick={genomfor} busyLabel={bekrafta.slag === "grupp" ? t.bekraftaGruppPagar : t.bekraftaRaderaPagar}>
            {bekrafta.slag === "grupp" ? t.bekraftaGruppKnapp : t.bekraftaRaderaKnapp}
          </OpsButton>
        </div>
      }
    >
      {bekrafta.slag === "grupp" ? (
        <div data-gastlista-bekrafta="grupp" className="flex min-w-0 flex-col gap-3 text-etikett text-ink-secondary">
          <p className="m-0 font-medium text-ink">{t.bekraftaGruppSer}</p>
          {typeof bekrafta.laddaNed === "boolean" ? <p data-gastlista-bekrafta-laddaned={bekrafta.laddaNed ? "pa" : "av"} className="m-0">{bekrafta.laddaNed ? t.bekraftaGruppLaddaNedPa : t.bekraftaGruppLaddaNedAv}</p> : null}
          <p className="m-0">{t.bekraftaGruppInte}</p>
          <p className="m-0">{t.bekraftaGruppTillbaka.replace("{minuter}", String(Math.round(SIGNERAD_SEKUNDER / 60)))}</p>
        </div>
      ) : (
        <p data-gastlista-bekrafta="radera" className="m-0 text-etikett text-ink-secondary">{t.bekraftaRaderaText}</p>
      )}
    </OpsModal>
  );
}

/**
 * @typedef {object} Gast
 * @property {string} id Inbjudans id (dokumentets id). Det appen skickar tillbaka till `onSkickaOm` och `onAterkalla`.
 * @property {string} epost
 * @property {string} [namn]
 * @property {"aterkallad" | "utgangen" | "har-rostat" | "inloggad" | "vantar"} [status] Ur `lista` (tjänsten). Saknas den härleds den här ur raden (`gastStatus`).
 * @property {number | null} [aterkallad]
 * @property {number | null} [forstInloggad]
 * @property {number | null} [lankGiltigTill]
 * @property {{ slag: string, funktion?: string }} [omfang] Ur `lista`. En delta-rad har `funktion: "delta"`.
 * @property {"kommer" | "kommerInte" | "kanske" | null} [deltasvar] (0.146.0) Gästens svar på en händelse (`GASTDELTASVAR`), eller `null` så länge hen inte svarat. Saknas fältet hör raden inte till en delta-inbjudan.
 */

/**
 * @typedef {object} PersonInbjudan
 * @property {string} id
 * @property {{ slag: string, funktion?: string }} omfang
 * @property {string | null} [titel] Händelsens rubrik, för en inbjudan till en omröstning eller att svara på en händelse.
 * @property {"kommer" | "kommerInte" | "kanske" | null} [deltasvar] (0.146.0) Se `Gast`.
 * @property {"aterkallad" | "utgangen" | "har-rostat" | "inloggad" | "vantar"} [status]
 * @property {boolean} [laddaNed] (0.203.0) Bara en gruppinbjudan (`GASTGRUPPLISTFALT`): gästens egen nedladdning. (0.204.0) Alltid `true` eller `false` från tjänsten; något annat ritas som av.
 */

/**
 * @typedef {object} Person
 * @property {string} gastId
 * @property {string | null} epost (0.197.0) `null` för en gäst med telefonnummer.
 * @property {string | null} [telefon] (0.197.0) Numret i E.164 för en gäst som bjudits in med telefon, annars `null` eller utelämnat.
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
 * @param {(inmatning: { epost: string, namn: string, laddaNed?: boolean } | { telefon: string, namn: string, laddaNed?: boolean }) => void | Promise<unknown>} [props.onBjudGrupp] (0.132.0) Bjuder in till hela gruppen, efter att medlemmen bekräftat i dialogen. Bara i gruppläget.
 *   (0.197.0) Med Telefon vald får den `{ telefon, namn }` och ska ge tjänstens svar, minst `{ id }`: vyn hämtar då länken med `onKopieraLank` och visar den med Dela och Kopiera direkt.
 *   (0.203.0, lifehub.app#691) Från formuläret bär den också `laddaNed`, kryssrutan Får ladda ned filer (av som förval), som appen ger tjänstens `bjud`. Bjud in igen på en återkallad rad bär den inte: det sparade värdet står kvar.
 * @param {(arg: { id: string, pa: boolean }) => void | Promise<unknown>} [props.onNedladdning] (0.203.0, lifehub.app#691) Slår på eller av nedladdning för en gäst (tjänstens `sattNedladdning`). Ger ett reglage
 *   Får ladda ned filer på varje gruppinbjudan, påslaget när raden har `laddaNed: true` och avslaget annars, och en
 *   återkallad går inte att ändra. Utelämnad: inget reglage. Bara i gruppläget. (0.204.0) Reglaget är hela regeln: ingen inställning på gruppen står över det.
 * @param {boolean} [props.medTelefon] (0.197.0, cllp/lifehub.app#661) Ger valet E-post eller Telefon i gruppens inbjudan. Kräver `onBjudGrupp` och `onKopieraLank`: utan länken når en telefoninbjudan ingen.
 *   ⛔ Ett val appen slår på, inget förval: en app vars `onBjudGrupp` bara skickar en adress hade fått en Telefon-knapp som alltid nekas.
 * @param {(arg: { id: string }) => void | Promise<unknown>} [props.onSkickaOm]
 * @param {(arg: { id: string }) => Promise<{ url: string, lankGiltigTill: number }>} [props.onKopieraLank] (0.189.0, CP 2026-11-05: "Jag skulle också vilja kunna se länken till inbjudningen, eller kopiera den.") Ger SAMMA länk som i mejlet, utan att skicka något mejl (tjänstens `kopieraLank`). Ger `{ url, lankGiltigTill }`, som visas i ett fält med en Kopiera-knapp och en Dela-knapp där webbläsaren kan dela. Utelämnad: ingen knapp.
 * @param {string} [props.gruppnamn] (0.189.0) Gruppens namn, för rubriken i delningsmenyn ("Inbjudan till {grupp}"). Utelämnad: "Inbjudan".
 * @param {(arg: { id: string }) => void | Promise<unknown>} [props.onAterkalla]
 * @param {(arg: { gastId: string }) => void | Promise<unknown>} [props.onAterkallaAlla] (0.132.0) Drar tillbaka alla personens inbjudningar i gruppen. Bara i gruppläget.
 * @param {(arg: { gastId: string, epost: string }) => void | Promise<unknown>} [props.onRadera] (0.132.0) Raderar personens uppgifter, efter att medlemmen bekräftat i dialogen. Utelämnad: ingen knapp.
 * @param {boolean} [props.utanRubrik] (0.132.0) Utan rubriken "Gäster" och platsraden: listan står under en annan rubrik (`OpsMedlemmar`, bland de väntande inbjudningarna). En tom lista ritar då ingenting alls i stället för "Inga gäster": den som äger rubriken avgör om det ska stå.
 * @param {number} [props.nu] Millisekunder, för "länken har gått ut". Förval `Date.now()`. Provens enda sätt att låta en länk gå ut.
 * @param {string} [props.sprak]
 * @param {Partial<Record<keyof typeof ORD_OPSGASTLISTA, string>>} [props.ord] Egna texter, som vinner över ordboken.
 */
export function OpsGastLista({ gaster, personer, platser, harRostat = [], onBjud, onBjudGrupp, onNedladdning, onSkickaOm, onKopieraLank, onAterkalla, onAterkallaAlla, onRadera, gruppnamn, medTelefon = false, utanRubrik = false, nu, sprak = "sv", ord }) {
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
      if (!p || typeof p.gastId !== "string" || !(typeof p.epost === "string" || typeof p.telefon === "string") || !Array.isArray(p.inbjudningar)) throw new Error("OpsGastLista: varje person har { gastId, epost, inbjudningar }, med telefon i stället för epost för en gäst med telefonnummer (tjänstens lista({ groupId }).personer).");
      for (const i of p.inbjudningar) if (!i || typeof i.id !== "string" || typeof i.omfang?.slag !== "string") throw new Error("OpsGastLista: varje inbjudan har { id, omfang: { slag } }.");
    }
    if (onBjud !== undefined) throw new Error("OpsGastLista: onBjud hör till listan över en omröstning. Hela gruppen bjuds in med onBjudGrupp.");
  } else {
    for (const g of rader) {
      if (!g || typeof g.id !== "string" || typeof g.epost !== "string") throw new Error("OpsGastLista: varje gäst har { id, epost }.");
    }
    if (onBjudGrupp !== undefined || onAterkallaAlla !== undefined || onNedladdning !== undefined) throw new Error("OpsGastLista: onBjudGrupp, onAterkallaAlla och onNedladdning hör till listan över hela gruppen (personer).");
    if (medTelefon) throw new Error("OpsGastLista: medTelefon hör till listan över hela gruppen (personer). En omröstning och en händelse bjuds in med e-post.");
  }
  if (medTelefon && (onBjudGrupp === undefined || onKopieraLank === undefined)) {
    throw new Error("OpsGastLista: medTelefon kräver onBjudGrupp och onKopieraLank. Inget sms skickas, så länken är det enda som når en gäst med telefonnummer.");
  }
  for (const [namn, f] of /** @type {const} */ ([["onBjud", onBjud], ["onBjudGrupp", onBjudGrupp], ["onNedladdning", onNedladdning], ["onSkickaOm", onSkickaOm], ["onKopieraLank", onKopieraLank], ["onAterkalla", onAterkalla], ["onAterkallaAlla", onAterkallaAlla], ["onRadera", onRadera]])) {
    if (f !== undefined && typeof f !== "function") throw new Error(`OpsGastLista: ${namn} måste vara en funktion (eller utelämnas).`);
  }
  const t = { ...forvalda(ORD_OPSGASTLISTA, sprak), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  const rubrikId = useId();
  const [epost, setEpost] = useState("");
  const [namn, setNamn] = useState("");
  // (0.197.0) E-post eller Telefon i gruppens inbjudan, och numret. Fälten är två, så att ett byte av val aldrig skickar en adress som nummer eller tvärtom.
  const [kontaktslag, setKontaktslag] = useState(/** @type {"epost" | "telefon"} */ ("epost"));
  const [telefon, setTelefon] = useState("");
  // (0.203.0) Kryssrutan Får ladda ned filer i gruppens inbjudan. Av som förval, och av igen efter en lyckad inbjudan.
  const [laddaNed, setLaddaNed] = useState(false);
  // Länken efter en inbjudan med telefon: den visas under formuläret direkt, med Dela och Kopiera.
  const [nyTelefonlank, setNyTelefonlank] = useState(/** @type {{ vem: string, url: string, lankGiltigTill: number } | null} */ (null));
  const [fel, setFel] = useState("");
  const [radfel, setRadfel] = useState(/** @type {Record<string, string>} */ ({}));
  // Beskedet efter ett lyckat Skicka igen (CP 2026-11-05: "Det skall vara en progress också som berättar vad den gör"). Utan det ändrades ingenting synligt efter ett tryck.
  const [radklar, setRadklar] = useState(/** @type {Record<string, string>} */ ({}));
  // Länkarna som hämtats, per inbjudans id. De ligger bara i minnet och försvinner när vyn stängs: servern kan inte läsa ut en länk i efterhand.
  const [lankar, setLankar] = useState(/** @type {Record<string, { url: string, lankGiltigTill: number }>} */ ({}));
  // (0.204.0) Gästkorten i gruppläget som är utfällda, per `gastId`. Alla är sammanfällda från början, och flera får vara utfällda samtidigt.
  const [utfallda, setUtfallda] = useState(/** @type {ReadonlySet<string>} */ (new Set()));
  const vaxlaUtfalld = (/** @type {string} */ gid) =>
    setUtfallda((fore) => {
      const nya = new Set(fore);
      if (nya.has(gid)) nya.delete(gid);
      else nya.add(gid);
      return nya;
    });
  const [bekrafta, setBekrafta] = useState(/** @type {{ slag: "grupp", epost?: string, telefon?: string, namn: string, laddaNed?: boolean } | { slag: "radera", gastId: string, epost?: string, telefon?: string, namn: string } | null} */ (null));
  const telefonValt = gruppLage && medTelefon && kontaktslag === "telefon";
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
  const felText = (e) => gastFelText(e, t, platser.totalt);

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
      // ⛔ (0.202.0, QA 2026-11-07, punkt 1 och 2 i cllp/lifehub.app#687) EN INBJUDAN TILL SAMMA PERSON BYTER NYCKEL, så en länk som visas under en rad slutar fungera. Den visade glöms innan anropet, som vid Skicka igen.
      setLankar({});
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
   * @param {string} [klar] Beskedet på raden när anropet lyckats. Utelämnat: inget besked (listan visar själv vad som ändrats).
   */
  async function pa(id, fn, arg, klar) {
    setRadfel((r) => ({ ...r, [id]: "" }));
    setRadklar((r) => ({ ...r, [id]: "" }));
    try {
      await fn(arg);
      if (klar && levande.current) setRadklar((r) => ({ ...r, [id]: klar }));
    } catch (e) {
      if (levande.current) setRadfel((r) => ({ ...r, [id]: felText(e) }));
    }
  }

  /**
   * Skicka igen byter nyckel, så en länk som visas för samma inbjudan slutar fungera i samma stund. Den tas bort innan anropet, så att listan aldrig visar en länk som inte går att använda.
   * @param {string} inbjudanId
   */
  function glomLank(inbjudanId) {
    setLankar((l) => {
      if (!(inbjudanId in l)) return l;
      const kvar = { ...l };
      delete kvar[inbjudanId];
      return kvar;
    });
  }

  /**
   * Hämtar länken till en inbjudan (`onKopieraLank`) och visar den under raden. Ett fel visas som radfel, som vid Skicka igen.
   * @param {string} radId Raden som får felet (som `pa`).
   * @param {string} inbjudanId
   * @param {{ behallKlar?: boolean }} [val] `behallKlar`: beskedet på raden står kvar (Ny länk för en gäst med telefon hämtar länken efter sitt eget besked).
   */
  async function hamtaLank(radId, inbjudanId, val = {}) {
    setRadfel((r) => ({ ...r, [radId]: "" }));
    if (!val.behallKlar) setRadklar((r) => ({ ...r, [radId]: "" }));
    try {
      const svar = await /** @type {NonNullable<typeof onKopieraLank>} */ (onKopieraLank)({ id: inbjudanId });
      if (!svar || typeof svar.url !== "string" || svar.url === "") throw new Error("onKopieraLank måste ge { url } med länken.");
      if (levande.current) setLankar((l) => ({ ...l, [inbjudanId]: { url: svar.url, lankGiltigTill: svar.lankGiltigTill } }));
    } catch (e) {
      if (levande.current) setRadfel((r) => ({ ...r, [radId]: felText(e) }));
    }
  }

  /**
   * (0.197.0) Öppnar bekräftelsen för en inbjudan med telefon. Numret prövas först med samma funktion som servern (`normaliseraGasttelefon`), och det är den normaliserade formen som skickas.
   * @param {string} tel
   * @param {string} n
   * @param {boolean} [valtLaddaNed] Formulärets val. Utelämnat från Bjud in igen på en rad: det sparade värdet ändras inte.
   */
  function begarGruppTelefon(tel, n, valtLaddaNed) {
    setFel("");
    setNyTelefonlank(null);
    const normal = normaliseraGasttelefon(tel);
    if (normal === null) {
      setFel(t.felTelefon);
      return;
    }
    if (n.trim().length > MAX_GASTNAMN) {
      setFel(t.felNamn.replace("{max}", String(MAX_GASTNAMN)));
      return;
    }
    setBekrafta({ slag: "grupp", telefon: normal, namn: n.trim(), ...(typeof valtLaddaNed === "boolean" ? { laddaNed: valtLaddaNed } : {}) });
  }

  /**
   * (0.197.0) Ny länk för en gäst med telefon: `onSkickaOm` byter nyckel utan brev, och den nya länken hämtas och visas direkt. Felet visas på raden, som vid Skicka igen.
   * @param {string} radId
   * @param {string} inbjudanId
   * @param {string} vem
   */
  async function nyLankTelefon(radId, inbjudanId, vem) {
    setRadfel((r) => ({ ...r, [radId]: "" }));
    setRadklar((r) => ({ ...r, [radId]: "" }));
    try {
      await /** @type {NonNullable<typeof onSkickaOm>} */ (onSkickaOm)({ id: inbjudanId });
    } catch (e) {
      if (levande.current) setRadfel((r) => ({ ...r, [radId]: felText(e) }));
      return;
    }
    if (levande.current) setRadklar((r) => ({ ...r, [radId]: t.nyLankKlar.replace("{vem}", vem).replace("{dagar}", String(GASTLANKDAGAR)) }));
    if (onKopieraLank) await hamtaLank(radId, inbjudanId, { behallKlar: true });
  }

  /**
   * Öppnar bekräftelsen för att bjuda in till hela gruppen. Adressen prövas först, så att dialogen aldrig öppnas för något som ändå skulle nekas.
   * @param {string} e
   * @param {string} n
   * @param {boolean} [valtLaddaNed] (0.203.0) Formulärets val. Utelämnat från Bjud in igen på en rad: det sparade värdet ändras inte.
   */
  function begarGrupp(e, n, valtLaddaNed) {
    setFel("");
    if (normaliseraGastepost(e) === null) {
      setFel(t.felEpost);
      return;
    }
    if (n.trim().length > MAX_GASTNAMN) {
      setFel(t.felNamn.replace("{max}", String(MAX_GASTNAMN)));
      return;
    }
    setBekrafta({ slag: "grupp", epost: e.trim(), namn: n.trim(), ...(typeof valtLaddaNed === "boolean" ? { laddaNed: valtLaddaNed } : {}) });
  }

  /** Det dialogens knapp väntar på. Dialogen stängs först när servern svarat (se `GastBekraftelse`), så att ingenting går att trycka två gånger. */
  async function genomforBekraftelse() {
    const b = bekrafta;
    if (!b) return;
    try {
      if (b.slag === "grupp") {
        if (!onBjudGrupp) return;
        // ⛔ (0.202.0, QA 2026-11-07, punkt 1 och 2 i cllp/lifehub.app#687) EN INBJUDAN TILL SAMMA PERSON BYTER NYCKEL, så en länk som visas under en rad slutar fungera. Den visade glöms innan anropet, som vid Skicka igen.
        setLankar({});
        // (0.203.0) Valet följer med bara när det kom från formuläret.
        const valt = typeof b.laddaNed === "boolean" ? { laddaNed: b.laddaNed } : {};
        if (typeof b.telefon === "string") {
          await bjudGruppTelefon(b.telefon, b.namn, valt);
          return;
        }
        try {
          await onBjudGrupp({ epost: /** @type {string} */ (b.epost), namn: b.namn, ...valt });
          if (levande.current) {
            setEpost("");
            setNamn("");
            if ("laddaNed" in valt) setLaddaNed(false);
          }
        } catch (e) {
          if (levande.current) setFel(felText(e));
        }
        return;
      }
      if (onRadera) await pa(b.gastId, onRadera, { gastId: b.gastId, ...(typeof b.telefon === "string" ? { telefon: b.telefon } : { epost: b.epost }) });
    } finally {
      if (levande.current) setBekrafta(null);
    }
  }

  /**
   * (0.197.0) Bjuder in med telefon och hämtar länken direkt, så att den som bjöd kan dela den i samma stund. ⛔ Ger appen inget id tillbaka står det att inbjudan finns och var länken hämtas, aldrig tyst (regel 5).
   * @param {string} tel Det normaliserade numret.
   * @param {string} n
   * @param {{ laddaNed?: boolean }} valt (0.203.0) Formulärets val, tomt från Bjud in igen på en rad.
   */
  async function bjudGruppTelefon(tel, n, valt) {
    const vem = n || tel;
    /** @type {unknown} */
    let svar;
    try {
      svar = await /** @type {NonNullable<typeof onBjudGrupp>} */ (onBjudGrupp)({ telefon: tel, namn: n, ...valt });
    } catch (e) {
      if (levande.current) setFel(felText(e));
      return;
    }
    if (levande.current) {
      setTelefon("");
      setNamn("");
      if ("laddaNed" in valt) setLaddaNed(false);
    }
    const id = svar && typeof svar === "object" ? /** @type {{ id?: unknown }} */ (svar).id : undefined;
    if (typeof id !== "string" || id === "" || !onKopieraLank) {
      if (levande.current) setFel(t.telefonUtanLank);
      return;
    }
    try {
      const lank = await onKopieraLank({ id });
      if (!lank || typeof lank.url !== "string" || lank.url === "") throw new Error("onKopieraLank måste ge { url } med länken.");
      if (levande.current) setNyTelefonlank({ vem, url: lank.url, lankGiltigTill: lank.lankGiltigTill });
    } catch (e) {
      if (levande.current) setFel(`${t.telefonUtanLank} ${felText(e)}`);
    }
  }

  /** @param {{ slag: string, funktion?: string }} omfang @param {string | null | undefined} titel */
  function omfangText(omfang, titel) {
    if (omfang.slag === "grupp") return t.omfang_grupp;
    if (omfang.funktion === "delta") return titel ? t.omfang_delta_titel.replace("{titel}", titel) : t.omfang_delta;
    return titel ? t.omfang_sak_titel.replace("{titel}", titel) : t.omfang_sak;
  }

  /**
   * Gästens svar som ett märke, bara för en delta-rad. `undefined` ritar ingenting (en omröstning och hela gruppen har inget svar); `null` ritar "Har inte svarat" (regel 5: tomt är ett svar).
   * @param {string | null | undefined} deltasvar
   */
  function svarMarke(deltasvar) {
    if (deltasvar === undefined) return null;
    const nyckel = deltasvar === null ? "osvarat" : deltasvar;
    if (!(nyckel in SVARSTON)) return null;
    return (
      <span data-gast-svar={nyckel}>
        <OpsPill tone={SVARSTON[/** @type {keyof typeof SVARSTON} */ (nyckel)]}>{t[`svar_${nyckel}`]}</OpsPill>
      </span>
    );
  }

  return (
    <section data-gastlista="" data-gastlista-lage={gruppLage ? "grupp" : "sak"} {...(utanRubrik ? { "aria-label": t.rubrik } : { "aria-labelledby": rubrikId })} className={cx(utanRubrik ? "mt-2" : "mt-4", "flex min-w-0 flex-col gap-3")}>
      {utanRubrik ? null : (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id={rubrikId} className="m-0 text-sektion uppercase text-ink-muted">{t.rubrik}</h2>
          <p data-gastlista-platser="" className="m-0 text-etikett text-ink-secondary">
            {t.platser.replace("{anvanda}", String(platser.anvanda)).replace("{totalt}", String(platser.totalt))}
          </p>
        </div>
      )}

      {rader.length === 0 ? (
        utanRubrik ? null : <p data-gastlista-tom="" className="m-0 text-etikett text-ink-muted">{gruppLage ? t.ingaGrupp : t.inga}</p>
      ) : gruppLage ? (
        <ul data-gastlista-lista="" className="m-0 flex list-none flex-col gap-2 p-0">
          {/** @type {ReadonlyArray<Person>} */ (rader).map((p) => {
            // (0.197.0) Kontakten är adressen eller numret: en gäst med telefon har ingen adress.
            const kontakt = typeof p.epost === "string" && p.epost !== "" ? p.epost : p.telefon ?? "";
            const personTelefon = !(typeof p.epost === "string" && p.epost !== "") && typeof p.telefon === "string";
            const vem = p.namn ? p.namn : kontakt;
            const status = /** @type {keyof typeof STATUSTON} */ (p.status ?? "vantar");
            const harAktiv = p.inbjudningar.some((i) => i.status !== "aterkallad");
            const oppen = utfallda.has(p.gastId);
            const panelId = `${rubrikId}-gast-${p.gastId}`;
            return (
              <li key={p.gastId} data-gast-person={p.gastId} data-gast-status={status} data-gast-utfalld={oppen ? "ja" : "nej"} className="flex min-w-0 flex-col gap-2 rounded-base border border-line bg-raised p-3">
                {/* ⛔ HOPFÄLLBART KORT (0.204.0, CP 2026-11-08). Sammanfällt bär raden bara namnet, statusmärket och chevronen: en grupp med fem gäster var fem höga kort
                    med adresser, inbjudningar och fem knappar var, och listan gick inte att överblicka. Samma knapp som `OpsBreakdown` och `OpsEventList` (`aria-expanded`,
                    `aria-controls`, `ChevronNedIkon` som vänds), inte `OpsDisclosure`: där är hela raden klickytan, och här ska namnet och märket stå kvar som text och
                    bara chevronen vara en knapp med ett eget namn. */}
                <div className="flex min-w-0 items-center justify-between gap-x-3">
                  <span data-gast-namn="" className="min-w-0 flex-1 text-etikett text-ink wrap-anywhere">{vem}</span>
                  <OpsPill tone={STATUSTON[status]}>{t[`status_${status}`]}</OpsPill>
                  <button
                    type="button"
                    data-gast-vaxla=""
                    onClick={() => vaxlaUtfalld(p.gastId)}
                    aria-expanded={oppen}
                    aria-controls={panelId}
                    className={cx(
                      "-my-2 -mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted",
                      "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    )}
                  >
                    <span className="sr-only">{t.visaDetaljer.replace("{vem}", vem)}</span>
                    <span aria-hidden="true" className={cx("transition-transform duration-(--duration-fast)", oppen && "rotate-180")}>
                      <ChevronNedIkon size={16} />
                    </span>
                  </button>
                </div>
                {/* Panelen finns alltid, så att `aria-controls` pekar på ett element, men den bär inget innehåll förrän kortet fälls ut: en sammanfälld rad ska vara få element. */}
                <div id={panelId} data-gast-detaljer="" hidden={!oppen} className={oppen ? "flex min-w-0 flex-col gap-2" : undefined}>
                  {oppen ? (
                    <>
                      {p.namn ? <span {...(personTelefon ? { "data-gast-telefon": "" } : { "data-gast-epost": "" })} className="min-w-0 text-meta text-ink-muted wrap-anywhere">{kontakt}</span> : null}
                      <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {p.inbjudningar.map((i) => {
                          const istatus = /** @type {keyof typeof STATUSTON} */ (i.status ?? "vantar");
                          const aterkallad = istatus === "aterkallad";
                          return (
                            <li key={i.id} data-gast-inbjudan={i.id} data-gast-omfang={i.omfang.slag} data-gast-status={istatus} className="flex min-w-0 flex-col gap-2 border-t border-line pt-2">
                              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                <span data-gast-omfangstext="" className="min-w-0 text-etikett text-ink-secondary wrap-anywhere">{omfangText(i.omfang, i.titel)}</span>
                                <span className="flex flex-wrap items-center gap-1">
                                  {svarMarke(i.deltasvar)}
                                  <OpsPill tone={STATUSTON[istatus]}>{t[`status_${istatus}`]}</OpsPill>
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {aterkallad ? (
                                  i.omfang.slag === "grupp" && onBjudGrupp ? (
                                    <OpsButton size="sm" variant="secondary" ariaLabel={t.bjudIgenNamn.replace("{vem}", vem)} onClick={() => (personTelefon ? begarGruppTelefon(kontakt, p.namn ?? "") : begarGrupp(kontakt, p.namn ?? ""))}>
                                      {t.bjudIgen}
                                    </OpsButton>
                                  ) : null
                                ) : (
                                  <>
                                    {onSkickaOm && personTelefon ? (
                                      // (0.197.0) En gäst med telefon får inget brev: Ny länk byter nyckel, och den nya länken hämtas och visas direkt för att delas.
                                      <OpsButton size="sm" variant="secondary" ariaLabel={`${t.nyLankNamn.replace("{vem}", vem)} (${omfangText(i.omfang, i.titel)})`} busyLabel={t.nyLankPagar} onClick={() => (glomLank(i.id), nyLankTelefon(p.gastId, i.id, vem))}>
                                        {t.nyLank}
                                      </OpsButton>
                                    ) : onSkickaOm ? (
                                      <OpsButton size="sm" variant="secondary" ariaLabel={`${t.skickaIgenNamn.replace("{vem}", vem)} (${omfangText(i.omfang, i.titel)})`} busyLabel={t.skickaIgenPagar} onClick={() => (glomLank(i.id), pa(p.gastId, onSkickaOm, { id: i.id }, t.skickaIgenKlar.replace("{vem}", vem).replace("{dagar}", String(GASTLANKDAGAR))))}>
                                        {t.skickaIgen}
                                      </OpsButton>
                                    ) : null}
                                    {onKopieraLank ? (
                                      <OpsButton size="sm" variant="secondary" ariaLabel={`${t.kopieraLankNamn.replace("{vem}", vem)} (${omfangText(i.omfang, i.titel)})`} busyLabel={t.kopieraLankPagar} onClick={() => hamtaLank(p.gastId, i.id)}>
                                        {t.kopieraLank}
                                      </OpsButton>
                                    ) : null}
                                    {onAterkalla ? (
                                      <OpsButton size="sm" variant="ghost" ariaLabel={`${t.draTillbakaNamn.replace("{vem}", vem)} (${omfangText(i.omfang, i.titel)})`} busyLabel={t.draTillbakaPagar} onClick={() => pa(p.gastId, onAterkalla, { id: i.id })}>
                                        {t.draTillbaka}
                                      </OpsButton>
                                    ) : null}
                                  </>
                                )}
                              </div>
                              {onNedladdning && i.omfang.slag === "grupp" ? (
                                // (0.203.0) Gästens egen nedladdning. (0.204.0) Allt som inte är `true` är av, samma som servern (`nedladdningTillaten`): raden "Följer gruppens inställning" är borta,
                                // eftersom gruppen inte längre är en del av regeln.
                                <div data-gast-laddaned={i.laddaNed === true ? "pa" : "av"}>
                                  <OpsSwitch label={t.laddaNed} checked={i.laddaNed === true} disabled={aterkallad} onChange={(v) => pa(p.gastId, onNedladdning, { id: i.id, pa: v })} />
                                </div>
                              ) : null}
                              {lankar[i.id] && !aterkallad ? <GastLank lank={lankar[i.id]} vem={vem} t={t} sprak={sprak} gruppnamn={gruppnamn} telefon={personTelefon} /> : null}
                            </li>
                          );
                        })}
                      </ul>
                      {(onAterkallaAlla && harAktiv) || onRadera ? (
                        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
                          {onAterkallaAlla && harAktiv ? (
                            <OpsButton size="sm" variant="ghost" ariaLabel={t.draTillbakaAllaNamn.replace("{vem}", vem)} busyLabel={t.draTillbakaPagar} onClick={() => pa(p.gastId, onAterkallaAlla, { gastId: p.gastId })}>
                              {t.draTillbakaAlla}
                            </OpsButton>
                          ) : null}
                          {onRadera ? (
                            <OpsButton size="sm" variant="ghost" ariaLabel={t.raderaNamn.replace("{vem}", vem)} onClick={() => setBekrafta({ slag: "radera", gastId: p.gastId, ...(personTelefon ? { telefon: kontakt } : { epost: kontakt }), namn: p.namn ?? "" })}>
                              {t.radera}
                            </OpsButton>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
                {/* Beskeden står utanför panelen: ett fel eller ett klart får aldrig döljas av att kortet fälls ihop. */}
                {radklar[p.gastId] ? <p role="status" data-gast-klar="" className="m-0 text-etikett text-ink-secondary wrap-anywhere">{radklar[p.gastId]}</p> : null}
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
                    <span data-gast-namn="" className="min-w-0 text-etikett text-ink wrap-anywhere">{vem}</span>
                    {g.namn ? <span data-gast-epost="" className="min-w-0 text-meta text-ink-muted wrap-anywhere">{g.epost}</span> : null}
                  </div>
                  <span className="flex flex-wrap items-center gap-1">
                    {svarMarke(g.deltasvar)}
                    <OpsPill tone={STATUSTON[status]}>{t[`status_${status}`]}</OpsPill>
                  </span>
                </div>
                {onBjud || onSkickaOm || onKopieraLank || onAterkalla || onRadera ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {aterkallad ? (
                      onBjud ? (
                        <OpsButton size="sm" variant="secondary" ariaLabel={t.bjudIgenNamn.replace("{vem}", vem)} onClick={() => (glomLank(g.id), pa(g.id, onBjud, { epost: g.epost, namn: g.namn ?? "" }))}>
                          {t.bjudIgen}
                        </OpsButton>
                      ) : null
                    ) : (
                      <>
                        {onSkickaOm ? (
                          <OpsButton size="sm" variant="secondary" ariaLabel={t.skickaIgenNamn.replace("{vem}", vem)} busyLabel={t.skickaIgenPagar} onClick={() => (glomLank(g.id), pa(g.id, onSkickaOm, { id: g.id }, t.skickaIgenKlar.replace("{vem}", vem).replace("{dagar}", String(GASTLANKDAGAR))))}>
                            {t.skickaIgen}
                          </OpsButton>
                        ) : null}
                        {onKopieraLank ? (
                          <OpsButton size="sm" variant="secondary" ariaLabel={t.kopieraLankNamn.replace("{vem}", vem)} busyLabel={t.kopieraLankPagar} onClick={() => hamtaLank(g.id, g.id)}>
                            {t.kopieraLank}
                          </OpsButton>
                        ) : null}
                        {onAterkalla ? (
                          <OpsButton size="sm" variant="ghost" ariaLabel={t.draTillbakaNamn.replace("{vem}", vem)} busyLabel={t.draTillbakaPagar} onClick={() => pa(g.id, onAterkalla, { id: g.id })}>
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
                {lankar[g.id] && !aterkallad ? <GastLank lank={lankar[g.id]} vem={vem} t={t} sprak={sprak} gruppnamn={gruppnamn} /> : null}
                {radklar[g.id] ? <p role="status" data-gast-klar="" className="m-0 text-etikett text-ink-secondary wrap-anywhere">{radklar[g.id]}</p> : null}
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
          <p className="m-0 text-etikett text-ink-secondary">{telefonValt ? t.ingressGruppTelefon : gruppLage ? t.ingressGrupp : t.ingress}</p>
          {fulla ? <p data-gastlista-fulla="" role="status" className="m-0 text-etikett text-ink">{t.platserFulla.replace("{totalt}", String(platser.totalt))}</p> : null}
          {gruppLage && medTelefon ? (
            <div data-gastlista-kontaktval="">
              <OpsSegmented
                ariaLabel={t.kontaktVal}
                value={kontaktslag}
                onChange={(v) => {
                  setFel("");
                  setKontaktslag(v === "telefon" ? "telefon" : "epost");
                }}
                options={[
                  { value: "epost", label: t.kontaktEpost },
                  { value: "telefon", label: t.kontaktTelefon },
                ]}
              />
            </div>
          ) : null}
          {telefonValt ? (
            <OpsField label={t.telefonEtikett} hint={t.telefonHjalp}>
              <OpsInput value={telefon} onChange={setTelefon} type="tel" autoComplete="off" disabled={fulla} tal={false} />
            </OpsField>
          ) : (
            <OpsField label={t.epostEtikett}>
              <OpsInput value={epost} onChange={setEpost} type="email" autoComplete="off" disabled={fulla} tal={false} />
            </OpsField>
          )}
          <OpsField label={t.namnEtikett}>
            <OpsInput value={namn} onChange={setNamn} autoComplete="off" maxLength={MAX_GASTNAMN} disabled={fulla} tal={false} />
          </OpsField>
          {gruppLage ? (
            <div data-gastlista-laddaned="">
              <OpsCheckbox label={t.laddaNed} checked={laddaNed} onChange={setLaddaNed} disabled={fulla} />
            </div>
          ) : null}
          {fel ? <p role="alert" data-gastlista-bjudfel="" className="m-0 text-etikett text-danger wrap-anywhere">{fel}</p> : null}
          <div>
            {telefonValt ? (
              <OpsButton variant="primary" disabled={fulla || telefon.trim() === ""} onClick={() => begarGruppTelefon(telefon, namn, laddaNed)}>
                {t.bjudGrupp}
              </OpsButton>
            ) : gruppLage ? (
              <OpsButton variant="primary" disabled={fulla || epost.trim() === ""} onClick={() => begarGrupp(epost, namn, laddaNed)}>
                {t.bjudGrupp}
              </OpsButton>
            ) : (
              <OpsButton variant="primary" disabled={fulla || epost.trim() === ""} onClick={bjud}>
                {t.bjud}
              </OpsButton>
            )}
          </div>
          {nyTelefonlank ? (
            <div data-gastlista-telefonlank="" className="flex min-w-0 flex-col gap-2">
              <p role="status" className="m-0 text-etikett text-ink wrap-anywhere">{t.telefonLank.replace("{vem}", nyTelefonlank.vem)}</p>
              <GastLank lank={nyTelefonlank} vem={nyTelefonlank.vem} t={t} sprak={sprak} gruppnamn={gruppnamn} telefon />
            </div>
          ) : null}
        </form>
      ) : null}

      {bekrafta ? <GastBekraftelse bekrafta={bekrafta} t={t} onBekrafta={genomforBekraftelse} onAvbryt={() => setBekrafta(null)} /> : null}
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
