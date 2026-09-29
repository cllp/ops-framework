import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { OpsInloggning } from "../components/OpsInloggning.jsx";
import { OpsLaddaSkelett } from "../components/OpsLaddaSkelett.jsx";
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
 *
 * ══ ⛔ #164, KORRIGERING B: FÖRMÅGOR, INTE ETT ENDA signIn ═══════════════
 *
 * CP: "OpsInloggning exakt enligt formen jag skickade (piller-rader per
 * adapterförmåga ...)". Fram till denna ändring hade en `Authentication` EN
 * inloggningsväg (`signIn`), byggd för Google via `createGoogleAuth`. Mätt
 * mot SessionStudios `LoginScreen.jsx`: Google, Apple, e-postlänk, lösenord
 * (logga in OCH skapa konto) och lösenordsåterställning är FEM olika vägar in,
 * och en app som bara har Google ska INTE se fyra döda knappar.
 *
 * Lösningen är samma mönster som `lagring` (valfri Storage) och `sdk`
 * (valfri auth-SDK): en FÖRMÅGA finns bara om appens adapter faktiskt gav en
 * funktion för den. `createAuth` normaliserar adaptern till en lista NÄRVARANDE
 * förmågor, `OpsInloggning` ritar en rad per förmåga som finns och INGEN för
 * de som saknas (se testerna "bara Google ritar en rad" / "allt ritar allt").
 *
 * ⛔ `signIn` ÄR KVAR, BAKÅTKOMPATIBELT. Den behandlas som `signInWithGoogle`
 * om appen inte gett ett uttryckligt `signInWithGoogle`. Ett brytande API här
 * hade tvingat om varje befintlig adapter samma dag som den här filen ändrades,
 * för en förmåga (Google) som redan fanns och redan fungerade.
 */

/**
 * @typedef {object} User
 * @property {string} id
 * @property {string} [email]
 * @property {string} [namn]
 * @property {string} [imageUrl]
 * @property {string} [role] Kommer ur appens egen användarlista, inte ur Google.
 */

/**
 * En adapters råa form, INNAN `createAuth` normaliserar den. `signIn` är
 * den gamla, bakåtkompatibla vägen in (blir `signInWithGoogle`).
 * @typedef {object} AuthAdapter
 * @property {() => Promise<void>} [signIn] Bakåtkompatibel synonym för `signInWithGoogle`.
 * @property {() => Promise<void>} [signInWithGoogle]
 * @property {() => Promise<void>} [signInWithApple]
 * @property {(email: string) => Promise<void>} [sendEmailLink]
 * @property {(email: string) => Promise<void>} [completeEmailLink]
 * @property {(email: string, password: string) => Promise<void>} [signInWithPassword]
 * @property {(email: string, password: string, namn?: string) => Promise<void>} [createAccount]
 * @property {(email: string) => Promise<void>} [resetPassword]
 * @property {() => Promise<void>} signOut
 * @property {(listener: (a: User | null) => void) => () => void} subscribe Returnerar en avregistrering.
 */

/**
 * Adaptern EFTER normalisering: bara de förmågor som faktiskt finns, plus
 * `signOut`/`subscribe` som alltid krävs.
 * @typedef {Pick<AuthAdapter, "signInWithGoogle"|"signInWithApple"|"sendEmailLink"|"completeEmailLink"|"signInWithPassword"|"createAccount"|"resetPassword"> & { signOut: () => Promise<void>, subscribe: (listener: (a: User | null) => void) => () => void }} Authentication
 */

const AuthContext = createContext(
  /** @type {{ user: User | null, loading: boolean, error: Error | null, auth: Authentication, signOut: () => void, clearError: () => void } | null} */ (null),
);

/** Förmågorna `createAuth` normaliserar, utöver `signOut`/`subscribe`. */
const FORMAGOR = /** @type {const} */ ([
  "signInWithGoogle",
  "signInWithApple",
  "sendEmailLink",
  "completeEmailLink",
  "signInWithPassword",
  "createAccount",
  "resetPassword",
]);

/**
 * Kontrollerar att en adapter är hel innan den används, och normaliserar
 * `signIn` (bakåtkompatibelt) till `signInWithGoogle`.
 * @param {AuthAdapter} adapter @returns {Authentication}
 */
export function createAuth(adapter) {
  const bas = /** @type {Record<string, any>} */ (adapter ?? {});
  const missing = ["signOut", "subscribe"].filter((op) => typeof bas[op] !== "function");
  if (missing.length > 0) {
    throw new Error(`createAuth: adaptern saknar ${missing.join(", ")}.`);
  }

  /** @type {any} */
  const normaliserad = { signOut: bas.signOut, subscribe: bas.subscribe };
  // ⛔ `signInWithGoogle` VINNER över `signIn` om BÅDA finns: en adapter som
  // medvetet gett den nya, exakta namnet menar det namnet.
  const google = typeof bas.signInWithGoogle === "function" ? bas.signInWithGoogle : bas.signIn;
  if (typeof google === "function") normaliserad.signInWithGoogle = google;
  for (const namn of FORMAGOR) {
    if (namn === "signInWithGoogle") continue;
    if (typeof bas[namn] === "function") normaliserad[namn] = bas[namn];
  }
  return /** @type {Authentication} */ (Object.freeze(normaliserad));
}

/**
 * Google-inloggning via Firebase Auth, med VALFRIA tillägg ur samma `sdk`.
 *
 * ```js
 * import * as auth from "firebase/auth";
 * const autentisering = createGoogleAuth({
 *   auth: auth.getAuth(app),
 *   sdk: auth,
 *   fetchProfile: async (a) => kalla.las("users", a.id),
 * });
 * ```
 *
 * `fetchProfile` är valfri och är det som ger `role`. Den läser appens egen
 * användarlista, alltså ett dokument per användare, via datalagret. Rollen
 * kommer aldrig från Google: Google svarar på vem någon ÄR, inte på vad hen får.
 *
 * ══ ⛔ #164: E-POSTLÄNK, LÖSENORD OCH APPLE ÄR VALFRIA DELAR AV SAMMA `sdk` ═
 *
 * `sdk` är HELA `"firebase/auth"`-modulen redan i dag (kravet på
 * `GoogleAuthProvider`/`signInWithPopup`/`signOut`/`onAuthStateChanged`
 * bevisar det). De sex extra funktionerna (`sendSignInLinkToEmail`,
 * `isSignInWithEmailLink`, `signInWithEmailLink`,
 * `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`,
 * `sendPasswordResetEmail`) finns REDAN på det objektet varje app redan
 * skickar in. Ingen ny import, ingen ny config-nyckel: förmågan tänds av sig
 * själv den dag Firebase Console har det inloggningssättet påslaget, för då
 * FUNGERAR funktionen även om appen inte visste att den fanns.
 *
 * ⛔ SAKNAS EN FUNKTION I `sdk` SAKNAS FÖRMÅGAN, TYST. Ingen kastar: en app
 * med en äldre `firebase/auth`-version, eller en attrapp i ett prov som bara
 * gav de fyra grundläggande, ska inte krascha för att den inte skickade in
 * lösenordsfunktioner den aldrig bad om.
 *
 * @param {{ auth: any, sdk: Record<string, any>, fetchProfile?: (a: User) => Promise<any>, emailLinkRedirectUrl?: string }} config
 * @returns {Authentication}
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
  const { auth, sdk, fetchProfile, emailLinkRedirectUrl } = config ?? /** @type {any} */ ({});
  if (!auth) throw new Error("createGoogleAuth: auth krävs. Skicka in getAuth(app).");
  const missing = ["GoogleAuthProvider", "signInWithPopup", "signOut", "onAuthStateChanged"].filter((f) => !sdk?.[f]);
  if (missing.length > 0) {
    throw new Error(`createGoogleAuth: sdk saknar ${missing.join(", ")}. Skicka in hela modulen "firebase/auth".`);
  }

  /** @type {any} */
  const bas = {
    namn: "google",
    async signInWithGoogle() {
      await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider());
    },
    async signOut() {
      await sdk.signOut(auth);
    },
    subscribe(/** @type {(a: User | null) => void} */ listener) {
      return sdk.onAuthStateChanged(auth, async (/** @type {any} */ account) => {
        if (!account) {
          listener(null);
          return;
        }
        /** @type {User} */
        const base = { id: account.uid, email: account.email ?? undefined, namn: account.displayName ?? undefined, imageUrl: account.photoURL ?? undefined };
        if (!fetchProfile) {
          listener(base);
          return;
        }
        try {
          const profile = await fetchProfile(base);
          listener({ ...base, ...(profile ?? {}) });
        } catch {
          // ⛔ Misslyckas profilhämtningen loggas användaren in UTAN roll, inte
          // in med en gissad roll. Ett fel i en uppslagning får aldrig ge mer
          // behörighet än den som lyckades.
          listener(base);
        }
      });
    },
  };

  // ⛔ APPLE, SAMMA MEKANISM SOM GOOGLE: `sdk.OAuthProvider` finns i
  // "firebase/auth" oavsett om appen aktiverat Apple i Firebase Console.
  // Förmågan tänds bara när appen UTTRYCKLIGEN ber om den (`appleProvider`
  // eller `sdk.OAuthProvider`), av samma skäl som resten: ingen gissad
  // provider-sträng, ingen tyst inloggningsväg appen inte visste fanns.
  if (typeof sdk.OAuthProvider === "function") {
    bas.signInWithApple = async () => {
      await sdk.signInWithPopup(auth, new sdk.OAuthProvider("apple.com"));
    };
  }

  if (typeof sdk.sendSignInLinkToEmail === "function") {
    bas.sendEmailLink = async (/** @type {string} */ email) => {
      const url = emailLinkRedirectUrl ?? (typeof window !== "undefined" ? window.location.href : "");
      await sdk.sendSignInLinkToEmail(auth, email, { url, handleCodeInApp: true });
      // ⛔ E-POSTEN SPARAS FÖR ATT ÅTERANVÄNDAS OM LÄNKEN ÖPPNAS PÅ SAMMA
      // ENHET. Firebase kräver adressen igen vid `signInWithEmailLink` när
      // den inte kan läsas ur en cross-device-QR, och SessionStudios egen
      // "emailLinkSentTo"-mönster gör likadant. `try/catch`: en privat flik
      // utan `localStorage` ska inte krascha SKICKANDET, bara tvinga fram
      // att man skriver adressen igen på completeEmailLink-sidan.
      try {
        globalThis.localStorage?.setItem("opsEmailLinkAdress", email);
      } catch {
        // Se kommentaren ovan.
      }
    };
  }

  if (typeof sdk.isSignInWithEmailLink === "function" && typeof sdk.signInWithEmailLink === "function") {
    bas.completeEmailLink = async (/** @type {string} */ email) => {
      const url = typeof window !== "undefined" ? window.location.href : "";
      if (!sdk.isSignInWithEmailLink(auth, url)) {
        throw new Error("completeEmailLink: den här adressen är ingen giltig e-postlänk.");
      }
      await sdk.signInWithEmailLink(auth, email, url);
      try {
        globalThis.localStorage?.removeItem("opsEmailLinkAdress");
      } catch {
        // Se noten vid sendEmailLink.
      }
    };
  }

  if (typeof sdk.signInWithEmailAndPassword === "function") {
    bas.signInWithPassword = async (/** @type {string} */ email, /** @type {string} */ password) => {
      await sdk.signInWithEmailAndPassword(auth, email, password);
    };
  }

  if (typeof sdk.createUserWithEmailAndPassword === "function") {
    bas.createAccount = async (/** @type {string} */ email, /** @type {string} */ password, /** @type {string | undefined} */ namn) => {
      const cred = await sdk.createUserWithEmailAndPassword(auth, email, password);
      if (namn && typeof sdk.updateProfile === "function" && cred?.user) {
        await sdk.updateProfile(cred.user, { displayName: namn });
      }
    };
  }

  if (typeof sdk.sendPasswordResetEmail === "function") {
    bas.resetPassword = async (/** @type {string} */ email) => {
      await sdk.sendPasswordResetEmail(auth, email);
    };
  }

  return createAuth(bas);
}

/**
 * @param {{ authentication: Authentication, children: import("react").ReactNode, felmottagare?: import("../lib/felrapport.js").Felmottagare | null }} props
 *
 * ⛔ #159: `felmottagare.satt` KALLAS HÄR, VID VARJE INLOGGNINGSBYTE. Det är
 * den enda platsen som SÄKERT vet vem som är inloggad: uid och, om appens
 * `fetchProfile` skickat med den, `groupId`. ALDRIG e-post, se felrapport.js
 * filhuvud: `User.email` finns på objektet men skickas medvetet inte vidare.
 */
export function OpsAuthProvider({ authentication, children, felmottagare }) {
  const [user, setUser] = useState(/** @type {User | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {Error | null} */ (null));

  useEffect(() => {
    const av = authentication.subscribe((a) => {
      setUser(a);
      setLoading(false);
      if (felmottagare) felmottagare.satt(a ? { uid: a.id, groupId: /** @type {any} */ (a).groupId } : null);
    });
    return av;
  }, [authentication, felmottagare]);

  const signOut = useCallback(() => {
    setError(null);
    authentication.signOut().catch((e) => setError(e instanceof Error ? e : new Error(String(e))));
  }, [authentication]);

  const clearError = useCallback(() => setError(null), []);

  const contextValue = useMemo(
    () => ({ user, loading, error, auth: authentication, signOut, clearError }),
    [user, loading, error, authentication, signOut, clearError],
  );
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
 * ⛔ #164, KORRIGERING B: OpsInloggning RITAR DET UTLOGGADE LÄGET, inte en
 * ensam "Logga in med Google"-knapp. `OpsAuthGate` skickar vidare BARA de
 * props som ändrar FORMEN (etikett, viskning, sidfotslänkar, språk); vilka
 * PILLER som syns bestäms av vilka förmågor `auth` faktiskt har, inte av
 * något OpsAuthGate behöver veta.
 *
 * @param {object} props
 * @param {string[]} [props.allowedRoles] Tom eller utelämnad betyder "vem som helst som är inloggad".
 * @param {string} [props.title] Skärmläsarrubriken över kortet ("Kontrollerar inloggning"-läget) OCH `OpsInloggning`s rubrik.
 * @param {string} [props.description] Används inte längre (0.31.0): laddningsläget är ett skelett, inte en text. Kvar i typen så att ingen app går sönder.
 * @param {import("../components/OpsBrand.jsx").MarkeNamn} [props.namn] `OpsInloggning props.namn`, märkets rad 1 (förval "OPS HUB").
 * @param {string} [props.etikett] `OpsInloggning props.etikett`, appens namn som märkets rad 2.
 * @param {string} [props.viskning] `OpsInloggning props.viskning`.
 * @param {{ label: string, href: string }[]} [props.lankar] `OpsInloggning props.lankar`.
 * @param {string} [props.appVersion] `OpsInloggning props.appVersion`.
 * @param {"sv"|"en"} [props.sprak]
 * @param {(sprak: "sv"|"en") => void} [props.onSprak]
 * @param {string} [props.deniedTitle]
 * @param {string} [props.deniedText]
 * @param {number} [props.laddaLangsamMs] (0.31.0) Efter så här många ms visas raden med "Försök igen" i laddningsläget. Förval 8000.
 * @param {string} [props.laddaLangsamText]
 * @param {string} [props.forsokIgenEtikett]
 * @param {() => void} [props.onForsokIgen] Vad "Försök igen" gör. Förval: ladda om sidan.
 * @param {import("react").ReactNode} props.children
 */
export function OpsAuthGate({
  allowedRoles,
  title = "Logga in",
  namn,
  etikett,
  viskning,
  lankar,
  appVersion,
  sprak = "sv",
  onSprak,
  deniedTitle = "Du har inte tillgång",
  deniedText = "Ditt konto är inloggat men saknar behörighet här. Be den som förvaltar plattformen lägga till dig.",
  laddaLangsamMs,
  laddaLangsamText,
  forsokIgenEtikett,
  onForsokIgen,
  children,
}) {
  const { user, loading, error, auth, clearError } = useOpsAuth();

  if (loading) {
    // ⛔ 0.31.0: ETT SKELETT AV HUVUDET OCH INNEHÅLLET, inte en text på en tom sida, och efter en tidsgräns en rad med
    // "Försök igen". Se `OpsLaddaSkelett`.
    return <OpsLaddaSkelett langsamEfterMs={laddaLangsamMs} langsamText={laddaLangsamText} forsokIgenEtikett={forsokIgenEtikett} onForsokIgen={onForsokIgen} />;
  }

  if (!user) {
    return (
      <OpsInloggning
        auth={auth}
        rubrik={title}
        namn={namn}
        etikett={etikett}
        viskning={viskning}
        lankar={lankar}
        appVersion={appVersion}
        sprak={sprak}
        onSprak={onSprak}
        fel={error?.message}
        onRensaFel={clearError}
      />
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
