# Keto Continuum App

Plan de 14 semanas del Keto Continuum de Dr. Boz, ajustado a tu estatura y peso ideal, con sustitución de ingredientes (falta en la tienda, gusto o alergia) y lista de supermercado semanal. App personal para el celular (PWA), sin cuenta ni servidor: todo vive en el dispositivo.

## Uso

```bash
npm install
npm run dev        # desarrollo en http://localhost:5173
npm test           # pruebas del motor y del estado (Vitest)
npm run e2e        # 3 flujos completos con Playwright sobre la app compilada
npm run build      # compila la PWA en dist/
npm run preview    # sirve dist/ para probarla
```

`npm run e2e` usa el Microsoft Edge instalado en Windows. En otro sistema: `npx playwright install chromium` y quitar `channel` en `playwright.config.ts`.

Para instalarla en el celular: publica `dist/` en cualquier hosting estático con HTTPS, ábrela en el navegador del teléfono y elige "Agregar a la pantalla de inicio". Después de la primera carga funciona sin conexión.

## Pantallas

Hoy · Semana · Compras · Registro (día y progreso) · Más → Mapa, Alimentos, Mis exclusiones y Ajustes (perfil, unidades, tamaños de paquete, exportar/importar JSON, borrar datos, aviso médico).

## Contenido

- `CLAUDE.md` — instrucciones permanentes para Claude Code (stack, estructura, reglas del dominio)
- `docs/SPEC.md` — especificación funcional: pantallas, modelo de datos, fórmulas, criterios de aceptación
- `docs/reference_impl.py` — implementación de referencia en Python; `src/engine/` la traduce y da los mismos resultados que `docs/golden-*.json` y `docs/tabla-60kg.json`
- `docs/FUENTES.md` — videos y artículos de origen
- `data/` — 80 alimentos, 35 comidas, 14 semanas, 12 pasos y 20 grupos de sustitución
- `src/engine/` — lógica pura con pruebas junto a cada archivo · `src/store/` — Zustand + IndexedDB (Dexie) · `src/features/` — pantallas
- `scripts/make-icons.mjs` — genera los íconos de la PWA (`npm run icons`)

## Decisiones de implementación

Donde el SPEC no era explícito:

- **Redondeo como Python** (mitades al par) para coincidir con los resultados de referencia.
- **Grupo `proteina_general`**: siempre se agrega a las opciones con +20 de penalización, como en `reference_impl.py` (el SPEC dice "solo si no queda ninguno").
- **Peso ideal** redondeado a medio kilo (165 cm → 60 kg). **Ratio de 80 exacto** = insulina alta.
- **Días del programa**: los días Lun…Dom de `program-weeks.json` se usan como días 1–7 desde que empieza cada semana. Si pasan más de 7 días sin avanzar, la semana se repite.
- **Criterios para avanzar** sin medida en el SPEC (semanas 3, 6, 8, 10, 12 y 13): se sugiere tras 7 días registrados. Glucosa estable = 3 lecturas en 7 días con menos de 15 mg/dL de diferencia.
- **Registro**: se agregaron `followedWeekRule` y `carbsUnder20`. La glucosa se guarda siempre en mg/dL y el peso en kg; las unidades del perfil solo cambian cómo se muestran.
- **Cambios de ingrediente**: se guardan sobre el ingrediente original. "Toda esta semana" ajusta la cantidad en proporción en cada comida. "Siempre" y "No lo encuentro" usan la opción elegida esta semana y la sustitución automática el resto. Un cambio manual que pasaría de 20 g se rechaza.
- **Lista de compras en 2 compras**: solo se dividen carnes, cerdo, aves y pescados; lo demás va completo en la primera compra para no comprar dos paquetes. La despensa ("Ya lo tengo") es por semana.
- **Semanas de ayuno**: la advertencia médica se muestra siempre y el ayuno no se puede marcar como iniciado sin confirmarla.

Aviso: uso educativo. Si tomas medicamentos para la presión o la glucosa, consulta a tu médico antes de los ayunos.
