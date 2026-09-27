import { expect, test, type Page } from '@playwright/test';

/** Onboarding completo: 165 cm → 60 kg de peso ideal (IMC 22). */
async function onboarding(page: Page, opts: { allergy?: string } = {}) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tu cuerpo' })).toBeVisible();
  await page.getByLabel('Peso actual (kg)').fill('72');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await expect(page.getByRole('heading', { name: 'Tu peso ideal' })).toBeVisible();
  await expect(page.getByRole('button', { name: /IMC 22\s*60 kg/ })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await expect(page.getByRole('heading', { name: 'Alergias y lo que no comes' })).toBeVisible();
  if (opts.allergy) await page.getByRole('button', { name: opts.allergy, exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await expect(page.getByRole('heading', { name: 'Inicio y horario' })).toBeVisible();
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('heading', { name: /Semana 1 · día 1/ })).toBeVisible();
}

test('onboarding → hoy con el plan de 60 kg; se guarda y funciona sin conexión', async ({ page, context }) => {
  const start = Date.now();
  await onboarding(page);
  expect(Date.now() - start).toBeLessThan(60_000);

  // Día 1 de la semana 1 con 60 kg: 3 huevos, totales de docs/tabla-60kg.json (12,6 g de carbohidratos).
  await expect(page.getByText('3 huevos', { exact: true })).toBeVisible();
  await expect(page.getByText(/12,6 g/)).toBeVisible();

  // Recorrer los días: anterior deshabilitado en el día 1; siguiente muestra el día 2 como vista previa.
  await expect(page.getByRole('button', { name: 'Día anterior' })).toBeDisabled();
  await page.getByRole('button', { name: 'Día siguiente' }).click();
  await expect(page.getByRole('heading', { name: /Semana 1 · día 2/ })).toBeVisible();
  await expect(page.getByText('Vista previa')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Comí esto' })).toHaveCount(0);
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Día siguiente' }).click();
  await expect(page.getByRole('heading', { name: /Semana 2 · día 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a hoy' }).click();
  await expect(page.getByRole('heading', { name: /Semana 1 · día 1/ })).toBeVisible();

  // "Comí esto" se guarda después de recargar.
  await page.getByRole('button', { name: 'Comí esto' }).nth(1).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '✓ Comido' })).toHaveCount(1);

  // Sin conexión después de la primera carga (service worker).
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Semana 1 · día 1/ })).toBeVisible();
  await context.setOffline(false);
});

test('cambiar un ingrediente actualiza el plan y la lista de compras sin recargar', async ({ page }) => {
  await onboarding(page);

  await page.getByRole('link', { name: 'Compras' }).or(page.getByRole('button', { name: 'Compras' })).click();
  await expect(page.getByText(/^22 → 2 docenas$/)).toBeVisible(); // Huevos, semana 1

  await page.getByRole('button', { name: 'Hoy' }).click();
  await page.getByRole('button', { name: 'Cambiar 3 huevos' }).click();
  const sheet = page.getByRole('dialog', { name: 'Cambiar ingrediente' });
  await sheet.getByRole('radio', { name: /^6 lonjas de tocino/ }).click();
  await sheet.getByRole('button', { name: 'Toda esta semana' }).click();
  await sheet.getByRole('button', { name: 'Cambiar', exact: true }).click();

  await expect(page.getByText('Cambiado toda la semana: Huevos → Tocino')).toBeVisible();
  await expect(page.getByText('en lugar de Huevos')).toBeVisible();

  await page.getByRole('button', { name: 'Compras' }).click();
  // Toda la semana: los 22 huevos pasan a tocino (6 + 44 lonjas) y los huevos salen de la lista.
  await expect(page.getByText('Huevos', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^50 → 5 paquetes de 12 lonjas/)).toBeVisible();
});

test('una alergia no aparece en ningún lugar, y el respaldo se exporta e importa', async ({ page }) => {
  await onboarding(page, { allergy: 'Huevo' });

  // Plan: ningún ingrediente con huevo ni mayonesa (los nombres de las comidas no cambian).
  await expect(page.getByText(/^\d+ huevos?$/)).toHaveCount(0);
  await expect(page.getByText(/cdas? de mayonesa/)).toHaveCount(0);
  await expect(page.getByText('en lugar de Huevos').first()).toBeVisible();

  // Opciones de cambio: no ofrecen alimentos con huevo.
  await page.getByRole('button', { name: /^Cambiar 1 cda de mantequilla/ }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Cambiar ingrediente' });
  await expect(sheet.getByRole('radio').first()).toBeVisible();
  const more = sheet.getByRole('button', { name: /opciones más/ });
  if (await more.count()) await more.click();
  await expect(sheet.getByRole('radio', { name: /yema|mayonesa|huevo/i })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Cerrar' }).first().click();

  // Lista de compras: sin huevos ni mayonesa.
  await page.getByRole('button', { name: 'Compras' }).click();
  await expect(page.getByText('Lista de compras')).toBeVisible();
  await expect(page.getByText('Huevos', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Mayonesa/)).toHaveCount(0);

  // Exportar → borrar → importar.
  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByRole('button', { name: /Ajustes/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar (JSON)' }).click();
  const file = await (await download).path();

  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Borrar todos mis datos' }).click();
  await expect(page.getByRole('heading', { name: 'Tu cuerpo' })).toBeVisible();

  // Sin perfil, se importa desde Ajustes: se vuelve a crear un perfil mínimo y se importa encima.
  await onboarding(page);
  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByRole('button', { name: /Ajustes/ }).click();
  await page.getByLabel('Archivo de respaldo').setInputFiles(file!);
  await expect(page.getByText('Datos importados.')).toBeVisible();
  await page.getByRole('button', { name: 'Hoy' }).click();
  await expect(page.getByText('en lugar de Huevos').first()).toBeVisible(); // volvió la alergia
});
