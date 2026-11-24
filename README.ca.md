# claude-mods

[English](README.md) · **Català**

Un marketplace de plugins per a Claude Code, de moment amb un sol plugin:
**usage**.

## usage

Una banda a sobre del quadre de text amb el consum del teu pla:

- **5h** (taronja): la finestra de 5 hores, amb el temps que falta perquè es
  renovi.
- **7d** (blau): la finestra setmanal, amb els dies i les hores que falten
  perquè es renovi.
- **Fable** (lila): la finestra setmanal pròpia de Fable, que només surt
  mentre el compte en té una.

Es dibuixa com un SVG a VS Code i a l'app d'escriptori de Claude Code (seguint
el mode clar o fosc de l'app), i com a text amb barres fines al terminal.

Les xifres de 5h i 7d surten de la mateixa sessió. La barra de Fable consulta
l'endpoint d'ús del compte amb la credencial de la sessió, com a molt un cop
cada cinc minuts; aquest endpoint no és una API documentada per a plugins i pot
canviar.

### Què llegeix i què envia

- **Xarxa:** una sola petició, `GET https://api.anthropic.com/api/oauth/usage`,
  en obrir la sessió i després com a molt un cop cada cinc minuts. No envia cap
  cos; la credencial de la sessió l'afegeix Claude Code
  (`$.session.authorize`), i el plugin no la veu ni la desa. No envia res enlloc
  més, i `plugin.json` declara `api.anthropic.com` com a únic host
  (`network.hosts`).
- **Dades que guarda:** només les últimes lectures (les finestres d'ús, la fila
  setmanal de Fable i l'hora actual), a l'estat de Claude Code per al plugin
  (`usage.limits`, `usage.model`, `usage.now`). El plugin no escriu cap fitxer
  propi, i no surt res de l'ordinador a part d'aquesta petició.
- **Codi:** un sol fitxer TypeScript llegible, `usage/hooks/register.tsx`.
  `claude plugin validate ./usage` llista tots els hooks i les crides que fa.

## Instal·lació

Aquest repositori és privat: cal que hi tinguis accés a GitHub i que el git del
teu ordinador estigui configurat per clonar-lo (clau SSH o `gh auth login`).

A Claude Code:

```
/plugin marketplace add l0cu/claude-mods
/plugin install usage@claude-mods
```

Després, `/reload-plugins` o obre una sessió nova.

## Actualització

```
/plugin marketplace update claude-mods
```

Després, `/reload-plugins` a cada sessió oberta. Si actives l'actualització
automàtica del marketplace a `/plugin`, el primer pas es fa sol.

## Publicar una versió nova (mantenidors)

`main` és el que reben els usuaris, des d'aquest marketplace i des del
directori de plugins, així que els canvis només hi arriben amb un pull request.

1. En una branca, fes el canvi al plugin, dins de `usage/`, i passa'n els
   tests: `claude plugin test usage`.
2. Puja la `version` de `usage/.claude-plugin/plugin.json`: l'últim número per
   a un bugfix (0.6.4 → 0.6.5), el del mig per a una funcionalitat nova
   (0.6.x → 0.7.0). Claude Code només actualitza un plugin si la versió canvia.
3. Afegeix una secció `## usage <versió>` al `CHANGELOG.md`.
4. Obre un pull request. El workflow `plugin` valida el marketplace i el plugin
   (també amb les comprovacions del directori de plugins), passa els tests i
   falla si el plugin ha canviat sense una versió nova i la seva entrada al
   CHANGELOG.
5. Fes-ne el merge. El workflow etiqueta el commit `usage--v<versió>`, i el
   directori de plugins agafa la versió nova de `main` tot sol.

## Llicència

MIT, vegeu [LICENSE](LICENSE).
