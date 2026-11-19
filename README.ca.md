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

1. Fes el canvi al plugin, dins de `usage/`, i passa'n els tests:
   `claude plugin test usage`.
2. Puja la `version` de `usage/.claude-plugin/plugin.json`: l'últim número per
   a un bugfix (0.6.4 → 0.6.5), el del mig per a una funcionalitat nova
   (0.6.x → 0.7.0). Claude Code només actualitza un plugin si la versió canvia.
3. Afegeix el canvi al `CHANGELOG.md`.
4. Fes commit, crea el tag `usage-v<versió>` i puja-ho amb els tags:
   `git push --follow-tags`.

## Llicència

MIT, vegeu [LICENSE](LICENSE).
