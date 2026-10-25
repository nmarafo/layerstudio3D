# 🤖 Guía Operativa para Agentes IA — LayerStudio 3D (`v3.0.15` & `OKF v1.3.0`)

> **Manifiesto OKF**: [`okf.json`](file:///c:/Users/norbe/Documents/layerstudio3D/okf.json) · **Arquitectura**: [`okf/arquitectura_okf.md`](file:///c:/Users/norbe/Documents/layerstudio3D/okf/arquitectura_okf.md) · **Prompt Maestro**: [`okf/prompt_maestro_okf_layerstudio3d.md`](file:///c:/Users/norbe/Documents/layerstudio3D/okf/prompt_maestro_okf_layerstudio3d.md) · **JSON Schema**: [`schema/schema_layerstudio3d_project.json`](file:///c:/Users/norbe/Documents/layerstudio3D/schema/schema_layerstudio3d_project.json)

Cualquier agente de IA que opere o modifique **LayerStudio 3D** (`https://nmarafo.github.io/layerstudio3D/`) **DEBE** cumplir estrictamente las siguientes directrices operativas.

---

## 1. Compuerta Obligatoria de Previsualización del Proyecto (`.lasca`) antes de Exportar (`OKF-GATE-LASCA-PREVIEW-BEFORE-EXPORT`)

Cuando el usuario solicite crear un proyecto de laminado o **Puzzle 3D** y exportar sus archivos de fabricación (`.ZIP`, `.DXF`, `.SVG`, `.STL`), el agente **NUNCA debe exportar directamente los archivos finales sin ofrecer antes la previsualización del `.lasca`**:

1. **Paso 1 — Configurar y Generar primero el `.lasca`**:
   - Cargar el modelo 3D (`.STL` / `.GLB`), ejecutar la autoselección óptima de ejes (`autoSelectBestPuzzleAxes()`), verificar la orientación con `rotateBaseModel90('x' | 'y' | 'z')` si procede, mantener activo por defecto el modo de **Costilla Autosustentante (`puzzleSelfSupporting: true`)** y generar el archivo de proyecto **`.lasca`** (`exportProjectFile()`).
2. **Paso 2 — Preguntar explícitamente si desea previsualizar el `.lasca` antes de exportar**:
   - Entregar la ruta clicable del archivo `.lasca` generado junto con un resumen de la configuración (combinación de ejes e Índice Estructural, número de costillas por serie, modo autosustentante y dimensiones de tablero) y **preguntar a la persona usuaria**:
     > *«He generado primero el archivo de proyecto `.lasca` con la configuración propuesta. ¿Desea previsualizar el proyecto (`.lasca`) en LayerStudio 3D (`https://nmarafo.github.io/layerstudio3D/` → botón **📂 Abrir**) antes de que exporte los archivos definitivos de corte (`.ZIP` / `.DXF` / `.SVG` / `.STL`)?»*
3. **Paso 3 — Exportar tras la validación**:
   - Una vez que la persona usuaria confirme la previsualización (o indique expresamente que desea exportar directamente sin previsualizar), ejecutar `exportZipBatch()` (o el exportador solicitado).

---

## 2. Capacidades Clave de Puzzle 3D (`v3.0.15`) que el Agente Debe Tener en Cuenta

1. **Ejes de Cruce en 2 Ejes (`'xy'`, `'xz'`, `'yz'`) y 3 Ejes Simultáneos (`'xyz'`)**:
   - Función `autoSelectBestPuzzleAxes()` (botón **`🪄 Auto`**): evalúa matemáticamente `X×Y`, `X×Z` e `Y×Z` (`computePuzzleAxesCandidateScore`, 0..100 pts) evitando «peines rectangulares» sin silueta y voladizos de 1 sola ranura.
   - Modo **`X × Y × Z (3 Ejes)`** (`setPuzzleAxes('xyz')`): activa simultáneamente `Serie A (X)`, `Serie B (Y)` y `Serie C (Z · Plantas ⊞)` (`puzzleCountC`), aplicando protección automática anti-cizalladura para que ninguna costilla quede partida en dos por ranuras perpendiculares.
2. **Rotación Rápida de 90° del Modelo y las Costillas (`rotateBaseModel90('x' | 'y' | 'z')`)**:
   - Botones **`↻ X 90°`**, **`↻ Y 90°`** y **`↻ Z 90°`** en **1. Dimensiones** y en la cabecera de **Ejes de Cruce**.
3. **Costilla Autosustentante (`puzzleSelfSupporting: true` por defecto)**:
   - Las costillas seleccionadas (`puzzleSelfSupportTarget`: `'outer'`, `'series_b'`, `'series_a'`, `'all'`, `'custom'`) no bajan hasta el suelo y se sostienen solas mediante sus ranuras de unión (`puzzleSelfSupportStyle`: `'trim_union'`, `'arch'`, `'natural'`; `puzzleSelfSupportClearanceMM`: `22.0`; `puzzleDropUnconnectedIslands: true`).
4. **Sincronización de `indexstandalone.html`**:
   - Siempre que se modifique `index.html`, `css/styles.css` o cualquier archivo en `js/*.js`, regenerar `indexstandalone.html` para mantener la versión autónoma sincronizada al 100%.
