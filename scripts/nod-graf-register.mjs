/**
 * Registrerar `nod-graf-krok.mjs` som modulhook i en Node-process (`node --import scripts/nod-graf-register.mjs ...`).
 * Loggfilen anges med miljövariabeln NOD_GRAF_LOGG. Används av `src/__tests__/nod-ren-ingang.test.js`.
 */
import { register } from "node:module";

register("./nod-graf-krok.mjs", { parentURL: import.meta.url, data: { logg: process.env.NOD_GRAF_LOGG } });
