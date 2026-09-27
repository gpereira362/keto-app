"""Implementación de referencia (Python) del motor: escalado, sustituciones y lista de compras.
Sirve como especificación ejecutable. La app en TypeScript debe producir los mismos resultados
que los archivos docs/golden-*.json.  Uso:  python3 docs/reference_impl.py
"""
import json, math, os
ROOT = os.path.join(os.path.dirname(__file__), '..')
load = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
FOODS = {f['id']: f for f in load('data/foods.json')}
MEALS = {m['id']: m for m in load('data/meals.json')}
WEEKS = load('data/program-weeks.json')
GROUPS = load('data/substitution-groups.json')
FAT_ORDER = next(g for g in GROUPS if g['id'] == '__fat_topup_order')['members']
REAL_GROUPS = [g for g in GROUPS if not g['id'].startswith('__')]
REF_KG = 60
CARB_LIMIT = 20.0

# ---------------------------------------------------------------- utilidades
def round_step(x, step):
    return max(step, round(x / step) * step)

def macros(food_id, qty):
    f = FOODS[food_id]
    return dict(protein=f['protein'] * qty, fat=f['fat'] * qty, carbs=f['carbs'] * qty)

def scale_qty(food_id, qty, factor):
    f = FOODS[food_id]
    if not f['scalable']:
        return qty
    return round(round_step(qty * factor, f['roundStep']), 2)

def scaled_meal(meal_id, ideal_kg):
    factor = ideal_kg / REF_KG
    return [dict(food=i['food'], qty=scale_qty(i['food'], i['qty'], factor)) for i in MEALS[meal_id]['items']]

def totals(items):
    t = dict(protein=0.0, fat=0.0, carbs=0.0)
    for i in items:
        for k, v in macros(i['food'], i['qty']).items():
            t[k] += v
    return t

# ---------------------------------------------------------------- exclusiones
def is_excluded(food_id, profile):
    """profile['exclusions'] = [{'type':'food'|'allergen', 'id':..., 'reason':'alergia'|'no-me-gusta'|'no-disponible'}]"""
    f = FOODS[food_id]
    for e in profile.get('exclusions', []):
        if e['type'] == 'food' and e['id'] == food_id:
            return True
        if e['type'] == 'allergen' and e['id'] in f['allergens']:
            return True
    return False

# ---------------------------------------------------------------- sustitución
def candidates(food_id, qty, profile, day_carbs_without_item=0.0):
    """Devuelve opciones para reemplazar `qty` de `food_id`, ordenadas por preferencia.
    Cada opción: {food, qty, topUp?, macros, delta, flags}"""
    old = macros(food_id, qty)
    groups = [g for g in REAL_GROUPS if food_id in g['members'] and not g.get('fallback')]
    # extraCandidates: opciones válidas en una sola dirección (la mantequilla puede reemplazar la crema del café, no al revés)
    if not groups:
        return []
    out, seen = [], set()
    for g in groups + [g for g in REAL_GROUPS if g.get('fallback') and g['matchBy'] == groups[0]['matchBy']]:
        key = g['matchBy']
        for rank, cand in enumerate(g['members'] + g.get('extraCandidates', [])):
            if cand == food_id or cand in seen or is_excluded(cand, profile):
                continue
            cf = FOODS[cand]
            if cf[key] <= 0:
                continue
            new_qty = round(round_step(qty * FOODS[food_id][key] / cf[key], cf['roundStep']), 2)
            items = [dict(food=cand, qty=new_qty)]
            new = macros(cand, new_qty)
            flags = []
            # completar grasa si el sustituto es más magro
            if g.get('fatTopUp') and old['fat'] - new['fat'] > 5:
                gap = old['fat'] - new['fat']
                fat_food = next((x for x in FAT_ORDER if not is_excluded(x, profile)), None)
                if fat_food:
                    tq = round_step(gap / FOODS[fat_food]['fat'], FOODS[fat_food]['roundStep'])
                    items.append(dict(food=fat_food, qty=tq))
                    flags.append('grasa-añadida')
            if new['protein'] > 0 and new['fat'] / new['protein'] < 0.4:
                flags.append('magro')
            t = totals(items)
            if day_carbs_without_item + t['carbs'] > CARB_LIMIT:
                flags.append('excede-carbohidratos')
            delta = {k: round(t[k] - old[k], 1) for k in t}
            score = abs(delta['protein']) + abs(delta['fat']) / 2 + 3 * abs(delta['carbs']) + rank * 2 + (20 if g.get('fallback') else 0) + (15 if 'magro' in flags else 0)
            out.append(dict(food=cand, items=items, group=g['id'], macros={k: round(v, 1) for k, v in t.items()},
                            delta=delta, flags=flags, score=round(score, 1)))
            seen.add(cand)
    ok = [o for o in out if 'excede-carbohidratos' not in o['flags']]
    bad = [o for o in out if 'excede-carbohidratos' in o['flags']]
    return sorted(ok, key=lambda o: o['score']) + bad

def apply_exclusions(items, profile, carb_budget=CARB_LIMIT):
    """Reemplaza cada alimento excluido por la mejor opción que quepa en el presupuesto de carbohidratos.
    carb_budget = carbohidratos disponibles para ESTOS items (20 g menos lo que ya suma el resto del día)."""
    keep = [i for i in items if not is_excluded(i['food'], profile)]
    used = totals(keep)['carbs']
    result, changes = list(keep), []
    for i in items:
        if not is_excluded(i['food'], profile):
            continue
        opts = candidates(i['food'], i['qty'], profile)
        pick = next((o for o in opts if used + o['macros']['carbs'] <= carb_budget), None)
        if pick:
            result.extend(pick['items']); used += pick['macros']['carbs']
            changes.append(dict(original=i, replacement=pick['items']))
        else:
            changes.append(dict(original=i, replacement=None, warning='sin sustituto válido: elegir otra comida'))
    return result, changes

def plan_day(day, profile):
    """Escala todas las comidas del día y aplica exclusiones respetando 20 g de carbohidratos en el DÍA."""
    kg = profile['idealWeightKg']
    slots = [scaled_meal(s['meal'], kg) for s in day['slots']]
    clean = sum(totals([i for i in it if not is_excluded(i['food'], profile)])['carbs'] for it in slots)
    budget_left = CARB_LIMIT - clean
    out, changes = [], []
    for it in slots:
        own_clean = totals([i for i in it if not is_excluded(i['food'], profile)])['carbs']
        res, ch = apply_exclusions(it, profile, own_clean + budget_left)
        budget_left -= totals(res)['carbs'] - own_clean
        out.append(res); changes += ch
    return out, changes

# ---------------------------------------------------------------- lista de compras
def shopping_list(week_no, profile, pantry=None, meal_overrides=None):
    """pantry: {food_id_de_compra: cantidad en packUnit que ya tienes}. meal_overrides: {(dia, slot_idx): meal_id}"""
    pantry = pantry or {}
    meal_overrides = meal_overrides or {}
    week = next(w for w in WEEKS if w['week'] == week_no)
    need = {}
    for d in week['days']:
        day = dict(d, slots=[dict(s, meal=meal_overrides.get((d['day'], si), s['meal'])) for si, s in enumerate(d['slots'])])
        slots, _ = plan_day(day, profile)
        for items in slots:
            for i in items:
                p = FOODS[i['food']]['purchase']
                target = p.get('buyAs', i['food'])
                amount = i['qty'] * p['perUnit'] * p['rawFactor']
                need[target] = need.get(target, 0) + amount
    lines = []
    for fid, amount in need.items():
        f = FOODS[fid]; p = f['purchase']
        amount -= pantry.get(fid, 0)
        if amount <= 0:
            continue
        unit = p['packUnit']
        packs = math.ceil(amount / p['pack'] - 1e-9) if p.get('pack') else None
        lines.append(dict(food=fid, category=f['category'], name=p['shopName'],
                          need=round(amount) if unit != 'unid' else round(amount, 1), unit=unit,
                          packs=packs, packLabel=p.get('packLabel'), note=p.get('note')))
    order = ['Carnes', 'Cerdo y embutidos', 'Aves', 'Pescados y mariscos', 'Huevos y lácteos', 'Verduras', 'Despensa']
    lines.sort(key=lambda l: (order.index(l['category']), l['name']))
    staples = ['Sal de buena calidad', 'Café o té', 'Agua con gas (opcional)', 'Magnesio 300–400 mg']
    staples.append('Tiras de cetonas en orina' if week_no <= 9 else 'Tiras de glucosa y cetonas para el medidor')
    return dict(week=week_no, idealWeightKg=profile['idealWeightKg'], lines=lines, staples=staples)

# ---------------------------------------------------------------- casos de ejemplo
if __name__ == '__main__':
    base = dict(idealWeightKg=60, exclusions=[])
    golden_sub = {
        'espárragos (1 porción) sin exclusiones': candidates('esparragos', 1, base)[:6],
        'ribeye 150 g': candidates('ribeye', 150, base)[:6],
        'salmón 150 g': candidates('salmon', 150, base)[:6],
        '3 huevos': candidates('huevo', 3, base)[:5],
        'mantequilla 1 cda': candidates('mantequilla', 1, base)[:5],
        'crema de café 2 cdas, alergia a lácteos': candidates('crema', 2, dict(base, exclusions=[{'type': 'allergen', 'id': 'lacteos', 'reason': 'alergia'}]))[:3],
    }
    allergy_egg = dict(base, exclusions=[{'type': 'allergen', 'id': 'huevo', 'reason': 'alergia'}])
    golden_sub['DES1 con alergia al huevo'] = apply_exclusions(scaled_meal('DES1', 60), allergy_egg)
    no_pork = dict(base, exclusions=[{'type': 'allergen', 'id': 'cerdo', 'reason': 'no-me-gusta'}])
    golden_sub['CEN4 sin cerdo'] = apply_exclusions(scaled_meal('CEN4', 60), no_pork)
    json.dump(golden_sub, open(os.path.join(ROOT, 'docs/golden-sustituciones.json'), 'w'), ensure_ascii=False, indent=1)

    golden_shop = {
        'semana1_60kg': shopping_list(1, base),
        'semana1_60kg_sin_pescado_con_despensa': shopping_list(1, dict(base, exclusions=[{'type': 'allergen', 'id': 'pescado', 'reason': 'alergia'}]),
                                                             pantry={'huevo': 6, 'aceite': 500}),
        'semana10_75kg': shopping_list(10, dict(idealWeightKg=75, exclusions=[])),
    }
    json.dump(golden_shop, open(os.path.join(ROOT, 'docs/golden-lista-compras.json'), 'w'), ensure_ascii=False, indent=1)

    # verificación: con exclusiones comunes ningún día pasa de 20 g
    worst = 0
    for a in [None, 'huevo', 'lacteos', 'pescado', 'cerdo', 'mariscos']:
        prof = dict(idealWeightKg=60, exclusions=[{'type': 'allergen', 'id': a, 'reason': 'alergia'}] if a else [])
        for kg in (45, 60, 90, 120):
            prof['idealWeightKg'] = kg
            for w in WEEKS:
                for d in w['days']:
                    slots, _ = plan_day(d, prof)
                    c = totals([i for it in slots for i in it])['carbs']; worst = max(worst, c)
                    assert c <= CARB_LIMIT, (a, kg, w['week'], d['day'], c)
    print('OK: ningún día pasa de 20 g de carbohidratos con exclusiones. Máximo =', round(worst, 1))
