# TEST-002: calibración OCR por regiones

Implementado en `lab` como bloque histórico de calibración regional. Sus
variantes y su diagnóstico A/B siguen disponibles, pero la evidencia física
numérica posterior se registra en `TEST_003.md`. No hay modificación automática
de `Part` fuera de Asociación V0 ni cambio geométrico en TEST-002.

## Comparación reproducible

1. Seleccionar una foto en Proyecto Automático. El OCR BASELINE conserva la
   pasada global existente (canvas completo, lado máximo 1000 px, mínimo 8 por
   eje). PaddleOCR.js 0.4.2, PP-OCRv6 tiny, ORT 1.24.3, WASM CPU de un hilo,
   assets locales; `textRecScoreThresh: 0` conserva resultados de score bajo.
2. Abrir LAB · Diagnóstico temporal. Cuando termine el baseline, pulsar
   **Ejecutar TEST-002**. No se ejecuta el experimento por abrir el panel.
3. Para cada bbox devuelta por el baseline, recortar la imagen original
   decodificada. Margen por lado: max(8 px, ceil(25 % del lado menor de la bbox)).
   Redondeo hacia fuera y recorte a límites de imagen. No hay deskew ni
   rectificación. Se compone sobre blanco para imágenes transparentes.
4. Ejecutar secuencialmente las seis condiciones con un único worker regional;
   cada llamada es `PaddleOCR.predict(canvas, params)`, detección + reconocimiento.
   Se crea un worker nuevo para el experimento; su inicialización se mide aparte.

| Condición | Imagen | Parámetros predict |
| --- | --- | --- |
| original | crop color, resolución original | heredados |
| upscale | crop color ×2, interpolación Canvas high | heredados |
| grayscale/contrast | gris y estiramiento min/max | heredados |
| binary | gris, estiramiento, umbral fijo 128 | heredados |
| upscale/binary | ×2, después gris, estiramiento, umbral 128 | heredados |
| original/box-threshold | mismo crop original color | solo textDetBoxThresh: 0.3 |

Gris: round(0.299R + 0.587G + 0.114B). Contraste: escalar min/max a 0–255;
si todos los píxeles tienen igual gris, conservarlo. Binario: <128 negro,
resto blanco. No se adapta nada a los caracteres esperados.

El modelo local `PP-OCRv6_tiny_det.tar`, `inference.yml`, fija box_thresh=0.4,
thresh=0.2, unclip_ratio=1.4. La sexta condición baja únicamente box_thresh a
0.3 para evaluar cajas débiles frente a falsos positivos. Se compara con
`original`, nunca se confunde con una mejora debida al preprocessing.
Los demás parámetros siguen heredados del mismo SDK/modelo fijados; no se
modifican límites de tamaño ni diccionarios. La lista pública de parámetros
se verificó en el README y las declaraciones de tipos del SDK instalado.

## Contrato y diagnóstico

OCR BASELINE permanece en el JSON habitual `ocr`. TEST-002 tiene un JSON
separado en el mismo panel: status, coordinateSpace, association, regions y
timings. Cada región guarda la detección baseline completa, bbox del crop,
preview PNG, y todas las variantes, incluso fallos y listas sin detecciones.
Cada variante guarda nombre, overrides, tamaño de entrada, tiempos de
preprocessing/OCR/detector/recognizer y todos sus candidatos (texto bruto,
score interno, polígono, bbox, ID y clasificación). No hay ganador automático.

Reproyección: Xoriginal = crop.x + Xocr * crop.width / result.image.width;
análogo para Y. Se transforman todos los vértices y se calcula su bbox.
No se convierten píxeles a mm. El margen puede introducir texto vecino: todos
los candidatos permanecen visibles, sin atribución semántica a la región.

Clasificación independiente del score, sin modificar el texto:

- `dimension-compatible`: número con decimal opcional (punto/coma), prefijo
  Ø o R opcional, sufijo mm opcional; admite productos con x o × y espacios.
- `ambiguous`: vacío, expresión incompleta/malformada con caracteres del
  dominio, mezcla con dígitos o determinados glifos aislados confundibles
  (O/S/I/l/m). Por ejemplo `5O` queda igual, clasificado ambiguous.
- `non-dimension-compatible`: resto, por ejemplo `hello` o `y`.

Es una comprobación sintáctica conservadora, no validación de la cota ni
probabilidad de exactitud. Un número equivocado puede ser compatible.

Tiempos: baseline completo (incluye su inicialización), inicialización regional,
generación de crops (incluye preview), preprocessing, OCR de variantes,
regionsMs y totalMs = baselineMs + regionsMs. El total excluye la espera humana
antes de pulsar el botón y la decodificación inicial de la foto; regionsMs
incluye publicación del diagnóstico y liberación del worker. No mide RAM,
batería ni bytes de red. Repetir el botón conserva el mismo baseline y genera
una nueva ejecución regional; para repetir el baseline, seleccionar la foto
otra vez desde el flujo automático.

## Prueba física en iPhone (sin despliegue en este bloque)

1. Servir esta copia de `lab` con `npm run dev` y abrir en Safari del iPhone
   una URL HTTPS de puerto reenviado accesible. También puede usarse una URL
   LAB actualizada posteriormente mediante un despliegue autorizado: el LAB
   anterior no contiene TEST-002. Para galería puede usarse un host LAN accesible;
   para cámara utilizar contexto seguro. Registrar commit base y cambios locales,
   modelo de iPhone, versión iOS/Safari, tamaño de foto y condiciones de luz.
2. Usar la misma foto de TEST-001 si está disponible, después una nueva foto
   de la misma clase de dibujo manuscrito. Anotar por separado la transcripción
   verdadera de cada región antes de consultar resultados, sin asignar medidas.
3. Proyecto Automático → ELEGIR FOTO (o HACER FOTO) → LAB · Diagnóstico temporal.
   Registrar geometría observada y OCR BASELINE: texto, score, posición, tiempos
   y regiones ausentes. No dar por corregidos los falsos candidatos geométricos.
4. Pulsar Ejecutar TEST-002; esperar READY o registrar ERROR. Abrir cada REGIÓN
   OCR y comprobar que el crop contiene los caracteres completos. Revisar las
   cinco variantes y la sexta condición de parámetro, incluidas omisiones,
   símbolos y errores. Copiar ambos JSON completos y guardar capturas del panel.
5. Comparar transcripción exacta con las anotaciones; revisar bbox/polígonos
   originales. Distinguir efecto de crop, resolución, preprocessing y parámetro.
   Un score mayor o texto dimension-compatible no equivale a acierto.
6. Repetir tres veces para observar variación; distinguir primera carga de
   ejecuciones posteriores. Registrar tiempos, errores, respuesta de interfaz
   y cualquier cierre por memoria. No extrapolar Chromium de escritorio a Safari.
7. Resultado físico: objeto detectado + regiones localizadas + transcripción
   correcta + posición conservada. Registrar PASS/FAIL por región y evaluación
   global. Ninguna prueba automatizada autoriza declarar éxito manuscrito.

Limitaciones: solo se ensayan regiones que el baseline devuelve; no recupera
cotas completamente omitidas. Margen fijo, escalado ×2 y umbral fijo no garantizan
mejora con perspectiva, trazos pegados, sombras o desenfoque. Seis llamadas por
región pueden ser caras y los crops grandes requieren memoria. Sin límite de
regiones ni selección automática. Assets locales no demuestran arranque offline;
esa aceptación sigue pendiente. Sin foto manuscrita física disponible en este
entorno, no se puede evaluar la calidad real de TEST-002 aquí.
