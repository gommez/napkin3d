# TEST-003 — handwritten numeric dimensions

Estado: **PASS limitado** para reconocimiento numérico manuscrito básico en las
pruebas físicas registradas en iPhone. No es una prueba de reconocimiento
universal ni de geometría arbitraria.

## Casos físicos registrados

Se procesaron dos fotografías de dibujos manuales sobre papel:

- caso 1: anotaciones `50` y `30` alrededor del rectángulo;
- caso 2: anotaciones `27` y `82` en una fotografía con orientación diferente.

En ambos casos se conservaron las regiones y posiciones respecto a la imagen y
se obtuvieron correctamente los grupos numéricos manuscritos necesarios para
alimentar Asociación V0.

Los valores no están hardcodeados en el producto y no son fixtures de
reconocimiento.

## Alcance del PASS

- PASS para números manuscritos simples en esos dos dibujos físicos.
- PASS para consumir sus posiciones en el flujo existente de asociación cuando
  las anotaciones resultan utilizables.

## Fuera de alcance

- no demuestra reconocimiento universal de escritura;
- no valida `Ø`, `R`, grados, `x`, `×`, `mm` ni otros símbolos técnicos;
- no valida decimales manuscritos;
- no valida contornos cerrados arbitrarios, agujeros nuevos ni otras formas;
- no convierte una prueba física en una condición especial del producto.

## Relación con PREPROCESSING V1

TEST-003 valida OCR/asociación en dos fotografías. PREPROCESSING V1 mantiene
ese pipeline separado: la imagen original y el OCR no se sustituyen por el
mapa geométrico normalizado. La nueva prueba física para sombras y falsos
candidatos geométricos queda pendiente después de este bloque.

## Próxima acción

Repetir en iPhone con iluminación desigual y registrar por separado OCR,
InkMap A/B, componentes, propuesta exterior y candidatos interiores. No
declarar ClosedContour V0 ni reconocimiento técnico ampliado a partir de este
resultado.
