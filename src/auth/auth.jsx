import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { OpsButton } from "../components/OpsButton.jsx";
import { OpsCard } from "../components/OpsCard.jsx";
import { OpsEmpty } from "../components/OpsEmpty.jsx";
import { OpsView, OpsViewHeader } from "../components/OpsView.jsx";

/**
 * Inloggning och roller.
 *
 * ⛔ RAMVERKET IMPORTERAR INGEN AUTH-SDK. Appen skickar in den, precis som för
 * datalagret. Ramverket äger formen, appen äger kopplingen.
 *
 * ⛔ OCH DET VIKTIGASTE: DET HÄR ÄR INTE SÄKERHET.
 *
 * `OpsAuthGate` bestämmer vad som RENDERAS. Den bestämmer ingenting om vad som
 * går att läsa eller skriva. Vem som helst kan öppna utvecklarverktygen och be
 * databasen om vad som helst, och då spelar det ingen roll vad React visade.
 *
 * Skyddet måste ligga där datan bor: i Firestore-reglerna, eller i det API som
 * står framför Postgres. Grinden här är bekvämlighet och tydlighet, inget annat.
 * Att tro något annat är exakt så läckor uppstår.
 */

/**
 * @typedef {object} Anvandare
 * @property {string} id
 * @property {string} [epost]
 * @property {string} [namn]
 * @property {string} [bildUrl]
 * @property {string} [roll] Kommer ur appens egen användarlista, inte ur Google.
 */

/**
 * @typedef {object} Autentisering
 * @property {() => Promise<void>} loggaIn
 * @property {() => Promise<void>} loggaUt
 * @property {(lyssnare: (a: Anvandare | null) => void) => () => void} lyssna Returnerar en avregistrering.
 */

const AuthContext = createContext(
  /** @type {{ anvandare: Anvandare | null, laddar: boolean, fel: Error | null, loggaIn: () => void, loggaUt: () => void } | null} */ (null),
);

/**
 * Kontrollerar att en adapter är hel innan den används.
 * @param {Partial<Autentisering> & { namn?: string }} adapter @returns {Autentisering}
 */
export function skapaAutentisering(adapter) {
  const saknas = ["loggaIn", "loggaUt", "lyssna"].filter((op) => typeof (/** @type {any} */ (adapter ?? {})[op]) !== "function");
  if (saknas.length > 0) {
    throw new Error(`skapaAutentisering: adaptern saknar ${saknas.join(", ")}.`);
  }
  return /** @type {Autentisering} */ (adapter);
}

/**
 * Google-inloggning via Firebase Auth.
 *
 * ```js
 * import * as auth from "firebase/auth";
 * const autentisering = skapaGoogleAuth({
 *   auth: auth.getAuth(app),
 *   sdk: auth,
 *   hamtaProfil: async (a) => kalla.las("users", a.id),
 * });
 * ```
 *
 * `hamtaProfil` är valfri och är det som ger `roll`. Den läser appens egen
 * användarlista, alltså ett dokument per användare, via datalagret. Rollen
 * kommer aldrig från Google: Google svarar på vem någon ÄR, inte på vad hen får.
 *
 * @param {{ auth: any, sdk: Record<string, any>, hamtaProfil?: (a: Anvandare) => Promise<any> }} konfig
 * @returns {Autentisering}
 */
export function skapaGoogleAuth(konfig) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN OCH INTE I PARAMETERLISTAN (#129 punkt 5).
   *
   * Med `({ x })` i signaturen kraschar ett anrop UTAN argument på destrukturen,
   * med "Cannot destructure property 'x' of 'undefined'". Det felet nämner en
   * variabel inne i ramverket och inte vad appen glömde, och det pekar mot en fil
   * anroparen aldrig öppnat.
   *
   * ⛔ `= {}` I SIGNATUREN VAR FEL SVAR: typkontrollen avvisade det, och med rätta.
   * Typen säger att fälten krävs, och det ska den fortsätta göra, annars tappar en
   * typad anropare sitt kompileringsfel. Nu får båda vad de behöver: typen är
   * strikt, och kroppen tål ingenting så att valideringen nedan hinner tala.
   */
  const { auth, sdk, hamtaProfil } = konfig ?? /** @type {any} */ ({});
  if (!auth) throw new Error("skapaGoogleAuth: auth krävs. Skicka in getAuth(app).");
  const saknas = ["GoogleAuthProvider", "signInWithPopup", "signOut", "onAuthStateChanged"].filter((f) => !sdk?.[f]);
  if (saknas.length > 0) {
    throw new Error(`skapaGoogleAuth: sdk saknar ${saknas.join(", ")}. Skicka in hela modulen "firebase/auth".`);
  }

  return skapaAutentisering({
    namn: "google",
    async loggaIn() {
      await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider());
    },
    async loggaUt() {
      await sdk.signOut(auth);
    },
    lyssna(lyssnare) {
      return sdk.onAuthStateChanged(auth, async (/** @type {any} */ konto) => {
        if (!konto) {
          lyssnare(null);
          return;
        }
        /** @type {Anvandare} */
        const bas = { id: konto.uid, epost: konto.email ?? undefined, namn: konto.displayName ?? undefined, bildUrl: konto.photoURL ?? undefined };
        if (!hamtaProfil) {
          lyssnare(bas);
          return;
        }
        try {
          const profil = await hamtaProfil(bas);
          lyssnare({ ...bas, ...(profil ?? {}) });
        } catch {
          // ⛔ Misslyckas profilhämtningen loggas användaren in UTAN roll, inte
          // in med en gissad roll. Ett fel i en uppslagning får aldrig ge mer
          // behörighet än den som lyckades.
          lyssnare(bas);
        }
      });
    },
  });
}

/**
 * @param {{ autentisering: Autentisering, children: import("react").ReactNode }} props
 */
export function OpsAuthProvider({ autentisering, children }) {
  const [anvandare, setAnvandare] = useState(/** @type {Anvandare | null} */ (null));
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState(/** @type {Error | null} */ (null));

  useEffect(() => {
    const av = autentisering.lyssna((a) => {
      setAnvandare(a);
      setLaddar(false);
    });
    return av;
  }, [autentisering]);

  const loggaIn = useCallback(() => {
    setFel(null);
    autentisering.loggaIn().catch((e) => setFel(e instanceof Error ? e : new Error(String(e))));
  }, [autentisering]);

  const loggaUt = useCallback(() => {
    autentisering.loggaUt().catch((e) => setFel(e instanceof Error ? e : new Error(String(e))));
  }, [autentisering]);

  const varde = useMemo(() => ({ anvandare, laddar, fel, loggaIn, loggaUt }), [anvandare, laddar, fel, loggaIn, loggaUt]);
  return <AuthContext.Provider value={varde}>{children}</AuthContext.Provider>;
}

export function useOpsAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useOpsAuth: ingen OpsAuthProvider hittades. Lägg den högst upp i appen.");
  return ctx;
}

/**
 * Visar sitt innehåll för den som är inloggad och godkänd.
 *
 * ⛔ Igen: det här styr RENDERING, inte åtkomst. `tillatnaRoller` här måste ha
 * en motsvarighet i Firestore-reglerna eller i API:et, annars är listan en
 * skylt och inte ett lås.
 *
 * @param {object} props
 * @param {string[]} [props.tillatnaRoller] Tom eller utelämnad betyder "vem som helst som är inloggad".
 * @param {string} [props.titel]
 * @param {string} [props.beskrivning]
 * @param {string} [props.loggaInText]
 * @param {string} [props.nekadTitel]
 * @param {string} [props.nekadText]
 * @param {import("react").ReactNode} props.children
 */
export function OpsAuthGate({
  tillatnaRoller,
  titel = "Logga in",
  beskrivning = "Den här plattformen kräver inloggning.",
  loggaInText = "Logga in med Google",
  nekadTitel = "Du har inte tillgång",
  nekadText = "Ditt konto är inloggat men saknar behörighet här. Be den som förvaltar plattformen lägga till dig.",
  children,
}) {
  const { anvandare, laddar, fel, loggaIn } = useOpsAuth();

  if (laddar) {
    return (
      <OpsView width="narrow">
        <OpsEmpty busy title={titel} busyLabel="Kontrollerar inloggning" />
      </OpsView>
    );
  }

  if (!anvandare) {
    return (
      <OpsView width="narrow">
        <OpsViewHeader title={titel} description={beskrivning} />
        <OpsCard>
          <OpsButton variant="primary" onClick={loggaIn}>
            {loggaInText}
          </OpsButton>
          {/* Felet visas, det sväljs inte. En inloggning som inte händer och
              inte förklarar sig får användaren att trycka igen i evighet. */}
          {fel ? <p className="mt-3 text-base text-danger">{fel.message}</p> : null}
        </OpsCard>
      </OpsView>
    );
  }

  const nekad = Array.isArray(tillatnaRoller) && tillatnaRoller.length > 0 && !tillatnaRoller.includes(anvandare.roll ?? "");
  if (nekad) {
    return (
      <OpsView width="narrow">
        <OpsViewHeader title={nekadTitel} description={nekadText} />
      </OpsView>
    );
  }

  return <>{children}</>;
}
