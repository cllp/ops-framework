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
 * @property {string} [email]
 * @property {string} [namn]
 * @property {string} [imageUrl]
 * @property {string} [role] Kommer ur appens egen användarlista, inte ur Google.
 */

/**
 * @typedef {object} Autentisering
 * @property {() => Promise<void>} loggaIn
 * @property {() => Promise<void>} loggaUt
 * @property {(listener: (a: Anvandare | null) => void) => () => void} lyssna Returnerar en avregistrering.
 */

const AuthContext = createContext(
  /** @type {{ user: Anvandare | null, loading: boolean, error: Error | null, loggaIn: () => void, loggaUt: () => void } | null} */ (null),
);

/**
 * Kontrollerar att en adapter är hel innan den används.
 * @param {Partial<Autentisering> & { namn?: string }} adapter @returns {Autentisering}
 */
export function createAuth(adapter) {
  const missing = ["loggaIn", "loggaUt", "lyssna"].filter((op) => typeof (/** @type {any} */ (adapter ?? {})[op]) !== "function");
  if (missing.length > 0) {
    throw new Error(`createAuth: adaptern saknar ${missing.join(", ")}.`);
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
 * `hamtaProfil` är valfri och är det som ger `role`. Den läser appens egen
 * användarlista, alltså ett dokument per användare, via datalagret. Rollen
 * kommer aldrig från Google: Google svarar på vem någon ÄR, inte på vad hen får.
 *
 * @param {{ auth: any, sdk: Record<string, any>, hamtaProfil?: (a: Anvandare) => Promise<any> }} config
 * @returns {Autentisering}
 */
export function createGoogleAuth(config) {
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
  const { auth, sdk, hamtaProfil } = config ?? /** @type {any} */ ({});
  if (!auth) throw new Error("createGoogleAuth: auth krävs. Skicka in getAuth(app).");
  const missing = ["GoogleAuthProvider", "signInWithPopup", "signOut", "onAuthStateChanged"].filter((f) => !sdk?.[f]);
  if (missing.length > 0) {
    throw new Error(`createGoogleAuth: sdk saknar ${missing.join(", ")}. Skicka in hela modulen "firebase/auth".`);
  }

  return createAuth({
    namn: "google",
    async loggaIn() {
      await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider());
    },
    async loggaUt() {
      await sdk.signOut(auth);
    },
    lyssna(listener) {
      return sdk.onAuthStateChanged(auth, async (/** @type {any} */ konto) => {
        if (!konto) {
          listener(null);
          return;
        }
        /** @type {Anvandare} */
        const base = { id: konto.uid, email: konto.email ?? undefined, namn: konto.displayName ?? undefined, imageUrl: konto.photoURL ?? undefined };
        if (!hamtaProfil) {
          listener(base);
          return;
        }
        try {
          const profil = await hamtaProfil(base);
          listener({ ...base, ...(profil ?? {}) });
        } catch {
          // ⛔ Misslyckas profilhämtningen loggas användaren in UTAN roll, inte
          // in med en gissad roll. Ett fel i en uppslagning får aldrig ge mer
          // behörighet än den som lyckades.
          listener(base);
        }
      });
    },
  });
}

/**
 * @param {{ autentisering: Autentisering, children: import("react").ReactNode }} props
 */
export function OpsAuthProvider({ autentisering, children }) {
  const [user, setUser] = useState(/** @type {Anvandare | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {Error | null} */ (null));

  useEffect(() => {
    const av = autentisering.lyssna((a) => {
      setUser(a);
      setLoading(false);
    });
    return av;
  }, [autentisering]);

  const loggaIn = useCallback(() => {
    setError(null);
    autentisering.loggaIn().catch((e) => setError(e instanceof Error ? e : new Error(String(e))));
  }, [autentisering]);

  const loggaUt = useCallback(() => {
    autentisering.loggaUt().catch((e) => setError(e instanceof Error ? e : new Error(String(e))));
  }, [autentisering]);

  const contextValue = useMemo(() => ({ user, loading, error, loggaIn, loggaUt }), [user, loading, error, loggaIn, loggaUt]);
  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useOpsAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useOpsAuth: ingen OpsAuthProvider hittades. Lägg den högst upp i appen.");
  return ctx;
}

/**
 * Visar sitt innehåll för den som är inloggad och godkänd.
 *
 * ⛔ Igen: det här styr RENDERING, inte åtkomst. `allowedRoles` här måste ha
 * en motsvarighet i Firestore-reglerna eller i API:et, annars är listan en
 * skylt och inte ett lås.
 *
 * @param {object} props
 * @param {string[]} [props.allowedRoles] Tom eller utelämnad betyder "vem som helst som är inloggad".
 * @param {string} [props.title]
 * @param {string} [props.description]
 * @param {string} [props.signInText]
 * @param {string} [props.deniedTitle]
 * @param {string} [props.deniedText]
 * @param {import("react").ReactNode} props.children
 */
export function OpsAuthGate({
  allowedRoles,
  title = "Logga in",
  description = "Den här plattformen kräver inloggning.",
  signInText = "Logga in med Google",
  deniedTitle = "Du har inte tillgång",
  deniedText = "Ditt konto är inloggat men saknar behörighet här. Be den som förvaltar plattformen lägga till dig.",
  children,
}) {
  const { user, loading, error, loggaIn } = useOpsAuth();

  if (loading) {
    return (
      <OpsView width="narrow">
        <OpsEmpty busy title={title} busyLabel="Kontrollerar inloggning" />
      </OpsView>
    );
  }

  if (!user) {
    return (
      <OpsView width="narrow">
        <OpsViewHeader title={title} description={description} />
        <OpsCard>
          <OpsButton variant="primary" onClick={loggaIn}>
            {signInText}
          </OpsButton>
          {/* Felet visas, det sväljs inte. En inloggning som inte händer och
              inte förklarar sig får användaren att trycka igen i evighet. */}
          {error ? <p className="mt-3 text-base text-danger">{error.message}</p> : null}
        </OpsCard>
      </OpsView>
    );
  }

  const denied = Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user.role ?? "");
  if (denied) {
    return (
      <OpsView width="narrow">
        <OpsViewHeader title={deniedTitle} description={deniedText} />
      </OpsView>
    );
  }

  return <>{children}</>;
}
