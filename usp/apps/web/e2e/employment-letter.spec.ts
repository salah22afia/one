import { expect, test } from '@playwright/test';

// DC-01 end to end through the UI: employee submits → personnel affairs approves from the inbox → letter issued →
// employee opens it → anyone verifies it by code. `?as=<person>` is the dev sign-in (no IdP yet).
// Needs example org data and a way to act as seeded people; skipped while the database has no sample data.
test.skip('employment letter: request, approve, issue, view, verify', async ({ page }) => {
  await page.goto('/services?as=P-AHMED');
  await page.getByRole('link', { name: 'خطاب تعريف' }).click();

  await page.getByRole('button', { name: 'إرسال الطلب' }).click();
  await expect(page.getByText('الجهة الموجه إليها مطلوب')).toBeVisible();

  await page.getByLabel(/الجهة الموجه إليها/).fill('بنك الرياض');
  await page.getByLabel(/اللغة/).selectOption('ar');
  await page.getByLabel(/يتضمن الراتب/).check();
  await page.getByRole('button', { name: 'إرسال الطلب' }).click();

  await expect(page).toHaveURL(/\/requests\/DC-01-\d{4}-\d{5}$/);
  const id = page.url().split('/requests/')[1]!;
  await expect(page.getByText('قيد الاعتماد').first()).toBeVisible();
  await expect(page.locator('.timeline').getByText(/نورة سعد الحربي/)).toBeVisible(); // who the step is with now

  await page.goto('/inbox?as=P-NOURA');
  await page.getByRole('link', { name: new RegExp(id) }).click();
  await expect(page.getByText('بانتظار قرارك')).toBeVisible();
  await page.getByRole('button', { name: 'اعتماد' }).click();
  await expect(page.getByText('مكتمل').first()).toBeVisible();

  await page.goto(`/requests/${id}?as=P-AHMED`);
  await page.getByRole('link', { name: 'عرض وطباعة' }).click();
  const letter = page.frameLocator('iframe.doc-frame');
  await expect(letter.locator('.letter .to')).toContainText('بنك الرياض');
  await expect(letter.locator('.letter.ar')).toContainText('أحمد بن سعود الدوسري');
  const code = (await letter.locator('.foot .c b.mono').textContent())!.trim();
  expect(code).toMatch(/^GS-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);

  await page.goto(`/verify/${code}`);
  await expect(page.getByText('مستند صحيح صادر من البوابة')).toBeVisible();
});
