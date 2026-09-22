# Selección OCR local — investigación, 2026-09-18

Estado: piloto aprobado e integrado en `lab`. ASOCIACIÓN V0 existe después del
OCR como capa separada; OCR sigue sin modificar geometría por sí mismo.
Rama `lab`, commit `a198d49`; cambios de diagnóstico anteriores conservados.
Documento de investigación histórica; el piloto posterior está integrado.
TEST-001 físico en iPhone localizó regiones pero falló transcripción manuscrita.
TEST-002 implementado, pendiente de prueba física: véase TEST_002.md. La
asociación posterior se documenta en ASSOCIATION_V0.md.

## Recomendación

Priorizar una evaluación aislada de PaddleOCR.js oficial con PP-OCRv6_tiny
(detección y reconocimiento), worker dedicado y ONNX Runtime Web/WASM CPU de
un hilo. Mantener Tesseract.js como referencia madura para impreso, no como
solución prometida para manuscrito. Esta selección es una recomendación para
una prueba de viabilidad, no una aprobación de dependencia ni calidad demostrada.
Si tiny pierde cotas, comparar small en el mismo ensayo antes de asumir que
preprocessing puede reparar un problema de reconocimiento.

El SDK oficial de PaddleOCR consultado declara 0.4.2, Apache-2.0 y dependencias
ONNX Runtime Web, OpenCV.js, clipper-lib y js-yaml. Es una incorporación relevante.
Su API devuelve líneas con `poly`, `text`, `score`; la orientación geométrica se
puede derivar del polígono, pero no equivale a conocer el sentido de lectura.
Su API pública documentada ejecuta detección + reconocimiento: pasar recortes
no implica que evitemos cargar o ejecutar el detector. Un camino recognition-only
requiere evaluación separada y no se presupone disponible.
Fuentes: [SDK](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/README.md),
[dependencias](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/package.json).

## Comparación

| Alternativa | Tecnología/licencia/estado | Posición, orientación y confianza | Impreso, texto corto, manuscrito y símbolos | Integración |
| --- | --- | --- | --- | --- |
| TextDetector nativo | API experimental; implementación del navegador/SO, sin librería redistribuida; borrador WICG, no estándar interoperable | Especifica rawValue, boundingBox y cornerPoints; sin score estándar | Depende del proveedor; no hay contrato portable de calidad para nuestros ejemplos | API sencilla si existe, pero no sirve de base para Chrome/Edge Android + Safari iOS |
| OCRad.js | GNU Ocrad compilado a JS con Emscripten, reglas de glifos, GPL-3.0; port antiguo, sin evidencia de mantenimiento móvil reciente | Texto por defecto; modo verbose devuelve cajas de bloques/letras y alternativas con confidence. Rotaciones explícitas, no orientación detectada fiable | Posible en impreso limpio; opción débil para cámara/manuscrito y símbolos. Poca evidencia para cotas breves | Arranque ligero y recortes fáciles, pero mayor trabajo para salida y calidad |
| Tesseract.js | Tesseract C++/LSTM → WASM + worker; Apache-2.0; repositorio actual 7.0.0, maduro | Cajas y confianza por palabra/símbolo; activar blocks explícitamente. Rotación/OSD disponible, con requisitos adicionales | Buena referencia para impreso; modos línea/palabra/carácter para texto corto. FAQ explícitamente no soporta manuscrito salvo parecido a imprenta. R/x/mm/puntuación dependen de modelo y calidad; Ø requiere verificar alfabeto, no basta whitelist | Menor dificultad: crops y parámetros existentes, caminos locales de assets |
| PaddleOCR.js + PP-OCRv6 tiny/small | Redes detector + reconocedor ONNX, runtime WASM/WebGPU y OpenCV.js; Apache-2.0, ORT MIT; SDK oficial joven sobre proyecto activo | Polígonos por línea + texto + score; ángulo derivable, dirección no garantizada | Mejor candidato a evaluar para fotos y escritura variable, no demostrado superior en TEST-001. Números cortos/aislados pueden escapar al detector. Diccionario v6 incluye 0–9, Ø, R, x, ×, punto, coma y m; pertenencia no demuestra reconocimiento | Media/alta por modelos, dos runtimes, workers, caché y límites de memoria |
| Reconocedor específico de cotas | CNN/CRNN/CTC pequeño propio → ONNX/WASM; ORT MIT, licencia de pesos/datos por definir; no existe modelo seleccionado | Caja del recorte como posición de región, no localización aprendida de cada carácter; logits/score posibles, orientación externa | Puede entrenarse para impreso/manuscrito y alfabeto exacto. Un clasificador MNIST de dígitos aislados no resuelve Ø10, decimales ni cifras unidas | Alta: dataset real, entrenamiento, evaluación y mantenimiento propios |

Fuentes:
[TextDetector](https://wicg.github.io/shape-detection-api/text.html),
[estado Chrome](https://developer.chrome.com/docs/capabilities/shape-detection),
[OCRad](https://github.com/antimatter15/ocrad.js),
[OCRad salida verbose](https://github.com/antimatter15/ocrad.js/blob/master/src/post.js),
[Tesseract API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md),
[Tesseract manuscrito](https://github.com/naptha/tesseract.js/blob/master/docs/faq.md),
[Tesseract tipos](https://github.com/naptha/tesseract.js/blob/master/src/index.d.ts),
[diccionario v6](https://github.com/PaddlePaddle/PaddleOCR/blob/main/ppocr/utils/dict/ppocrv6_dict.txt),
[licencia ORT](https://github.com/microsoft/onnxruntime/blob/main/LICENSE).

## Peso, móvil y offline

Cifras de archivos/modelos no equivalen a descarga comprimida ni memoria RAM.
Los presupuestos siguientes son estimaciones, no medidas del bundle de Napkin3D.

| Alternativa | Dependencia y modelos aproximados | Móvil y rendimiento esperado | Local/offline |
| --- | --- | --- | --- |
| Nativo | 0 MB de librería nuestra; recursos del SO de tamaño no controlado | Potencialmente eficiente; disponibilidad experimental no portable, Safari no es base viable | Dependiente de implementación/recursos; no garantiza nuestra cobertura |
| OCRad.js | Archivo JS del repo ~3.06 MB sin compresión, sin modelo separado | JS ejecutable en Chrome/Edge/Safari; sin certificación actual del port. Recortes baratos, calidad limitante | Sí, alojando/caché local |
| Tesseract.js | WASM LSTM SIMD observado ~2.73 MB; eng comprimido ~2.82 MB; JS/worker adicionales. Presupuesto orientativo 5–10 MB de assets para un idioma/configuración | WASM viable en Chrome/Edge Android y Safari iOS. Un worker reutilizado; esperar latencia perceptible en fotos y arranque frío | Sí; configurar worker/core/lang del mismo origen y cachearlos |
| PaddleOCR.js | Modelos publicados tiny: det 1.9 + rec 4.4 = 6.3 MB; small: 9.6 + 20.4 = 30 MB. No son el total ONNX web. ORT/OpenCV/JS pueden sumar decenas de MB; reserva orientativa 20–50 MB tiny, 45–80 MB small, a medir | Backend WASM soporta los navegadores objetivo; SDK/modelo completos aún deben probarse. Esperar segundos por foto como hipótesis, no promesa. CPU de un hilo como base; WebGPU opcional después | Sí; assets propios, ninguna llamada OCR a servidor. Caché explícita necesaria |
| Específico | Objetivo de diseño ~0.1–5 MB de pesos, no artefacto existente; más runtime de varios MB | Pocos recortes podrían ser rápidos; depende de red/operadores. ORT/WASM da cobertura potencial en los tres navegadores | Sí después de distribuir runtime y pesos; entrenar/curar datos tiene coste de desarrollo |

[WASM Tesseract](https://github.com/naptha/tesseract.js-core/blob/master/tesseract-core-simd-lstm.wasm),
[eng](https://github.com/naptha/tessdata/blob/gh-pages/4.0.0_best_int/eng.traineddata.gz),
[OCRad archivo](https://github.com/antimatter15/ocrad.js/blob/master/ocrad.js),
[modelos detector](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/OCR.html),
[modelos reconocedor](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/module_usage/text_recognition.en.md),
[compatibilidad ORT](https://onnxruntime.ai/docs/get-started/with-javascript/web.html).

No extrapolar benchmarks Python/GPU/escritorio a Safari. Presupuesto RAM distinto:
una foto 4000×3000 RGBA ya ocupa 48 MB por copia, más tensores y heap WASM.
Carga diferida al entrar en OCR, un worker, procesamiento secuencial y liberación
de crops. WASM multihilo requiere aislamiento; no proponer ahora cambios de
cabeceras/hosting. La disponibilidad de WebGPU del navegador no demuestra que
esta versión del SDK/modelo funcione allí.
[Configuración ORT](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html).

El SW actual solo cachea GET del mismo origen y no precachea modelos.
La descarga predeterminada desde CDN no satisface por sí sola el objetivo PWA.
Fijar versiones y alojar modelos, WASM y worker con la app; verificar primera
preparación online y posterior arranque frío offline. La caché puede ser evacuada
por el navegador. Cero tarifa de OCR, API/backend/keys: sí; CPU/batería y tráfico
de assets siguen existiendo y el hosting gratuito conserva sus límites.

## Arquitectura propuesta (no implementada)

Imagen decodificada/orientada → rama geométrica actual sin cambios.
En paralelo: preprocessing existente → propuestas de regiones → recortes del
original con margen → OCR local → detecciones y posiciones → diagnóstico.
Asociación dimensional posterior permanece fuera de este bloque y de la prueba.

Los componentes actuales sirven para proponer grupos de caracteres, no son
regiones de texto clasificadas. Conservar los pequeños: un punto/coma puede
ocupar menos de 4 píxeles. No eliminar automáticamente componentes pegados al
contorno, círculos, ni el número lejano. Agrupar para preservar `80 mm`/`Ø10`/
`10x20`; evitar reconocer cada mancha aisladamente. Usar el raster de 1000 px
para localizar, pero cortar desde el original para mantener detalle.
Comparar crops en color/gris y binarios: Otsu no es obligatoriamente la mejor
entrada para una red entrenada con fotografías. Recortar reduce píxeles pero
muchos recortes pueden costar más que una pasada global. Comparar ambas rutas
y medir cobertura; no aceptar el selector de componentes como filtro exclusivo.
No hay garantía de mejora de manuscrito por recortar o umbralizar.

## Coordenadas y contrato propuesto

Sistema canónico: píxeles de imagen original decodificada con orientación aplicada,
origen arriba izquierda, X derecha, Y abajo; no CSS ni milímetros. Registrar ID,
dimensiones y transformación desde el archivo si procede.

Guardar por detección: id, rawText, bbox, polygon opcional, angle opcional,
confidence opcional (con escala/nombre del motor), engine/modelVersion,
sourceRegionId, transformación crop→original. No convertir aún a medidas.
Separar siempre caja candidata de caja realmente devuelta por el OCR.

Sin rotación, si el crop empieza en (cx,cy) del raster, se amplía (ux,uy) y se
aplica padding (px,py) después de ampliar:

    Xoriginal = (cx + (Xocr - px) / ux) * originalWidth / rasterWidth
    Yoriginal = (cy + (Yocr - py) / uy) * originalHeight / rasterHeight

Con rotación, usar la inversa de la transformación completa (incluyendo expansión
del canvas), transformar las cuatro esquinas y conservar el polígono. Derivar
bbox de min/max, no transformar solo la esquina inicial. Mantener decimales;
unificar bounds inclusivos de componentes con bordes continuos de cajas OCR.
La transformación es trazable; la precisión del detector sigue siendo limitada.
Score no es probabilidad calibrada ni comparable directamente entre motores.

## TEST-001, después de aprobación

1. Anotar manualmente texto y polígonos reales de la foto patrón, sin asignar
   todavía ancho/alto/diámetro/grosor. El 5 lejano es solo una detección textual.
2. Incluir los ocho ejemplos: 80, 40, 5, 10, 80 mm, Ø10, R5, 10x20;
   variantes 10.5/10,5, giro, sombras, perspectiva, desenfoque y más de un autor.
   Separar impreso y manuscrito, y muestras de ajuste de muestras de evaluación.
3. Comparar pasada global y crops idénticos del original; primero reconocimiento
   con crops anotados (aislar OCR), luego propuestas automáticas (aislar detección).
4. Medir transcripción exacta, símbolos perdidos/confundidos, detecciones omitidas,
   falsos positivos en líneas/círculos, solapamiento de cajas y error de reproyección.
5. Registrar arranque frío/caliente, bytes transferidos, tiempo total y por etapa,
   fallos/memoria observable/UI en Android Chrome/Edge y Safari iPhone reales.
6. Verificar que ninguna foto sale por red, y recarga/inferencia en modo avión.
   Tests sintéticos solo para transformaciones/contrato, nunca prueba de OCR real.

Criterio mínimo del piloto: cada cota legible del caso patrón debe aparecer con
texto verificable y caja correspondiente, o quedar explícitamente como fallo;
ningún número inventado para completar el caso. No fijar umbrales de confianza
sin datos. No aceptar un acierto en TEST-001 como robustez general.

## Resultado del piloto

Se integró `@paddleocr/paddleocr-js` `0.4.2` con PP-OCRv6 tiny en un módulo
cargado dinámicamente solo después de seleccionar una fotografía. Los modelos
detector/reconocedor son los archivos oficiales locales `PP-OCRv6_tiny_det.tar`
y `PP-OCRv6_tiny_rec.tar`. ONNX Runtime Web `1.24.3` usa WASM local, incluido
el módulo JSEP que el navegador necesitó durante la prueba. El SDK devuelve
`items[]` con `poly`, `text` y `score`; Napkin3D deriva `bbox` y reproyecta
polígonos/cajas desde el canvas reducido a píxeles de la fotografía original.

La prueba sintética impresa en Chromium produjo detecciones reales con cajas y
pasó. El posterior TEST-001 físico falló transcripción manuscrita; no se declara
soporte manuscrito. El primer intento reveló y corrigió un asset JSEP ausente,
no un fallo de reconocimiento.

Assets locales añadidos: modelos 1,792,000 + 4,526,080 bytes; ORT WASM/JSEP y
módulos 12,361,745 + 25,014,754 + 24,274 + 46,595 bytes. `public/ocr/` suma
43,765,448 bytes y `dist/` queda en aproximadamente 88 MB; los chunks OCR generados incluyen ~11.3 MB de worker,
~10.5 MB de JS y un WASM JSEP de ~25 MB. Son pesos sin comprimir y no equivalen
a descarga gzip ni RAM. La build mantiene el aviso de chunks grandes y requiere
memoria de compilación elevada en este entorno.

## Decisión vigente

PaddleOCR.js 0.4.2 + PP-OCRv6 tiny se mantiene. La selección propuesta en la
investigación anterior ya fue resuelta. No cambiar motor, diccionario ni modelo.
ASOCIACIÓN V0 consume el OCR como input separado; no modifica reconocimiento,
diccionarios ni modelos.
