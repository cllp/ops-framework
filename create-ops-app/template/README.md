# __APP_NAME__

Ops-plattform på `@staiger/ops-framework`.

## Kom igång

```
npm install
npm run dev
```

Öppna `/primitiver` för att se allt ramverket levererar, i båda temalägena.

## Kommandon

| | |
|---|---|
| `npm run dev` | utvecklingsserver |
| `npm run gate` | lokala grinden. Kör den före push |
| `npm run check` | samma kontroller, utan den fetstilta utskriften |
| `npm run build` | produktionsbygge |

## Var saker bor

| | |
|---|---|
| `src/index.css` | appens profil. Bara VÄRDEN, aldrig struktur |
| `src/app/views/` | vyerna |
| `src/lib/` | appens egna hjälpare |
| `node_modules/@staiger/ops-framework/` | tokens, primitiver, arbetsregler, skills, vakter |

## Nästa steg

1. Sätt appens accent i `src/index.css`.
2. Byt ut `DashboardView` mot appens egna data.
3. Behåll `PrimitivesView`. Den är enda stället där utseendet går att se i båda
   temalägena utan att bygga en riktig funktion först.
4. Installera grinden som git-hook:
   `printf '#!/bin/sh\nnpm run gate\n' > .git/hooks/pre-push && chmod +x .git/hooks/pre-push`
