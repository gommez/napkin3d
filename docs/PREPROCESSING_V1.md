# PREPROCESSING V1 — normalización de iluminación para geometría

Estado: implementado en `lab` como comparación diagnóstica A/B. ClosedContour
V0 todavía no está implementado.

## Separación de pipelines

```text
ORIGINAL ──→ OCR baseline/técnico existente
       └──→ Preprocessing geométrico A/B ──→ componentes/propuestas actuales
```

La representación original permanece intacta. OCR no consume el `InkMap` V1 y
el detector geométrico funcional sigue usando A durante esta validación.

## InkMap

`src/geometryPreprocessing.ts` produce dos mapas genéricos, independientes de la
forma que se vaya a reconocer:

- A (`baseline`): luminancia 0.299/0.587/0.114, stretch min/max y Otsu global;
- B (`v1`): luminancia, fondo local estimado con blur de caja separable, resta
  de iluminación alrededor de un nivel neutro, ganancia de contraste fija,
  Otsu sobre la señal corregida con límites conservadores y binarización.

El radio del fondo es relativo al lado menor de la imagen y está acotado para
evitar costes desproporcionados. El algoritmo no aplica apertura/cierre
morfológico destructivo. Los componentes pequeños se conservan en el
diagnóstico y solo el detector heredado aplica su umbral funcional de cuatro
píxeles.

Cada mapa conserva ancho, alto, canales intermedios, binario, parámetros y
tiempo. `InkMap` no conoce rectángulos, círculos ni agujeros; puede alimentar
adaptadores futuros para segmentos, polígonos, curvas o siluetas.

## Comparación y límites

El diagnóstico muestra mapas, componentes A/B, propuestas geométricas y
métricas de foreground, componentes, componentes pequeños, componente mayor y
tiempos. B no se presenta como verdad geométrica todavía. La normalización
reduce gradientes suaves en fixtures sintéticos, pero su eficacia física con
sombras, textura, perspectiva y desenfoque debe medirse en iPhone.

No se añade dependencia: la implementación usa `Uint8Array`, `ImageData` y
operaciones deterministas de TypeScript. OpenCV.js sigue reservado al pipeline
OCR existente.

## Dirección ClosedContour V0

El siguiente detector debe consumir evidencia de un contorno interior cerrado,
contenido por el contorno exterior y geométricamente plausible antes de
proponer un agujero. Un componente oscuro aislado no será suficiente.
