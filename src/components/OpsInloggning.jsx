import { useState } from "react";
import { cx } from "../lib/cx.js";
import { OpsBrand } from "./OpsBrand.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsCard } from "./OpsCard.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsBanner } from "./OpsBanner.jsx";

/**
 * Inloggningsvyn, utloggat läge. Ritas av `OpsAuthGate` (`src/auth/auth.jsx`).
 *
 * ══ ⛔ #164, KORRIGERING B, EXAKT FORM UR CP:S SKÄRMBILD 2026-09-28 ═══════
 *
 * Helskärm, centrerad kolumn `max-w-[360px]`, bakgrund `bg-canvas` med en
 * dämpad gradient nedtill. Märket som TEXT (0.31.0, `OpsBrand storlek="stor"`,
 * rad 1 32 px, inga bilder), under det appens namn som rad 2 ("Made in Sweden"
 * i SessionStudio, appens EGET ord här), sedan en viskning i dämpad text. Under det ett kort med `--radius-card`, `p-5`,
 * `backdrop-blur`, synlig kant och skugga: rubrik ("Logga in") och en
 * Swe/Eng-växlare som en pill med `aria-pressed`, leverantörsrader i FULL
 * kortbredd med fast ikonkolumn, en avdelare ("ELLER"), en hopfällbar
 * e-postväg, fel i en banderoll INUTI kortet, en sidfot med länkar och
 * appens version.
 *
 * ⛔ VARJE RAD ÄR EN FÖRMÅGA, INTE EN GISSNING. `auth` (från `createAuth`/
 * `createGoogleAuth`, `src/auth/auth.jsx`) bär BARA de funktioner appens
 * adapter faktiskt gav. Saknar adaptern `signInWithApple` ritas ingen
 * Apple-rad; en app med bara Google ser EN rad. Se `piller-formaga.test.jsx`.
 *
 * ⛔ TVÅSPRÅKIG VIA `sprak`/`onSprak`, INTE VIA EN INTERN i18n-MOTOR. Ramverket
 * har `src/lib/sprak.js` för NAMN (`{ sv, en }`), men den här vyns EGEN copy
 * (knapptexter, felmeningar) är en lokal `{ sv, en }`-tabell: `OpsInloggning`
 * är den ENDA platsen i ramverket med löpande inloggningstext, och en delad
 * global tabell för elva strängar hade varit en indirektion utan vinst.
 */

/** @type {Record<"sv"|"en", Record<string, string>>} */
const COPY = {
  sv: {
    logInHeading: "Logga in",
    createAccountHeading: "Skapa konto",
    continueWithGoogle: "Fortsätt med Google",
    continueWithApple: "Fortsätt med Apple",
    or: "ELLER",
    continueWithEmailPassword: "Fortsätt med e-post och lösenord",
    createAccount: "Skapa konto",
    signInWithEmailLink: "Logga in med e-postlänk",
    back: "Tillbaka",
    email: "E-post",
    password: "Lösenord",
    confirmPassword: "Bekräfta lösenord",
    name: "Namn",
    signIn: "Logga in",
    forgotPassword: "Glömt lösenordet?",
    sendResetLink: "Skicka återställningslänk",
    resetSent: "Länk för att återställa lösenordet skickad. Kolla din e-post.",
    sendEmailLink: "Skicka inloggningslänk",
    emailLinkSent: "Öppna länken i mejlet för att logga in.",
    completeEmailLinkPrompt: "Öppnade du länken på den här enheten? Bekräfta din e-post:",
    completeEmailLink: "Bekräfta",
    passwordMismatch: "Lösenorden matchar inte.",
  },
  en: {
    logInHeading: "Log in",
    createAccountHeading: "Create account",
    continueWithGoogle: "Continue with Google",
    continueWithApple: "Continue with Apple",
    or: "OR",
    continueWithEmailPassword: "Continue with email and password",
    createAccount: "Create account",
    signInWithEmailLink: "Log in with email link",
    back: "Back",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    name: "Name",
    signIn: "Log in",
    forgotPassword: "Forgot password?",
    sendResetLink: "Send reset link",
    resetSent: "Password reset link sent. Check your email.",
    sendEmailLink: "Send login link",
    emailLinkSent: "Open the link in your inbox to log in.",
    completeEmailLinkPrompt: "Opened the link on this device? Confirm your email:",
    completeEmailLink: "Confirm",
    passwordMismatch: "Passwords don't match.",
  },
};

/**
 * @param {"sv"|"en"} sprak
 * @param {string} epost
 */
function emailLinkSentTo(sprak, epost) {
  return sprak === "en" ? `Link sent to ${epost}.` : `Länk skickad till ${epost}.`;
}

/**
 * Pillerformad rad, full bredd, ikon i fast kolumn vänster. Se filhuvudet: SAMMA form för varje leverantör.
 * @param {object} props
 * @param {import("react").ReactNode} props.ikon
 * @param {import("react").ReactNode} props.children
 * @param {() => void} props.onClick
 * @param {boolean} [props.busy]
 */
function ProviderPill({ ikon, children, onClick, busy }) {
  return (
    <OpsButton variant="secondary" size="sm" fullWidth onClick={onClick} busy={busy}>
      <span className="flex w-full items-center gap-3">
        <span className="flex w-6 shrink-0 items-center justify-center" aria-hidden="true">
          {ikon}
        </span>
        <span className="min-w-0 flex-1 text-left">{children}</span>
      </span>
    </OpsButton>
  );
}

function GoogleIkon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleIkon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

/**
 * @param {object} props
 * @param {import("../auth/auth.jsx").Authentication} props.auth
 * @param {string} [props.rubrik] Inte undertexten under bilden, den heter `etikett` (se nedan). `rubrik` var
 *   tidigare med som en av tre fallbacks för undertexten (`etikett || rubrik || "OPS Hub"`), vilket var fel: en app
 *   som bara satte `title` på `OpsAuthGate` (skärmläsarrubriken, samma värde som `rubrik` här) fick DEN texten under
 *   loggan i stället för sitt eget namn. #164-rättningen gör undertexten enbart en fråga om `etikett`, aldrig
 *   `rubrik`. Propen tas fortfarande emot (så `OpsAuthGate` kan skicka den oförändrad), men läses inte här.
 * @param {import("./OpsBrand.jsx").MarkeNamn} [props.namn] Märkets rad 1 (0.31.0), samma form som `OpsBrand namn`. Förval "OPS HUB".
 * @param {string} [props.etikett] Appens namn. Ritas som märkets rad 2 (versal, spärrad), under rad 1. Saknas den ritas bara rad 1, ALDRIG `rubrik`.
 * @param {string} [props.viskning] Under etiketten, en rad ren text.
 * @param {{ label: string, href: string }[]} [props.lankar] Sidfoten. Tom lista: ingen sidfot alls.
 * @param {string} [props.appVersion] Appens version, sista på sidfotsraden (t.ex. "v1.4.2").
 * @param {"sv"|"en"} [props.sprak]
 * @param {(sprak: "sv"|"en") => void} [props.onSprak]
 * @param {string} [props.fel]
 * @param {() => void} [props.onRensaFel]
 */
export function OpsInloggning({ auth, namn: markeNamn, etikett, viskning, lankar = [], appVersion, sprak = "sv", onSprak, fel, onRensaFel }) {
  if (!auth) throw new Error("OpsInloggning: auth krävs. Utan den vet vyn inte vilka förmågor som finns.");
  const t = COPY[sprak] ?? COPY.sv;

  /** @type {["leverantorer"|"losenord"|"epostlank", any]} */
  const [lage, setLage] = useState(/** @type {"leverantorer"|"losenord"|"epostlank"} */ ("leverantorer"));
  const [skapaKonto, setSkapaKonto] = useState(false);
  const [epost, setEpost] = useState("");
  const [losenord, setLosenord] = useState("");
  const [bekraftaLosenord, setBekraftaLosenord] = useState("");
  const [namn, setNamn] = useState("");
  const [visaGlomt, setVisaGlomt] = useState(false);
  const [aterstallningSkickad, setAterstallningSkickad] = useState(false);
  const [epostlankSkickadTill, setEpostlankSkickadTill] = useState("");
  const [bekraftaEpost, setBekraftaEpost] = useState("");
  const [busyNamn, setBusyNamn] = useState(/** @type {string | null} */ (null));
  const [lokaltFel, setLokaltFel] = useState(/** @type {string | null} */ (null));

  const visatFel = fel ?? lokaltFel;

  /** @param {string} namnPaHandling @param {() => Promise<void>} handling */
  async function kor(namnPaHandling, handling) {
    setBusyNamn(namnPaHandling);
    setLokaltFel(null);
    onRensaFel?.();
    try {
      await handling();
    } catch (e) {
      setLokaltFel(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyNamn(null);
    }
  }

  const tillbaka = () => {
    setLage("leverantorer");
    setVisaGlomt(false);
    setAterstallningSkickad(false);
    setLokaltFel(null);
    onRensaFel?.();
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-canvas px-4 py-6">
      {/* ⛔ Mjuk gradient NEDTILL, aria-hidden: rent dekorativt djup bakom kortet, samma idé som SessionStudios inloggning. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-accent-faint to-transparent"
      />

      <div className="relative z-10 flex w-full max-w-[360px] flex-col items-stretch gap-2">
        <div className="mb-3 flex flex-col items-center text-center">
          <OpsBrand storlek="stor" namn={markeNamn} undertext={etikett} />
          {viskning ? <p className="mt-2 px-1 text-sm leading-snug text-ink-soft">{viskning}</p> : null}
        </div>

        <OpsCard rounding="bubbla" elevated>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="m-0 text-base font-semibold text-ink">{skapaKonto ? t.createAccountHeading : t.logInHeading}</h2>
            {onSprak ? (
              <div role="group" aria-label={sprak === "sv" ? "Språk" : "Language"} className="flex shrink-0 rounded-full border border-line-strong bg-sunken p-0.5">
                <button
                  type="button"
                  onClick={() => onSprak("sv")}
                  aria-pressed={sprak === "sv"}
                  className={cx(
                    "rounded-full px-2 py-0.5 text-liten transition-colors",
                    sprak === "sv" ? "bg-accent text-accent-contrast" : "text-ink-muted hover:text-ink",
                  )}
                >
                  Swe
                </button>
                <button
                  type="button"
                  onClick={() => onSprak("en")}
                  aria-pressed={sprak === "en"}
                  className={cx(
                    "rounded-full px-2 py-0.5 text-liten transition-colors",
                    sprak === "en" ? "bg-accent text-accent-contrast" : "text-ink-muted hover:text-ink",
                  )}
                >
                  Eng
                </button>
              </div>
            ) : null}
          </div>

          {visatFel ? (
            <div className="mb-3">
              <OpsBanner tone="danger" title={visatFel} onDismiss={onRensaFel ?? (() => setLokaltFel(null))} />
            </div>
          ) : null}

          {lage === "leverantorer" ? (
            <>
              {/* ⛔ EN RAD PER FÖRMÅGA, INGEN GISSNING. Se filhuvudet. */}
              <div className="flex flex-col gap-2">
                {auth.signInWithGoogle ? (
                  <ProviderPill ikon={<GoogleIkon />} busy={busyNamn === "google"} onClick={() => kor("google", () => /** @type {any} */ (auth.signInWithGoogle)())}>
                    {t.continueWithGoogle}
                  </ProviderPill>
                ) : null}
                {auth.signInWithApple ? (
                  <ProviderPill ikon={<AppleIkon />} busy={busyNamn === "apple"} onClick={() => kor("apple", () => /** @type {any} */ (auth.signInWithApple)())}>
                    {t.continueWithApple}
                  </ProviderPill>
                ) : null}
              </div>

              {(auth.signInWithGoogle || auth.signInWithApple) && (auth.signInWithPassword || auth.createAccount || auth.sendEmailLink) ? (
                <p className="my-3 text-center text-liten uppercase tracking-widest text-ink-muted" aria-hidden="true">
                  {t.or}
                </p>
              ) : null}

              {auth.signInWithPassword || auth.createAccount ? (
                <OpsButton
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setSkapaKonto(false);
                    setLage("losenord");
                  }}
                >
                  {t.continueWithEmailPassword}
                </OpsButton>
              ) : null}
              {auth.createAccount ? (
                <div className="mt-2">
                  <OpsButton
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      setSkapaKonto(true);
                      setLage("losenord");
                    }}
                  >
                    {t.createAccount}
                  </OpsButton>
                </div>
              ) : null}
              {auth.sendEmailLink ? (
                <button
                  type="button"
                  onClick={() => setLage("epostlank")}
                  className="mt-2 w-full py-1 text-center text-xs font-medium text-ink-muted transition-colors hover:text-accent"
                >
                  {t.signInWithEmailLink}
                </button>
              ) : null}
            </>
          ) : lage === "losenord" ? (
            <>
              <button type="button" onClick={tillbaka} className="mb-3 flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-accent">
                ← {t.back}
              </button>
              {visaGlomt ? (
                aterstallningSkickad ? (
                  <div className="rounded-md border border-line bg-sunken p-3 text-xs text-ink-secondary">{t.resetSent}</div>
                ) : (
                  <form
                    className="flex flex-col gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      kor("aterstall", async () => {
                        await /** @type {any} */ (auth.resetPassword)(epost);
                        setAterstallningSkickad(true);
                      });
                    }}
                  >
                    <OpsField label={t.email}>
                      <OpsInput type="email" value={epost} onChange={setEpost} autoComplete="email" />
                    </OpsField>
                    <OpsButton variant="primary" size="sm" fullWidth type="submit" busy={busyNamn === "aterstall"}>
                      {t.sendResetLink}
                    </OpsButton>
                  </form>
                )
              ) : (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (skapaKonto && losenord !== bekraftaLosenord) {
                      setLokaltFel(t.passwordMismatch);
                      return;
                    }
                    kor("losenord", async () => {
                      if (skapaKonto) await /** @type {any} */ (auth.createAccount)(epost, losenord, namn || undefined);
                      else await /** @type {any} */ (auth.signInWithPassword)(epost, losenord);
                    });
                  }}
                >
                  {skapaKonto ? (
                    <OpsField label={t.name}>
                      <OpsInput value={namn} onChange={setNamn} autoComplete="name" />
                    </OpsField>
                  ) : null}
                  <OpsField label={t.email}>
                    <OpsInput type="email" value={epost} onChange={setEpost} autoComplete="email" />
                  </OpsField>
                  <OpsField label={t.password}>
                    <OpsInput type="password" value={losenord} onChange={setLosenord} autoComplete={skapaKonto ? "new-password" : "current-password"} />
                  </OpsField>
                  {skapaKonto ? (
                    <OpsField label={t.confirmPassword}>
                      <OpsInput type="password" value={bekraftaLosenord} onChange={setBekraftaLosenord} autoComplete="new-password" />
                    </OpsField>
                  ) : null}
                  <OpsButton variant="primary" size="sm" fullWidth type="submit" busy={busyNamn === "losenord"}>
                    {skapaKonto ? t.createAccount : t.signIn}
                  </OpsButton>
                  {!skapaKonto && auth.resetPassword ? (
                    <button type="button" onClick={() => setVisaGlomt(true)} className="text-center text-xs font-medium text-ink-muted hover:text-accent">
                      {t.forgotPassword}
                    </button>
                  ) : null}
                </form>
              )}
            </>
          ) : (
            <>
              <button type="button" onClick={tillbaka} className="mb-3 flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-accent">
                ← {t.back}
              </button>
              {epostlankSkickadTill ? (
                <div className="flex flex-col gap-3">
                  <div className="rounded-md border border-line bg-sunken p-3 text-xs text-ink-secondary">
                    <p className="font-medium break-all">{emailLinkSentTo(sprak, epostlankSkickadTill)}</p>
                    <p className="mt-2">{t.emailLinkSent}</p>
                  </div>
                  {auth.completeEmailLink ? (
                    <form
                      className="flex flex-col gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        kor("bekrafta", () => /** @type {any} */ (auth.completeEmailLink)(bekraftaEpost));
                      }}
                    >
                      <OpsField label={t.completeEmailLinkPrompt}>
                        <OpsInput type="email" value={bekraftaEpost} onChange={setBekraftaEpost} autoComplete="email" />
                      </OpsField>
                      <OpsButton variant="secondary" size="sm" fullWidth type="submit" busy={busyNamn === "bekrafta"}>
                        {t.completeEmailLink}
                      </OpsButton>
                    </form>
                  ) : null}
                </div>
              ) : (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    kor("epostlank", async () => {
                      await /** @type {any} */ (auth.sendEmailLink)(epost);
                      setEpostlankSkickadTill(epost);
                    });
                  }}
                >
                  <OpsField label={t.email}>
                    <OpsInput type="email" value={epost} onChange={setEpost} autoComplete="email" />
                  </OpsField>
                  <OpsButton variant="primary" size="sm" fullWidth type="submit" busy={busyNamn === "epostlank"}>
                    {t.sendEmailLink}
                  </OpsButton>
                </form>
              )}
            </>
          )}
        </OpsCard>

        {lankar.length > 0 || appVersion ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-liten text-ink-muted">
            {lankar.map((l, i) => (
              // eslint-disable-next-line react/no-array-index-key -- ⛔ sidfotslänkar har ingen egen identitet, appen skickar en ny lista varje render.
              <span key={i} className="flex items-center gap-2">
                {i > 0 ? <span aria-hidden="true">·</span> : null}
                <a href={l.href} className="hover:text-ink">
                  {l.label}
                </a>
              </span>
            ))}
            {appVersion ? (
              <span className="flex items-center gap-2">
                {lankar.length > 0 ? <span aria-hidden="true">·</span> : null}
                <span>{appVersion}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
