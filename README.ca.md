# claude-mods

[English](README.md) · **Català**

Un marketplace de plugins per a Claude Code amb **dos plugins**. Cadascun
s'instal·la per separat: pots instal·lar-ne un o tots dos.

| Plugin | Què mostra | Instal·lació |
| --- | --- | --- |
| **[usage](#usage)** | Una banda a sobre del quadre de text amb el consum del teu pla: les finestres de 5 hores i setmanal, i la de Fable | `/plugin install usage@claude-mods` |
| **[e2e-progress](#e2e-progress)** | Una banda groga a sobre del quadre de text amb el progrés d'una execució de Playwright | `/plugin install e2e-progress@claude-mods` |

- [Inici ràpid](#inici-ràpid): afegir el marketplace, instal·lar, actualitzar
- [usage](#usage): què mostra, què llegeix i què envia, instal·lar-lo o
  actualitzar-lo demanant-ho a Claude
- [e2e-progress](#e2e-progress): què mostra, com funciona, instal·lar-lo
  demanant-ho a Claude
- [Publicar una versió nova (mantenidors)](#publicar-una-versió-nova-mantenidors)

## Inici ràpid

### Instal·lació

A Claude Code, afegeix el marketplace una vegada i després instal·la els
plugins que vulguis:

```
/plugin marketplace add l0cu/claude-mods
/plugin install usage@claude-mods
/plugin install e2e-progress@claude-mods
```

Després, `/reload-plugins` o obre una sessió nova (e2e-progress posa les seves
variables en obrir-se una sessió).

Cada plugin té també un prompt que pots enganxar en una sessió perquè Claude
l'instal·li i el comprovi: mira'ls a [usage](#usage) i a
[e2e-progress](#e2e-progress).

### Actualització

Una sola ordre actualitza tots dos plugins:

```
/plugin marketplace update claude-mods
```

Després, `/reload-plugins` a cada sessió oberta. Si actives l'actualització
automàtica del marketplace a `/plugin`, el primer pas es fa sol.

El terminal, VS Code i Claude Code Desktop comparteixen una sola instal·lació
(a `~/.claude`), així que n'hi ha prou d'instal·lar o actualitzar una vegada des
de qualsevol d'ells.

---

## usage

`usage@claude-mods` · carpeta [`usage/`](usage/) · [CHANGELOG](CHANGELOG.md)

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

### Instal·lar usage des de GitHub demanant-ho a Claude

Enganxa això en una sessió de qualsevol màquina. Si `usage` està instal·lat
des d'un altre lloc (una carpeta local, un altre marketplace o repositori),
Claude el desinstal·la i el torna a instal·lar des de GitHub; abans de treure
un marketplace t'ho pregunta.

<details>
<summary>Prompt: instal·lar <code>usage</code> des de GitHub</summary>

```text
Assegura't que el plugin `usage` està instal·lat des del marketplace
`claude-mods` de GitHub (l0cu/claude-mods) i, si ve de qualsevol altre lloc,
desinstal·la'l i instal·la'l des d'allà. Fes servir només l'ordre
`claude plugin` des del shell; no editis a mà res de `~/.claude`.

1. Executa `claude --version`. Si `claude` no és al PATH, atura't i digues-me
   que escrigui jo això i després `/reload-plugins`:
     /plugin marketplace add l0cu/claude-mods
     /plugin install usage@claude-mods
2. Executa `claude plugin list --json` i `claude plugin marketplace list --json`.
   Apunta't cada plugin instal·lat amb `id` `usage@<marketplace>`, amb la seva
   `version` i el seu `scope`, i l'origen de cadascun d'aquests marketplaces.
   Una entrada apunta a GitHub quan el seu marketplace és `claude-mods` i
   aquest marketplace té `source: github` i `repo: l0cu/claude-mods`.
3. Si l'única entrada és `usage@claude-mods` i apunta a GitHub, digues-me que
   ja està instal·lat des de GitHub, amb la seva versió, i atura't: no canviïs
   res. Si no n'hi ha cap, ves al pas 6.
4. Si el marketplace `claude-mods` existeix però no apunta a GitHub (una
   carpeta local, un altre repositori, una URL), ensenya'm el seu origen i
   tots els altres plugins instal·lats des d'ell (`<nom>@claude-mods`), i
   pregunta'm abans de canviar res: s'ha de treure i tornar a afegir des de
   GitHub. Espera la meva resposta; si et dic que no, atura't.
5. Desinstal·la cada entrada que no apunti a GitHub:
   `claude plugin uninstall usage@<marketplace> --scope <el seu scope>`. Si el
   seu scope no és `user`, `project` ni `local`, o l'ordre falla, ensenya'm
   l'entrada i l'error i atura't.
6. Si `claude-mods` no apunta a GitHub, executa
   `claude plugin marketplace remove claude-mods` (només si al pas 4 t'he dit
   que sí). Si ara no hi és, executa
   `claude plugin marketplace add l0cu/claude-mods`. Després executa
   `claude plugin marketplace update claude-mods`.
7. Executa `claude plugin install usage@claude-mods`. Si alguna ordre et
   demana confirmar una ordre declarada pel marketplace, no passis `-y`:
   ensenya-me-la i espera.
8. Torna a executar les dues llistes i comprova: `claude-mods` té
   `source: github` i `repo: l0cu/claude-mods`; l'única entrada `usage@…` és
   `usage@claude-mods`, amb `enabled: true` i la `version` de
   `<installLocation de claude-mods>/usage/.claude-plugin/plugin.json`.
9. Respon-me amb el que has trobat, el que has desinstal·lat o tret, i la
   versió instal·lada ara. Si el pas 4 ha llistat altres plugins, digues-me
   que els torni a instal·lar des de GitHub. Recorda'm que faci
   `/reload-plugins` a cada sessió oberta (terminal, VS Code i Desktop) o que
   n'obri de noves, perquè Claude no pot escriure aquesta ordre, i que
   comprovi a `/plugin` que l'actualització automàtica de `claude-mods` està
   activada.
```

</details>

### Actualitzar usage demanant-ho a Claude

Enganxa això en una sessió; n'hi ha prou amb una, des de qualsevol lloc.

<details>
<summary>Prompt: actualitzar <code>usage</code></summary>

```text
Actualitza el plugin `usage` del marketplace `claude-mods` (GitHub:
l0cu/claude-mods) a l'última versió de `main`, i comprova-ho. Fes servir només
l'ordre `claude plugin` des del shell; no editis a mà res de `~/.claude`.

1. Executa `claude --version`. Si `claude` no és al PATH, atura't i digues-me
   que escrigui jo `/plugin marketplace update claude-mods` i després
   `/reload-plugins`.
2. Executa `claude plugin marketplace list --json` i comprova que hi ha
   `claude-mods` amb `source: github` i `repo: l0cu/claude-mods`. Si no hi és,
   afegeix-lo amb `claude plugin marketplace add l0cu/claude-mods`. Si hi és
   però apunta a un altre lloc, atura't i explica-m'ho.
3. Executa `claude plugin marketplace update claude-mods`.
4. Llegeix `version` de
   `<installLocation de claude-mods>/usage/.claude-plugin/plugin.json`: és la
   versió que hi ha ara a GitHub.
5. Executa `claude plugin list --json` i busca `usage@claude-mods`:
   - si no hi és: `claude plugin install usage@claude-mods`
   - si hi és amb una versió més antiga: `claude plugin update usage@claude-mods`
   - si ja té la mateixa versió: no cal fer res.
   Si alguna ordre et demana confirmar una ordre declarada pel marketplace, no
   passis `-y`: ensenya-me-la i espera.
6. Torna a executar `claude plugin list --json` i comprova que
   `usage@claude-mods` té la versió del pas 4 i `enabled: true`.
7. Respon-me amb la versió d'abans, la d'ara i la de GitHub. Recorda'm que faci
   `/reload-plugins` a cada sessió oberta (terminal, VS Code i Desktop) o que
   n'obri de noves: Claude no pot escriure aquesta ordre per mi.
```

</details>

---

## e2e-progress

`e2e-progress@claude-mods` · carpeta [`e2e-progress/`](e2e-progress/) ·
[CHANGELOG](CHANGELOG.md) · [README complet](e2e-progress/README.md) (en
anglès)

Una banda groga a sobre del quadre de text amb el progrés d'una execució de
Playwright engegada des de la sessió: les proves fetes del total, les fallades,
les flaky i les saltades, el percentatge fet, el temps i la prova que corre
ara. Quan l'execució acaba, la banda diu com ha acabat i s'hi queda un minut;
si en dos minuts no s'ha escrit res, es torna grisa i diu `stalled?`.

### Com funciona

En obrir la sessió, el plugin posa `PW_TEST_REPORTER` i `E2E_PROGRESS_FILE` al
procés de Claude Code, així que totes les ordres que s'engeguen des de la
sessió les passen a Playwright, que afegeix el *reporter* del plugin als que
diu la seva configuració. No canvia cap fitxer del projecte ni cap ordre.
`PW_TEST_REPORTER` és una variable interna de Playwright, no documentada
(comprovat amb Playwright 1.64.1).

No fa cap petició de xarxa, i escriu un petit fitxer de progrés per sessió a la
seva carpeta de dades. Els detalls, i com veure una execució del teu propi
terminal, són a [e2e-progress/README.md](e2e-progress/README.md) (en anglès).

### Instal·lar e2e-progress demanant-ho a Claude

Enganxa això en una sessió de qualsevol màquina. Claude no pot escriure
`/reload-plugins`, així que te'l demana i després comprova si la sessió ha
agafat el plugin o en cal una de nova.

<details>
<summary>Prompt: instal·lar <code>e2e-progress</code></summary>

```text
Instal·la el plugin `e2e-progress` del marketplace `claude-mods` (GitHub:
l0cu/claude-mods), l'última versió de `main`, i comprova que funciona en
aquesta sessió. Fes servir només l'ordre `claude plugin` des del shell; no
editis a mà res de `~/.claude`.

1. Executa `claude --version`. Si `claude` no és al PATH, atura't i digues-me
   que escrigui jo això i després `/reload-plugins`:
     /plugin marketplace add l0cu/claude-mods
     /plugin install e2e-progress@claude-mods
2. Executa `claude plugin marketplace list --json` i busca `claude-mods`:
   - si no hi és: `claude plugin marketplace add l0cu/claude-mods`
   - si hi és amb `source: github` i `repo: l0cu/claude-mods`: continua
   - si apunta a un altre lloc: atura't i explica-m'ho.
3. Executa `claude plugin marketplace update claude-mods`.
4. Llegeix `version` de
   `<installLocation de claude-mods>/e2e-progress/.claude-plugin/plugin.json`:
   és la versió que hi ha ara a GitHub.
5. Executa `claude plugin list --json` i busca `e2e-progress@claude-mods`:
   - si no hi és: `claude plugin install e2e-progress@claude-mods`
   - si hi és amb una versió més antiga:
     `claude plugin update e2e-progress@claude-mods`
   - si ja té la mateixa versió: no cal instal·lar res.
   Si alguna ordre et demana confirmar una ordre declarada pel marketplace, no
   passis `-y`: ensenya-me-la i espera.
6. Torna a executar `claude plugin list --json` i comprova que
   `e2e-progress@claude-mods` té la versió del pas 4 i `enabled: true`.
7. Respon-me amb la versió d'abans, la d'ara i la de GitHub. Després demana'm
   que escrigui `/reload-plugins` en aquesta sessió i que et contesti "fet":
   tu no pots escriure aquesta ordre. Espera la meva resposta.
8. Quan et contesti, executa una ordre de shell nova que mostri les variables
   d'entorn `PW_TEST_REPORTER` i `E2E_PROGRESS_FILE`:
   - si hi són totes dues, `PW_TEST_REPORTER` acaba en
     `e2e-progress/<versió del pas 4>/hooks/progress-reporter.mjs` (amb
     qualsevol barra) i `E2E_PROGRESS_FILE` acaba en
     `progress-<id d'aquesta sessió>.json`: digues-me que el plugin ja és actiu
     aquí, i que una execució de Playwright que comenci des d'aquesta sessió
     (`npx playwright test`, `npm run e2e`…) mostra una banda groga sobre el
     prompt.
   - si no hi són, o apunten a una altra versió: digues-me que el plugin està
     instal·lat però aquesta sessió no l'ha agafat, i que he d'obrir una sessió
     nova (terminal, VS Code o Desktop) perquè sigui actiu.
   No posis tu aquestes variables: la banda només llegeix el fitxer quan les ha
   posades el plugin.
```

</details>

---

## Publicar una versió nova (mantenidors)

`main` és el que reben els usuaris, des d'aquest marketplace i des del
directori de plugins, així que els canvis només hi arriben amb un pull request.

Cada plugin és a la seva carpeta (`usage/`, `e2e-progress/`), la que diu la
seva entrada a `.claude-plugin/marketplace.json`; un plugin nou s'hi afegeix.

1. En una branca, fes el canvi al plugin, dins de la seva carpeta, i passa'n
   els tests: `claude plugin test <plugin>`.
2. Puja la `version` de `<plugin>/.claude-plugin/plugin.json`: l'últim número
   per a un bugfix (0.6.4 → 0.6.5), el del mig per a una funcionalitat nova
   (0.6.x → 0.7.0). Claude Code només actualitza un plugin si la versió canvia.
3. Afegeix una secció `## <plugin> <versió>` al `CHANGELOG.md`. Si ha canviat
   el que fa el plugin, actualitza també `<plugin>/README.md`: només
   s'instal·la la carpeta del plugin, i per tant és el README que Claude Code
   mostra del plugin instal·lat.
4. Obre un pull request. El workflow `plugin` valida el marketplace i tots els
   plugins que llista (també amb les comprovacions del directori de plugins),
   en passa els tests i falla si un plugin ha canviat sense una versió nova i la
   seva entrada al CHANGELOG (un plugin nou només necessita l'entrada).
5. Fes-ne el merge. El workflow etiqueta cada versió nova
   `<plugin>--v<versió>`, i el directori de plugins l'agafa de `main` tot sol.

## Llicència

MIT, vegeu [LICENSE](LICENSE).
