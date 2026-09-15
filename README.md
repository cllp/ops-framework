# ops-framework

Gemensamt lager för Staigers ops-plattformar (`bolag-ops`, `tam`).

Hantverk, inte domän: arbetsregler, tokenkontrakt, komponentkontrakt och vakter.
**Inget datalager och ingen auktorisationsmodell**, eftersom plattformarna
divergerar där med flit: `bolag-ops` går mot Firebase, `tam` är ett korpus där
repot är datan.

| Fil | Vad |
|---|---|
| `CLAUDE.md` | arbetsreglerna. Varje regel bär händelsen som skapade den |
| `tokens/tokens.css` | tokenkontraktet. Struktur kanon, värden per app |
| `tokens/check-tokens.mjs` | vakten. Fyra regler, alla bevisade röda |
| `docs/TOKENS.md` | kontraktets regler och skälen |
| `docs/COMPONENTS.md` | listor, kort, piller, vyer. Beslut plus spridningen de svalde |

## Kör vakten

```
node tokens/check-tokens.mjs tokens/tokens.css
```

## Status

Frö, inte färdigt. Byggt 2026-09-15. Kvar: de portabla vakterna ur
SessionStudio (ungefär femton av 49), primitiverna som komponentkontraktet
förutsätter, och den genererade regelkopian med driftvakt för konsumentrepon.
