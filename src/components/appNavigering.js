import { createContext } from "react";

/**
 * Appens navigering, som skalet ger sina länkar (`OpsAppShell`s `onNavigate`), för vyer djupt inne som inte får den som prop (0.234.0,
 * cllp/lifehub.app#860, L3). `OpsMarkdown` öppnar en länk till appen själv med den, utan omladdning och i samma flik.
 *
 * ⛔ `null` UTANFÖR SKALET. Då är en länk till appen en vanlig länk i samma flik, och webbläsaren laddar sidan.
 */
export const AppNavigeringKontext = createContext(/** @type {((href: string, event: any) => void) | null} */ (null));
