# Keto Continuum App — instrucciones para Claude Code

App personal para seguir el programa Keto Continuum (12 pasos) de Dr. Boz en un plan de 14 semanas. A partir de la estatura y el peso ideal genera el plan de comidas de cada día, con gramos de proteína, grasa y carbohidratos por comida. Además:
- sustituye ingredientes por falta en la tienda, gusto o alergia, con la cantidad equivalente;
- arma la lista de supermercado de cada semana;
- registra las mediciones: cetonas, glucosa y ratio Dr. Boz.

Lee `docs/SPEC.md` antes de escribir código. Es la fuente de verdad del producto.
`docs/reference_impl.py` es la implementación de referencia del motor. Si hay duda sobre un cálculo, córrela (`python3 docs/reference_impl.py`) y compara.

## Stack
- React 18 + TypeScript + Vite
- Tailwind CSS para estilos
- Estado local: Zustand, con persistencia en IndexedDB (Dexie)
- PWA instalable en el celular (vite-plugin-pwa), funciona sin conexión
- Pruebas: Vitest para el motor y Playwright para 2–3 flujos principales
- Sin backend en la v1. Todos los datos viven en el dispositivo.

## Estructura
```
data/                 JSON del programa (no editar a mano sin correr las pruebas)
  foods.json          alimentos con macros por unidad
  meals.json          comidas = lista de alimentos + cantidades base (persona de 60 kg de peso ideal)
  program-weeks.json  14 semanas: reglas, horario y comidas de cada día
  continuum-steps.json los 12 pasos del continuum
  substitution-groups.json grupos de equivalencia para sustituir ingredientes
docs/golden-*.json    resultados esperados (plan 60 kg, sustituciones, listas de compras)
src/engine/           lógica pura, sin React (100 % testeable)
  types.ts            tipos del dominio (ya creado)
  body.ts             peso ideal, metas de proteína
  scaling.ts          escalar comidas y redondear porciones
  plan.ts             generar el plan diario/semanal para un perfil
  progress.ts         criterios para avanzar, ratio Dr. Boz
  substitutions.ts    exclusiones, opciones equivalentes, completar grasa
  shopping.ts         lista de compras semanal
src/features/         pantallas (onboarding, hoy, semana, cambiar-ingrediente, exclusiones, lista-compras, registro, progreso, mapa, alimentos, ajustes)
src/store/            Zustand + Dexie
```

## Reglas del dominio (no romper)
1. Ningún día del plan puede superar **20 g de carbohidratos totales** para ningún peso ideal entre 40 y 150 kg. Debe haber una prueba que lo verifique.
2. La proteína se calcula sobre el **peso ideal**, no el peso actual.
3. Verduras, condimentos y la crema del café **no se escalan** (`scalable: false`).
4. Las porciones se redondean al `roundStep` de cada alimento (huevos enteros, gramos de 5 en 5, cucharadas de ½ en ½).
5. Los macros mostrados se calculan con las cantidades **ya redondeadas**.
6. Las semanas de ayuno (12–14) siempre muestran la advertencia médica, y el usuario debe confirmarla antes de marcar el ayuno como iniciado.
7. La app nunca avanza de semana sola. Sugiere avanzar cuando se cumple el criterio, y el usuario decide.
8. Un alimento con **alergia** no aparece en ningún lugar: plan, opciones de cambio ni lista de compras. Los alérgenos se leen de `foods.json` (`allergens`), también en alimentos compuestos (la mayonesa lleva huevo).
9. Una sustitución nunca puede hacer que el día pase de 20 g de carbohidratos. Las exclusiones se aplican con el presupuesto de todo el día, no comida por comida.
10. Si el sustituto es más magro (le faltan más de 5 g de grasa), se completa con la grasa del orden `__fat_topup_order`.
11. La lista de compras siempre se calcula desde el plan ya sustituido. No hay dos fuentes de verdad.

## Comandos
- `npm run dev` · `npm test` · `npm run build` · `npm run e2e`

## Estilo
- Interfaz en español.
- Funciones del motor puras y pequeñas, con pruebas junto al archivo (`*.test.ts`).
- Nada de dependencias pesadas para cosas simples.
