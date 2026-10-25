# LayerStudio 3D

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20App-0ea5e9.svg?logo=github)](https://nmarafo.github.io/layerstudio3D/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Three.js](https://img.shields.io/badge/Three.js-r128-black.svg?logo=three.js)](https://threejs.org/)

**LayerStudio 3D** es una aplicación web interactiva de laminado multicapa (**X / Y / Z**) diseñada para convertir modelos tridimensionales (`.STL`, `.GLB`, `.GLTF`) en secuencias de láminas («lascas») listas para **Corte Láser / CNC** (`.SVG` y `.DXF` a escala real `1:1` en milímetros) e **Impresión 3D** (`.STL` extruido por capa), incluyendo empaquetado automático en tableros (**Nesting 2D MaxRects**) y guías paso a paso de ensamblaje.

🌐 **Aplicación en vivo (GitHub Pages):** **[https://nmarafo.github.io/layerstudio3D/](https://nmarafo.github.io/layerstudio3D/)**

---

## ✨ Características Principales

### 1. Carga 3D, Dimensionamiento Dinámico (`mm`, `cm`, `m`) y Subdivisión Modular en Partes (Gran Formato)
- **Importación directa en navegador** de mallas `.STL`, `.GLB` y `.GLTF` (100 % en cliente, sin subir archivos a servidores externos), además de modelos paramétricos de prueba integrados (*Nudo Toroidal*, *Jarrón Hueco*, *Engranaje Mecánico* y *Cristal Facetado*).
- **Escalado proporcional o independiente** en los ejes **X, Y, Z** con entrada rápida de dimensiones máximas (`10cm`, `50cm`, `1m`, `2m`, `3m` o cualquier valor personalizado).
- **🧩 Subdivisión Modular 3D en Partes / Conjuntos (*Gran Formato*)**:
  - Permite dividir automáticamente cualquier modelo 3D en múltiples bloques o conjuntos encajables (**`A1, A2, B1, B2...`**) para construir figuras que superen el tamaño máximo del tablero o cama de corte: por ejemplo, con un tamaño máximo de tablero/parte de **`30 × 30 cm`**, permite fabricar una figura de **`60 × 60 cm`** uniendo **`2 × 2 = 4` conjuntos de `30 × 30 cm`**, de **`90 × 90 cm`** uniendo **`3 × 3 = 9` conjuntos**, o de **`120 × 120 cm`** uniendo **`4 × 4 = 16` conjuntos de `30 × 30 cm`** (`A1..D4`).
  - **Dos modos de partición**: **Por Tamaño Máximo de Parte / Tablero** (`15×15 cm`, `20×20 cm`, `30×30 cm`, `40×40 cm`, `60×40 cm` o sincronizado con el área útil del tablero `= Tablero`) con botones de escalado rápido a múltiplos exactos (**`2×2`**, **`3×3`**, **`4×4`**), o **Por Cuadrícula Fija (`Columnas × Filas`)**.
  - **Conectores mecánicos de unión 2D y trabado 3D**: Generación automática de juntas **Cola de Milano (`⏢` encaje mecánico)**, **Espiga Rectangular (`▭` alineación)** o **Corte Recto (`∣` a tope)** a lo largo de las líneas de partición, con opción de **alternar la fase en capas pares e impares** para trabar verticalmente los bloques y control deslizante **Separar Conjuntos 3D (`A1, A2...`)** en el visor 3D.
  - **Codificación y exportación por conjunto**: Cada sector se identifica y graba como `#1-A1`, `#1-A2`, `#1-B1`, `#1-B2`..., empaquetándose automáticamente en tableros anidados e incluyendo la carpeta `SVG_Conjuntos_Modulares/Conjunto_A1/...` en la exportación `.ZIP`.

### 2. Dos Sistemas Constructivos: Apilado (1 Eje) y Puzzle 3D Encajable sin Pegamento (2 Ejes)
- **🧱 Modo Apilado (1 Eje — X, Y o Z)**:
  - Corte planar exacto en cualquiera de los tres ejes cartesianos (**X**, **Y** o **Z**), por número de capas (`2` a `300+` lascas) o por grosor fijo de material.
- **🧩 Modo Puzzle 3D Encajable sin Pegamento (*Waffle / Interlocking Slot Grid*)**:
  - Genera simultáneamente dos series ortogonales de costillas (**Serie A `⊔` Base** y **Serie B `⊓` Cruce**) en cualquiera de los pares de ejes (**`X × Y`**, **`X × Z`** o **`Y × Z`**).
  - **Tallado booleano automático de ranuras a media madera (*Half-Lap Slots*)**: Calcula la intersección 3D exacta entre cada par de costillas perpendiculares y recorta ranuras complementarias de ancho igual al **espesor del material + holgura (*kerf*)**, dividiendo cada cruce a mitad de altura (`50 %` superior en Serie A `⊔` y `50 %` inferior en Serie B `⊓`) para montar el modelo por simple deslizamiento/presión sin necesidad de adhesivo (ideal para **poliexpan/EPS**, **cartón pluma/foamboard**, **MDF**, **contrachapado** o **metacrilato**).
- **Detección automática de contornos exteriores e interiores (huecos)** mediante orientación de área signada y regla par-impar.

### 3. Guías de Ensamblaje, Varillas de Alineación, Micro-uniones de Sujeción y Filtro de Islas
- **Guías de pegado multicapa (Modo Apilado)** y **Etiquetas de ranura `↳Y1 / ↳X1` (Modo Puzzle 3D)**:
  - **Guía de lámina superior (`#N+1`)** en capa naranja (`#ff8800`) y **Guía de lámina inferior (`#N-1`)** en capa violeta (`#9900ff`), recortadas al material sólido de cada isla.
  - En modo **Puzzle 3D**, señalización automática en el visor 2D y en la guía ilustrada de qué costilla transversal encaja en cada ranura (`↳Y1`, `↳Y2`, `↳X1`, etc.).
- **Perforaciones de varilla guía**: Inserción automática de 1 taladro central o 2 taladros simétricos con diámetro configurable en milímetros.
- **Micro-uniones de sujeción por presión (*Holding Tabs / Bridges*)**: Sistema configurable para dejar pequeños puentes sin cortar en el contorno (por ejemplo, `4 puntos` de `1.0 mm` por pieza o `1 punto` cada `X mm` de perímetro, tanto en exterior como opcionalmente en huecos interiores), manteniendo las piezas fijas al tablero durante el trabajo láser/CNC para desprenderlas limpiamente haciendo presión con los dedos.
- **Filtro inteligente de islas pequeñas**: Descarta automáticamente fragmentos o astillas sueltas inferiores a un umbral configurable (por dimensión máxima, lado menor o área en $\text{mm}^2$).

### 4. Distribución Automática en Tableros (Nesting 2D MaxRects)
- **Empaquetado multi-tablero** con dimensiones personalizables (ej. `30×20 cm`, `60×40 cm`, `90×60 cm`, `122×80 cm`), margen perimetral y separación entre piezas.
- **Optimización avanzada**:
  - Rotación automática de $90^\circ$ para maximizar el aprovechamiento del tablero.
  - Anidado de islas pequeñas dentro de los huecos interiores de piezas mayores.
  - Opción de recorte automático para piezas que excedan las dimensiones útiles del tablero.
- **Grabado inteligente en cada isla**: Inscripción automática del código de lámina/costilla (`#N`, `X1`, `Y1`) e indicador de serie o guía (`[Base]`, `[Cruce]`, `[Sup]`, `[Inf]`, `[Ambas]`), calculando geométricamente el mayor tamaño de fuente que cabe estrictamente dentro del material sólido sin invadir huecos ni ranuras.

### 5. Guía Ilustrada Vectorial Automática de Corte y Montaje (Sin IA)
- **Generación algorítmica de planos vectoriales SVG** a partir de los tableros anidados y vectores 2D:
  1. **Mapa Localizador en Tablero**: Resalta en verde dónde se ubica la pieza del paso actual dentro del tablero e indica si fue rotada $90^\circ$.
  2. **Plano de Encaje 2D a $0^\circ$**: Muestra la orientación real de montaje, las guías de pegado o las ranuras a media madera (`↳Y1`, `↳X1`) y los puntos de micro-unión.
  3. **Alzado Vertical de Apilado / Planta de Retícula Ortogonal**: Muestra el progreso vertical capa a capa (modo Apilado) o la planta de cruces `Serie A × Serie B` con los nudos de encaje sin pegamento (modo Puzzle 3D).
- **Exportación de la guía**: Impresión directa a **PDF**, descarga como documento autocontenido **`GUIA_ILUSTRADA_MONTAJE.html`** (incluido automáticamente dentro del `.ZIP`) y resumen en texto plano **`.TXT`**.

### 6. Vectorizador Automático 2D (`.PNG` / `.BMP` / `.JPG` → `.SVG` y `.DXF` de Corte y Grabado Láser + Relieve 3D)
- **Separación automática de Corte y Grabado**:
  - **Silueta de Corte Exterior (`#ff0000` Rojo — `CORTE_EXTERIOR`)** y **Huecos Pasantes (`#0055ff` Azul — `CORTE_INTERIOR_HUECOS`)** mediante detección automática de transparencia (canal alfa) o color de fondo en las esquinas, con **desplazamiento morfológico (*offset* en `mm`)** basado en campo de distancia 2D (*Chamfer Distance Transform*) para crear bordes tipo *sticker*/insignia y perforación opcional para llavero/colgante.
  - **Grabado Láser Interior (`#008800` Verde — `GRABADO_VECTORIAL` y `#ff8800` Naranja — `GRABADO_DETALLE_FINO`)**: Trazado sub-píxel mediante *Marching Squares*, umbral automático de **Otsu**, simplificación **Ramer-Douglas-Peucker**, suavizado de curvas **Chaikin**, detección de bordes internos **Sobel** y generador opcional de **trama de barrido vectorial (*Hatching*)**.
- **Descarga directa `.SVG` / `.DXF` o envío al espacio 3D**: Permite descargar al instante el `.SVG` o `.DXF` de corte y grabado a escala `1:1` en milímetros, enviarlo como pieza de 1 capa al visor 3D/Tablero, o **generar automáticamente un Relieve 3D Apilable Multicapa** por niveles de brillo.

### 7. Exportación Directa y por Lotes (`.ZIP`)
- **`.SVG` (Corte Láser)**: Escala `1:1` en milímetros, validado XML y organizado por capas semánticas.
- **`.DXF` (AutoCAD / CNC / Láser)**: Polilíneas, círculos y textos separados por capas y colores estándar CAD.
- **`.STL` (Impresión 3D)**: Mallas 3D extruidas individualmente por cada lasca o costilla.
- **`.LASCA` / `.JSON` (Compatible con OKF v1.3.0)**: Guardado y recuperación íntegra del estado del proyecto (incluyendo simplificación de líneas de corte en Puzzle 3D, desplazamiento y visibilidad individual de costillas, micro-uniones y recetas OKF).

### 8. Grabado de Imagen por Lámina, Simplificación de Corte en Puzzle 3D e Interfaz por Pestañas (`v3.0.6`)
- **Grabado Láser de Imagen en Lámina Seleccionada (`🖼️ Grabar Imagen`)**: Permite cargar cualquier imagen (`.PNG`, `.BMP`, `.JPG`, `.WEBP`) sobre la lámina o costilla activa con recorte automático al contorno exterior y a las ranuras de encaje a 90° del Puzzle 3D.
- **Simplificación de Línea de Corte en Puzzle 3D (`✂️ Simplificar línea de corte`)**: Modos Poligonal Directo (`RDP`), Curva Suave (`Chaikin`), Puente de Concavidades (`Bridge`) y Envolvente Exterior (`Convex`), aplicados antes del tallado de ranuras para mantener intacto el encaje ortogonal.
- **Movimiento y Visibilidad Individual de Costillas**: Desplazamiento independiente de la costilla seleccionada a lo largo de su eje con recálculo automático de cruces, y botones para ocultar/mostrar ejes o costillas en el visor 3D.
- **Flujo de Trabajo por Pestañas (`1. Corte` · `2. Limpieza` · `3. Acabado` · `4. Tableros` · `Ver Todo`)**: Tarjetas plegables y revelación progresiva de controles para una interfaz limpia sin perder ninguna función.

---

## 🤖 Estándar OKF (Open Knowledge Framework) para Agentes de IA

Este repositorio incluye una especificación completa **OKF v1.3.0** (`urn:okf:software:layerstudio3d:2026:v3.0.6`) diseñada para que cualquier **Agente de Inteligencia Artificial** (agentes de automatización de navegador DOM/Playwright, asistentes de código o LLMs en NotebookLM, Claude, Gemini o ChatGPT) sepa operar **LayerStudio 3D** de forma autónoma:

| Archivo OKF | Propósito |
| :--- | :--- |
| [`okf.json`](okf.json) | Manifiesto raíz legible por máquina con metadatos, mapa de pestañas de la interfaz (`#sidebarTabNav`), catálogo de funciones globales JS (`programmaticApiCatalog`) y estándar cromático láser. |
| [`okf/arquitectura_okf.md`](okf/arquitectura_okf.md) | Manual técnico y operativo para agentes de IA: pipeline geométrico en `mermaid`, selectores DOM (`#...`), API programática y *playbooks* paso a paso. |
| [`okf/prompt_maestro_okf_layerstudio3d.md`](okf/prompt_maestro_okf_layerstudio3d.md) | *System Prompt* listo para copiar y pegar en cualquier LLM o proyecto RAG para diseñar recetas de corte láser y operar LayerStudio 3D. |
| [`schema/schema_layerstudio3d_project.json`](schema/schema_layerstudio3d_project.json) | Esquema formal JSON Schema (Draft 2020-12) para validar archivos `.lasca` y configuraciones ejecutables mediante `window.applyOkfProjectConfig(data)`. |

---

## 🚀 Uso Rápido

1. Abran la aplicación directamente en **[https://nmarafo.github.io/layerstudio3D/](https://nmarafo.github.io/layerstudio3D/)** (servida desde la arquitectura modular optimizada) o la edición monolítica de archivo único en **[https://nmarafo.github.io/layerstudio3D/indexstandalone.html](https://nmarafo.github.io/layerstudio3D/indexstandalone.html)**.
2. Carguen un modelo `.STL` / `.GLB`, seleccionen uno de los modelos de demostración en la barra superior, o pulsen **🖼️ PNG/BMP → SVG** para convertir cualquier imagen 2D en vectores de corte y grabado láser.
3. Ajusten las dimensiones de la pieza, el sistema constructivo (**Apilado 1 Eje** o **Puzzle 3D Encajable**) y el grosor del material o número de capas.
4. *(Opcional)* Activen **4. Tableros (Nesting)** para empaquetar todas las piezas en tableros de corte o Plancha Madre y consulten la **🛠️ Guía Ilustrada**.
5. Descarguen la lasca/tablero actual en `.SVG`, `.DXF` o `.STL`, o pulsen **Exportar .ZIP** para descargar el paquete completo de fabricación junto con la guía ilustrada `.HTML` y `.TXT`.

---

## 📁 Arquitectura y Estructura del Repositorio

El repositorio ofrece dos modalidades sincronizadas:
- **Versión Modular Optimizada (GitHub Pages)**: Dividida en hojas de estilo y módulos lógicos con carga diferida (`defer`) y pre-conexión CDN para un mantenimiento limpio y máximo rendimiento en navegador.
- **Versión Monolítica Autónoma (`indexstandalone.html`)**: Un único archivo HTML autocontenido ideal para compartir o ejecutar localmente sin servidor.

```text
layerstudio3D/
├── index.html                  # Punto de entrada principal (versión modular optimizada para GitHub Pages)
├── indexstandalone.html        # Versión monolítica autocontenida en un único archivo HTML
├── okf.json                    # Manifiesto raíz Open Knowledge Framework (OKF v1.3.0) para Agentes de IA
├── okf/
│   ├── arquitectura_okf.md     # Manual operativo, selectores DOM, API JS y playbooks para Agentes de IA
│   └── prompt_maestro_okf_layerstudio3d.md # System Prompt oficial para LLMs y asistentes autónomos
├── schema/
│   └── schema_layerstudio3d_project.json   # JSON Schema para archivos .lasca y recetas OKF
├── css/
│   └── styles.css              # Estilos personalizados, temas oscuros, barras de desplazamiento e impresión
├── js/
│   ├── state.js                # Estado global reactivo y referencias de escena Three.js
│   ├── viewer3d.js             # Motor 3D, cámara orbital, cargadores STL/GLB/GLTF y modelos paramétricos
│   ├── slicer.js               # Motor geométrico de corte planar X/Y/Z, Puzzle 3D, simplificación y grabado por lámina
│   ├── nesting.js              # Empaquetado 2D multi-tablero, anidado en huecos y Plancha Madre
│   ├── modals-guide.js         # Modal de tablero individual y guía interactiva de corte y montaje (#1 -> #N)
│   ├── viewer2d.js             # Inspector 2D interactivo en Canvas, zoom/pan, selección de islas y galería
│   ├── exporters.js            # Exportadores 1:1 (.SVG, .DXF, .STL, .ZIP) y API OKF (.lasca / applyOkfProjectConfig)
│   └── vectorizer2d.js         # Vectorizador automático PNG/BMP a SVG/DXF de corte y grabado láser + relieve 3D
├── LICENSE                     # Licencia GNU AGPL-3.0 con cláusula de atribución (Sección 7b)
├── README.md                   # Documentación técnica y guía de uso
├── .nojekyll                   # Configuración de servicio directo en GitHub Pages
└── .github/
    └── workflows/
        └── deploy-pages.yml    # Flujo de despliegue automatizado en GitHub Pages
```

---

## ⚠️ Descargo de Responsabilidad / Disclaimer

> [!IMPORTANT]
> **Descargo de Responsabilidad (Español):**  
> El presente software se distribuye «tal cual» (*"AS IS"*), sin garantías de ningún tipo, expresas ni implícitas, incluyendo, entre otras, las garantías de comerciabilidad, idoneidad para un propósito particular e incumplimiento. En ningún caso el autor o los titulares de los derechos de autor serán responsables de ninguna reclamación, daño, pérdida de material, error dimensional de corte/impresión o cualquier otra responsabilidad derivada del uso de este software en equipos de corte láser, máquinas CNC o impresoras 3D. Se recomienda verificar siempre las cotas, escalas y parámetros de potencia/velocidad en el software de control de la máquina antes de iniciar el trabajo físico.

---

## 👤 Autoría, Créditos y Redes Sociales

- **Autor**: **Norberto Martín Afonso** ([normaafo@gmail.com](mailto:normaafo@gmail.com))
- **Repositorio oficial**: [https://github.com/nmarafo/layerstudio3D](https://github.com/nmarafo/layerstudio3D)
- **Aplicación en GitHub Pages**: [https://nmarafo.github.io/layerstudio3D/](https://nmarafo.github.io/layerstudio3D/)
- **Sígueme en mis redes sociales**:
  - 🐦 **X (Twitter)**: [@NorbertoMartnAf](https://x.com/NorbertoMartnAf)
  - 💼 **GitHub**: [@nmarafo](https://github.com/nmarafo)
  - 🤗 **Hugging Face**: [@nmarafo](https://huggingface.co/nmarafo)
  - 📸 **Instagram**: [@nmar_afo](https://instagram.com/nmar_afo)

---

## 📄 Licencia y Cláusula de Atribución Obligatoria

Este proyecto se distribuye bajo los términos de la licencia **GNU Affero General Public License v3.0 (AGPL-3.0-or-later)** con preservación obligatoria de atribución de autoría conforme a la **Sección 7(b)**.

### Cláusula de Atribución Obligatoria (Sección 7b AGPL-3.0)

Conforme a la Sección 7(b) de la licencia GNU Affero General Public License v3.0, cualquier redistribución, modificación, obra derivada, adaptación o integración de este software en otros sistemas o plataformas debe preservar de forma visible el aviso de copyright original y la atribución expresa a su autor en el código fuente, en la documentación y en la interfaz de usuario:

> *Basado en [LayerStudio 3D](https://github.com/nmarafo/layerstudio3D), creado por **Norberto Martín Afonso** (`normaafo@gmail.com`), distribuido bajo licencia GNU Affero General Public License v3.0 (AGPL-3.0-or-later).*

Consulten el archivo [LICENSE](LICENSE) para conocer el texto legal completo de la licencia.
