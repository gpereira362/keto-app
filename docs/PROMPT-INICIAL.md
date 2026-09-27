# Mensaje para pegar en Claude Code

Abre esta carpeta en Claude Code y pega esto como primer mensaje:

---

Lee CLAUDE.md y docs/SPEC.md. Vamos a construir la app por hitos.

Hito 1: crea el proyecto (Vite + React + TypeScript + Tailwind + Vitest) sin tocar la carpeta data/. Implementa el motor en src/engine: body.ts, scaling.ts, plan.ts, progress.ts, substitutions.ts y shopping.ts. Usa los tipos de src/engine/types.ts y los JSON de data/. docs/reference_impl.py es la implementación de referencia: tradúcela a TypeScript. Escribe pruebas para:
- peso ideal con IMC 22 (165 cm → 60 kg), Devine y Robinson;
- escalado y redondeo de porciones (huevos enteros, gramos de 5 en 5, cucharadas de ½);
- que ningún día de las 14 semanas pase de 20 g de carbohidratos con pesos ideales de 40 a 150 kg, sin exclusiones y con cada alergia (huevo, lácteos, pescado, cerdo, mariscos);
- que con 60 kg los totales diarios coincidan con docs/tabla-60kg.json (±1 g);
- que las sustituciones coincidan con docs/golden-sustituciones.json;
- que las listas de compras coincidan con docs/golden-lista-compras.json;
- que un alimento con alergia nunca aparezca en el plan, las opciones de cambio ni la lista de compras;
- el ratio Dr. Boz y sus zonas.

Cuando las pruebas pasen, muéstrame un resumen y espera antes de empezar el hito 2.

---

Después sigue con los hitos 2 a 6 de docs/SPEC.md, uno por mensaje.
