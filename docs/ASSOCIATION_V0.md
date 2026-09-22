# ASOCIACIÓN V0: interpretación geométrica de cotas

Estado: implementado en `lab` para el primer caso funcional validable:
contorno rectangular exterior + cotas lineales de ancho/alto. No reconoce nuevas
formas y no convierte la arquitectura en soporte real de geometría arbitraria.

## Dirección

```text
Image
→ detected geometry/features
→ OCR annotations
→ evidence-based association
→ resolved geometric constraints
→ parametric model
```

Principio: las cotas explícitas prevalecen sobre las proporciones del croquis.
La geometría dibujada identifica entidades y relaciones espaciales; no sustituye
silenciosamente una cota correctamente interpretada.

## Modelo transitorio

`src/association.ts` introduce estructuras puras, no persistidas:

- `GeometryFeature`: propiedad medible de una entidad detectada. Hoy el adaptador
  crea `outer-width`, `outer-height` y features de diámetro para agujeros ya
  detectados, aunque solo ancho/alto se resuelven funcionalmente.
- `Annotation`: OCR bruto con `rawText`, bbox, polígono, score y clasificación
  sintáctica. El texto nunca se corrige ni se reemplaza.
- `AssociationCandidate`: relación posible entre una anotación y una feature,
  con valor en mm cuando el texto puede parsearse como cota lineal soportada.
- `Evidence`: señales independientes semánticas, espaciales, geométricas y OCR.
- `AssociationHypothesis`: resolución por feature.
- `AssociationResult`: features, anotaciones, candidatos, hipótesis y dimensiones
  resueltas con trazabilidad.

Los resultados de dimensiones conservan:

```text
valueMm
origin: EXPLICIT | DERIVED | USER_CONFIRMED
state: AUTO_ASSIGNED | NEEDS_CONFIRMATION | UNRESOLVED
featureId
annotationId
rawText
evidences
```

No hay cambio de schema persistido. `Part` sigue siendo el modelo paramétrico
persistente; la asociación es diagnóstico y preparación antes de crear el `Part`.

## Evidencias

Semántica: un número simple (`50`, `25.5`, `12,7`, `50 mm`) puede asociarse a
una cota lineal. `Ø10` y `R5` se clasifican como futuras cotas de diámetro/radio,
pero este bloque no las asigna a geometría.

Espacial: para el adaptador rectangular actual, una anotación encima/debajo del
contorno es evidencia para una feature horizontal; izquierda/derecha, para una
feature vertical. Las distancias se normalizan por el tamaño relativo de la
feature, no por una resolución concreta de cámara.

Geometría: cuando hay ancho y alto explícitos, la proporción del croquis se usa
solo como `supporting`, `neutral` o `conflicting`. Una discrepancia grande marca
la hipótesis como `NEEDS_CONFIRMATION`; nunca reescribe el valor OCR.

OCR: el score bruto puede marcarse como `accepted` o `low-score`, pero no decide
por sí solo una asociación.

## Resolución

`AUTO_ASSIGNED`: una sola anotación por feature tiene compatibilidad semántica,
relación espacial y no hay conflicto material.

`NEEDS_CONFIRMATION`: hay hipótesis razonable, pero compite con otra anotación o
la coherencia geométrica es fuertemente contradictoria.

`UNRESOLVED`: no hay evidencia suficiente para asignar una anotación a la feature.

Si solo hay una dimensión explícita, la otra puede quedar como `DERIVED` desde la
proporción del contorno y se muestra como tal. Si ambas dimensiones son explícitas,
se usan como restricciones independientes; no existe una escala global única que
pueda transformar `30` en `33.2`.

## Alcance real actual

Soportado hoy:

- contorno rectangular exterior detectado por el scanner existente;
- anotaciones OCR ya devueltas por PaddleOCR baseline;
- cotas lineales simples de ancho y alto del contorno exterior;
- diagnóstico legible y JSON de candidatos/evidencias;
- creación de `Part` con ancho/alto explícitos cuando ambas cotas son
  `AUTO_ASSIGNED` y el grosor está confirmado.

Arquitectura preparada para recibir después:

- `circleDiameter`;
- `circleRadius`;
- `segmentLength`;
- `polygonEdge`;
- `distanceBetweenFeatures`;
- `arbitraryContourDimension`.

No soportado hoy:

- reconocimiento automático nuevo de círculos, triángulos, polígonos o contornos
  arbitrarios;
- asociación funcional de diámetro/radio;
- lectura de ángulos;
- confirmación táctil avanzada;
- corrección automática de OCR;
- decisión de medidas inciertas sin intervención.
