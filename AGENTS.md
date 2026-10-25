# 🤖 Guía Operativa para Agentes IA — LayerStudio 3D (`v3.0.15` & `OKF v1.3.0`)

> **Manifiesto OKF**: [`okf.json`](file:///c:/Users/norbe/Documents/layerstudio3D/okf.json) · **Arquitectura**: [`okf/arquitectura_okf.md`](file:///c:/Users/norbe/Documents/layerstudio3D/okf/arquitectura_okf.md) · **Prompt Maestro**: [`okf/prompt_maestro_okf_layerstudio3d.md`](file:///c:/Users/norbe/Documents/layerstudio3D/okf/prompt_maestro_okf_layerstudio3d.md) · **JSON Schema**: [`schema/schema_layerstudio3d_project.json`](file:///c:/Users/norbe/Documents/layerstudio3D/schema/schema_layerstudio3d_project.json)

Cualquier agente de IA que opere o modifique **LayerStudio 3D** (`https://nmarafo.github.io/layerstudio3D/`) **DEBE** cumplir estrictamente las siguientes directrices operativas.

---

## 1. Compuerta Obligatoria de Previsualización (`.lasca`) y Grabado en Lascas de Inicio y Fin de Cada Eje antes de Exportar (`OKF-GATE-LASCA-PREVIEW-AND-END-RIBS-ENGRAVING`)

Cuando el usuario solicite crear un proyecto de laminado o **Puzzle 3D** y exportar sus archivos de fabricación (`.ZIP`, `.DXF`, `.SVG`, `.STL`), el agente **NUNCA debe exportar directamente los archivos finales sin cumplir antes estos pasos**:

1. **Paso 1 — Configurar y Generar primero el `.lasca`**:
   - Cargar el modelo 3D (`.STL` / `.GLB`), configurar en modo **Puzzle 3D** por defecto los **3 ejes simultáneos (`puzzleAxes: 'xyz'`)**, el estándar de corte y tablero de **`30 × 25 cm` (`300 × 250 mm`)** y el modo de **Costilla Autosustentante (`puzzleSelfSupporting: true`)**, y generar el archivo de proyecto **`.lasca`** (`exportProjectFile()`).
2. **Paso 2 — Mostrar el `.lasca`, ofrecer previsualización y preguntar si desea grabar alguna imagen en las lascas de inicio y fin de cada eje**:
   - Entregar la ruta clicable del archivo `.lasca` generado junto con el resumen de configuración y **preguntar explícitamente a la persona usuaria**:
     1. **¿Desea previsualizar el proyecto (`.lasca`) en LayerStudio 3D (`https://nmarafo.github.io/layerstudio3D/` → botón `📂 Abrir`)?**
     2. **En modo Puzzle 3D: ¿Desea grabar alguna imagen en las lascas de inicio y fin de cada eje (primera y última costilla de cada eje: `X1`/`XN`, `Y1`/`YM`, `Z1`/`ZK`) antes de exportar?** (mediante `applyEngravingToPuzzleEndRibs()` o subiendo una imagen PNG/BMP/JPG que se recorta automáticamente al contorno y a las ranuras a 90°).
3. **Paso 3 — Exportar tras la validación**:
   - Una vez que la persona usuaria confirme la previsualización del `.lasca` y si desea o no añadir el grabado en las lascas de inicio y fin de cada eje, ejecutar `exportZipBatch()` (o el exportador solicitado).

---

## 2. Capacidades Clave de Puzzle 3D (`v3.0.15`) que el Agente Debe Tener en Cuenta

1. **3 Ejes Simultáneos por Defecto (`'xyz'`) y Estándar de Corte `30 × 25 cm` (`300 × 250 mm`)**:
   - En modo **Puzzle 3D (`'puzzle3d'`)** se utilizan **por defecto los 3 ejes simultáneos (`puzzleAxes: 'xyz'`)** (`Serie A = X`, `Serie B = Y`, `Serie C = Z`) y el tamaño estándar de corte de **`30 × 25 cm` (`300 × 250 mm`)** tanto en tablero (`boardWidthMM: 300`, `boardHeightMM: 250`, `setBoardPresetMM(300, 250)`) como en ajuste rápido de pieza (`setMaxFootprintMM(300, 250)`).
   - Función `autoSelectBestPuzzleAxes()` (botón **`🪄 Auto`**): evalúa matemáticamente `X×Y`, `X×Z` e `Y×Z` (`computePuzzleAxesCandidateScore`, 0..100 pts) evitando «peines rectangulares» sin silueta y voladizos de 1 sola ranura.
   - Modo **`X × Y × Z (3 Ejes)`** (`setPuzzleAxes('xyz')`): activa simultáneamente `Serie A (X)`, `Serie B (Y)` y `Serie C (Z · Plantas ⊞)` (`puzzleCountC`), aplicando protección automática anti-cizalladura para que ninguna costilla quede partida en dos por ranuras perpendiculares.
2. **Rotación Rápida de 90° del Modelo y las Costillas (`rotateBaseModel90('x' | 'y' | 'z')`)**:
   - Botones **`↻ X 90°`**, **`↻ Y 90°`** y **`↻ Z 90°`** en **1. Dimensiones** y en la cabecera de **Ejes de Cruce**.
3. **Costilla Autosustentante (`puzzleSelfSupporting: true` por defecto)**:
   - Las costillas seleccionadas (`puzzleSelfSupportTarget`: `'outer'`, `'series_b'`, `'series_a'`, `'all'`, `'custom'`) no bajan hasta el suelo y se sostienen solas mediante sus ranuras de unión (`puzzleSelfSupportStyle`: `'trim_union'`, `'arch'`, `'natural'`; `puzzleSelfSupportClearanceMM`: `22.0`; `puzzleDropUnconnectedIslands: true`).
4. **Sincronización de `indexstandalone.html`**:
   - Siempre que se modifique `index.html`, `css/styles.css` o cualquier archivo en `js/*.js`, regenerar `indexstandalone.html` para mantener la versión autónoma sincronizada al 100%.
