# Especificación — Keto Continuum App (v1)

## 1. Qué hace
La persona ingresa su estatura, sexo, peso actual y, si lo sabe, su peso ideal. La app:
1. Calcula el peso ideal si no lo sabe.
2. Calcula sus metas diarias de proteína y muestra la grasa orientativa.
3. Genera el plan de 14 semanas con cada comida escalada a su peso ideal.
4. Le muestra **qué comer hoy**, con cantidades y gramos de proteína, grasa y carbohidratos.
5. **Sustituye ingredientes** si algo no está en la tienda, no le gusta o le da alergia, y recalcula la cantidad equivalente.
6. Genera la **lista de supermercado de cada semana**, ya con las sustituciones aplicadas.
7. Registra mediciones diarias y le sugiere cuándo avanzar al siguiente paso.

Uso personal, en el celular, sin cuenta ni servidor.

## 2. Pantallas

| Pantalla | Contenido |
|---|---|
| **Onboarding** (4 pasos) | Datos del cuerpo → peso ideal calculado (editable) → **alergias y alimentos que no come** → fecha de inicio y horario (hora de despertar, amanecer local) |
| **Hoy** (inicio) | Semana y paso actual, ventana de comida con cuenta regresiva, tarjetas por comida (alimentos, cantidades, P/G/C), totales del día contra las metas, botón "Comí esto". Cada ingrediente tiene el botón **"Cambiar"**. |
| **Semana** | Tabla de 7 días × comidas con P/G/C; reglas, objetivo, qué medir y criterio para avanzar. Botón **"Lista de compras"**. |
| **Lista de compras** | Ver §4.7. Agrupada por pasillo, con casillas, cantidades a comprar y paquetes; "Ya lo tengo"; compartir como texto. |
| **Cambiar ingrediente** (hoja inferior) | Ver §4.6. Opciones equivalentes ordenadas, con la cantidad nueva y la diferencia de P/G/C; alcance y motivo del cambio. |
| **Mis exclusiones** | Lista de alergias (por grupo), "no me gusta" y "no lo encuentro" (con fecha de vencimiento). Se puede editar desde Ajustes. |
| **Mapa** | Los 12 pasos del continuum y las 14 semanas; dónde está y lo que falta |
| **Registro** | Tira de orina (5 colores), glucosa y cetonas en sangre, peso, hambre (1–5), comida saltada sin querer, comidas cumplidas |
| **Progreso** | Gráficas de peso, glucosa en ayunas y ratio Dr. Boz; racha de días que cumplen la regla de la semana |
| **Alimentos** | Catálogo con macros y alérgenos; cambiar una comida completa por otra de la misma categoría |
| **Ajustes** | Perfil, unidades (kg/lb, mg/dL/mmol/L), tamaños de paquete locales, exportar/importar JSON, borrar datos |

## 3. Modelo de datos

Ver `src/engine/types.ts`. Archivos en `data/`:

| Archivo | Qué contiene |
|---|---|
| `foods.json` | 80 alimentos: macros por unidad, `roundStep`, `scalable`, `allergens[]`, `category` (pasillo) y `purchase` (datos de compra) |
| `meals.json` | 35 comidas. Cantidades base para **60 kg de peso ideal** |
| `program-weeks.json` | 14 semanas con reglas y las comidas de cada día |
| `continuum-steps.json` | Los 12 pasos |
| `substitution-groups.json` | 20 grupos de equivalencia + el orden para completar grasa (`__fat_topup_order`) |

Estado del usuario: `Profile`, `Exclusion[]`, `Override[]` (cambios puntuales), `PantryItem[]`, `ShoppingCheck[]`, `DailyLog[]`, `ProgressState`.

## 4. Motor (lógica pura)

La implementación de referencia está en `docs/reference_impl.py`. La versión en TypeScript debe dar los mismos resultados que `docs/golden-*.json`.

### 4.1 Peso ideal (`body.ts`)
- Por defecto: IMC 22 → `22 × (estatura_m)²`.
- Alternativas seleccionables: Devine (H: 50 + 0.91 × (cm − 152.4); M: 45.5 + 0.91 × (cm − 152.4)) y Robinson.
- El usuario siempre puede escribir su propio valor. Se guarda `idealWeightSource`.
- Validar entre 35 y 150 kg.

### 4.2 Metas (`body.ts`)
- Proteína base = 1.0 g × kg de peso ideal. Máxima = 1.6 g × kg.
- Cada semana define su rango (`proteinGPerKg`): semanas 1–9 de 1.0 a 1.3; semanas 10–14 de 1.0 a 1.6.
- Grasa: sin meta fija. Se muestra como "hasta saciedad", con el valor del plan como referencia (70–80 % de las calorías).
- Carbohidratos: tope rígido de 20 g totales por día.

### 4.3 Escalado (`scaling.ts`)
```
factor = idealWeightKg / 60
qty' = scalable ? max(roundStep, round(qty × factor / roundStep) × roundStep) : qty
macros = Σ food.macro × qty'
```
Texto de la porción: "3 huevos", "150 g de ribeye (cocido)", "1½ cdas de mantequilla", "½ taza de chucrut".

### 4.4 Plan (`plan.ts`)
- `planDay(day, profile, overrides)` → escala, aplica exclusiones (§4.6) y cambios puntuales, y devuelve totales.
- `getWeekPlan(profile, week)` y `getTodayPlan(profile, progress, date)`.
- `swapMeal(slot, mealId)` solo dentro de la misma categoría (DES, ALM, CEN, P2, OM, RUP).
- Horarios: los de `program-weeks.json` son de ejemplo. Desde la semana 11, la última comida debe terminar dentro de las 11 h después del amanecer del perfil.

### 4.5 Progreso (`progress.ts`)
- Ratio Dr. Boz = glucosa (mg/dL) ÷ cetonas (mmol/L). Si la glucosa viene en mmol/L, multiplicar por 18.
  - &gt; 80 insulina alta · &lt; 80 pérdida de peso · &lt; 40 autofagia · &lt; 20 terapéutico
- Criterios para **sugerir** avanzar:
  - S1→S2: 7 días seguidos registrados bajo 20 g
  - S2→S3: tira ≥ 1 (rosa) en al menos 3 de los últimos 5 días
  - S4→S5: al menos una `missedMealByAccident = true`
  - S5→S6: 7 días seguidos con 2 comidas
  - S7→S8: 14 días en 16:8
  - S9→S10: cómoda en 18:6 (autoevaluación)
  - S11→S12: glucosa en ayunas estable y confirmación de la advertencia médica si `onBpMeds` u `onGlucoseMeds`
- Si no se cumple, la app ofrece "Repetir semana".

### 4.6 Sustitución de ingredientes (`substitutions.ts`)

**Cuándo se usa**
- *Manual*: la persona toca "Cambiar" en un ingrediente ("no tengo espárragos").
- *Automática*: un alimento está excluido por alergia, porque no le gusta o porque no lo encuentra. El plan y la lista de compras lo reemplazan solos y lo marcan con un ícono "cambiado".

**Exclusiones**
```
Exclusion { type: 'food' | 'allergen', id, reason: 'alergia' | 'no-me-gusta' | 'no-disponible', until?: fecha }
```
- `allergen` excluye todos los alimentos con esa etiqueta: huevo, lacteos, pescado, mariscos, cerdo, mostaza, coco. Incluye alimentos compuestos (la mayonesa lleva huevo).
- `no-disponible` vence sola en la fecha `until`. Por defecto es el domingo de la semana en curso.
- Una alergia nunca muestra el alimento como opción, ni siquiera marcado.

**Cálculo de equivalencias**
1. Buscar los grupos en `substitution-groups.json` que contienen el alimento, sin contar los grupos `fallback`.
2. Candidatos = miembros de esos grupos más sus `extraCandidates`, sin el original y sin excluidos. Si no queda ninguno, usar el grupo `proteina_general` (fallback).
3. Cada grupo tiene `matchBy`: `protein` (carnes, pescados, huevos), `fat` (grasas, quesos, cremas) o `carbs` (verduras, fermentados). La cantidad nueva es:
   `qtyNueva = redondear(qty × original[matchBy] ÷ candidato[matchBy], roundStep del candidato)`
4. **Completar grasa**: si el grupo tiene `fatTopUp` y al sustituto le faltan más de 5 g de grasa, agregar la primera grasa no excluida de `__fat_topup_order` (mantequilla, ghee, aceite de oliva…), en medias cucharadas. Así, pechuga o trucha en lugar de salmón sigue siendo keto.
5. Marcas: `magro` (grasa/proteína < 0.4), `grasa-añadida`, `excede-carbohidratos`.
6. **Orden**: puntaje = |ΔP| + |ΔG|/2 + 3·|ΔC| + 2·posición en el grupo + 20 si es fallback + 15 si es magro. Menor puntaje primero. Las opciones que harían pasar el día de 20 g de carbohidratos van al final y deshabilitadas.
7. **Presupuesto del día**: al aplicar exclusiones automáticas se calcula todo el día. Primero se suman los carbohidratos de lo que no cambia, y cada sustituto debe caber en lo que queda hasta 20 g. Si ninguno cabe, se avisa "elige otra comida".

**Ejemplos (60 kg)** — ver `docs/golden-sustituciones.json`
| Original | Opciones que debe ofrecer |
|---|---|
| 6 espárragos | ½ taza de espinaca · ½ taza de coliflor · 2 tazas de lechuga · 110 g de calabacín · 100 g de pepino |
| 150 g ribeye | 140 g picaña · 145 g entrecot + ½ cda mantequilla · 130 g cordero + ½ cda mantequilla · 160 g brisket |
| 150 g salmón | 125 g sardinas + ½ cda mantequilla · 130 g caballa · 1½ latas de sardinas · 135 g arenque |
| 3 huevos | 6 lonjas de tocino · 100 g salchicha · 110 g carne molida |
| 1 cda mantequilla | 1 cda ghee · 1 cda sebo · 1 cda manteca de cerdo · 1 cda aceite de oliva |
| 2 cdas de crema (alergia a lácteos) | 3 cdas de leche de coco · 1 cda de MCT |

**Hoja "Cambiar ingrediente"**
- Encabezado: el original con su cantidad y P/G/C.
- Lista de opciones: nombre, cantidad nueva, chip de diferencia ("+1 g prot · −5 g grasa") y marcas.
- Alcance: *Solo esta comida* · *Toda esta semana* · *Siempre* (crea una exclusión `no-me-gusta`) · *No lo encuentro esta semana* (exclusión `no-disponible` que vence el domingo) · *Soy alérgica* (exclusión por alérgeno; pide confirmar el grupo).
- Después de aplicar: recalcular el día y la lista de compras, y ofrecer "Deshacer".

### 4.7 Lista de supermercado (`shopping.ts`)

**Entrada**: número de semana, perfil (peso ideal y exclusiones), cambios puntuales, despensa ("ya lo tengo").

**Cálculo**
1. Para cada día de la semana: `planDay` (con escalado, exclusiones y cambios).
2. Por cada ingrediente: `compra = qty × purchase.perUnit × purchase.rawFactor`, en `packUnit` (g, ml o unid).
   - `rawFactor` convierte el peso cocido y comestible del plan al peso que se compra (hueso, merma, grasa que se derrite). Ejemplos: alitas 1.9, ribeye 1.3, brisket 1.5, espárragos 1.4.
   - `buyAs` junta alimentos que se compran igual: las yemas se compran como huevos, `sardina_g` como latas de sardinas, `ghee_cda` como ghee.
3. Sumar por alimento de compra y restar la despensa.
4. Paquetes = `ceil(total ÷ pack)` cuando hay `pack`. Si no hay paquete (carne al corte), se muestran los gramos.
5. Ordenar por pasillo: Carnes · Cerdo y embutidos · Aves · Pescados y mariscos · Huevos y lácteos · Verduras · Despensa.
6. Agregar básicos: sal, café o té, magnesio, y tiras de orina (semanas 1–9) o tiras de sangre (semanas 10–14).
7. En semanas de ayuno no se compra nada para los días sin comida (ya sale solo del plan).

**Presentación de cada renglón**: "Huevos — 22 → 2 docenas", "Ribeye — 195 g (pedir al carnicero en cortes de ~2.5 cm)", "Espárragos — 126 g → 1 manojo de 450 g". Casilla para marcar comprado. Botón "Ya lo tengo" para indicar la cantidad en casa.

**Opciones**
- *Dividir en 2 compras*: días 1–3 y días 4–7, para que carnes y pescado frescos no se echen a perder.
- *Tamaños de paquete locales*: se pueden editar en Ajustes (por ejemplo, mantequilla de 200 g en vez de 227 g).
- *Compartir*: copiar como texto con viñetas (usar `navigator.clipboard`). Si no se puede, seleccionar el texto.
- El estado de las casillas se guarda por semana.

Ver `docs/golden-lista-compras.json`: semana 1 con 60 kg; semana 1 con alergia al pescado y despensa (6 huevos, 500 ml de aceite); semana 10 con 75 kg.

## 5. Contenido y fuentes
- `data/` se generó a partir de unos 55 videos del canal de Dr. Boz y de bozmd.com. Ver `docs/FUENTES.md`.
- Los alimentos sustitutos siguen su preferencia por cortes grasos, animales rumiantes, pescado graso y verduras bajas en carbohidratos. Los magros se ofrecen con grasa añadida.
- Macros aproximados según valores USDA. Mostrar el aviso "valores estimados".
- Aviso médico fijo en Ajustes y en las semanas 12–14.

## 6. Criterios de aceptación v1
1. Onboarding completo en menos de 1 minuto. Con 165 cm muestra 60 kg de peso ideal (IMC 22).
2. Hoy muestra las comidas correctas para cualquier fecha entre el inicio y el día 98.
3. Prueba: con pesos ideales de 40 a 150 kg y con cada alergia (huevo, lácteos, pescado, cerdo, mariscos), ningún día pasa de 20 g de carbohidratos.
4. Prueba: con 60 kg y sin exclusiones, los totales diarios coinciden con `docs/tabla-60kg.json` (±1 g).
5. Prueba: las sustituciones y las listas de compras coinciden con `docs/golden-*.json` (mismo orden en las primeras 3 opciones; cantidades ±1 paso de redondeo).
6. Un alimento con alergia no aparece en ningún lugar: plan, opciones de cambio ni lista de compras.
7. Cambiar un ingrediente actualiza la lista de compras sin recargar.
8. Funciona sin conexión después de la primera carga. Instalable como PWA.
9. Exportar e importar todos los datos en JSON.

## 7. Hitos sugeridos
1. Motor + pruebas (sin UI): peso ideal, escalado, plan, **sustituciones** y **lista de compras**
2. Onboarding (con exclusiones) + Hoy + Semana
3. Hoja "Cambiar ingrediente" + Mis exclusiones
4. Lista de compras (pasillos, casillas, despensa, 2 compras, compartir)
5. Registro + Progreso (gráficas)
6. Mapa, Alimentos, PWA, exportar/importar y pulido

## 8. Fuera de la v1 (ideas)
- Recordatorios (apertura y cierre de ventana, medir cetonas)
- Sincronización entre dispositivos (Supabase)
- Precios estimados de la lista
- Modo carnívoro (sin verduras)
