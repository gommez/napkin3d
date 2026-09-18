import { test, expect } from "@playwright/test";
test("mobile workflow on the production Pages path", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (dialog) =>
    dialog.accept(
      dialog.type() === "prompt" ? dialog.defaultValue() : undefined,
    ),
  );
  await page.goto("/napkin3d/");
  await expect(
    page.getByRole("button", { name: "PROYECTO AUTOMÁTICO" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "PROYECTO AUTOMÁTICO" }).click();
  await expect(page.getByRole("heading", { name: "NUEVA PIEZA" })).toBeVisible();
  await expect(page.getByRole("button", { name: "HACER FOTO" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ELEGIR FOTO" })).toBeVisible();
  await page.getByRole("button", { name: "← Inicio" }).click();
  await page.getByRole("button", { name: "PROYECTO MANUAL" }).click();
  await page.getByRole("button", { name: "Create your first project" }).click();
  await page.getByRole("button", { name: "+ Part", exact: true }).click();
  const svg = page.locator("svg.editor");
  await expect(svg).toBeVisible();
  // SVG fixture goes through the same browser image decode / JPEG downsampling path as photos.
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "sketch.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="white"/><rect x="50" y="50" width="200" height="150" fill="none" stroke="black"/></svg>',
      ),
    });
  await expect(svg.locator("image")).toHaveCount(1);
  await page.getByRole("button", { name: "Calibrate", exact: true }).click();
  let box = (await svg.boundingBox())!;
  await page.mouse.click(box.x + 50, box.y + 60);
  await page.mouse.click(box.x + 150, box.y + 60);
  await page.getByLabel("Real distance (mm)").fill("25");
  await page.getByRole("button", { name: "Apply calibration" }).click();
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await svg.scrollIntoViewIfNeeded();
  box = (await svg.boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 180, { steps: 6 });
  await page.mouse.up();
  await page.getByLabel("width", { exact: true }).fill("30");
  await page.getByLabel("height", { exact: true }).fill("20");
  await expect(page.getByLabel("width", { exact: true })).toHaveValue("30");
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.locator(".properties select option")).toHaveCount(3);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".properties select option")).toHaveCount(2);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete entity", exact: true })
    .click();
  const svgDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "SVG ↓" }).click();
  expect((await svgDownload).suggestedFilename()).toBe("New_part.svg");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator(".viewer canvas")).toBeVisible();
  await page.getByLabel("Extrusion depth (mm)").fill("8");
  await page.getByRole("button", { name: "Top", exact: true }).click();
  await page.getByRole("button", { name: "Reset camera", exact: true }).click();
  const stlDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "STL ↓" }).click();
  expect((await stlDownload).suggestedFilename()).toBe("New_part.stl");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.screenshot({ path: "test-results/mobile-3d.png", fullPage: true });
  await page.reload();
  await page.getByRole("button", { name: "PROYECTO MANUAL" }).click();
  await page.getByRole("button", { name: "My first project" }).click();
  await page
    .getByRole("button", { name: "New part 1 entities · 8 mm deep" })
    .click();
  await expect(page.locator("svg.editor image")).toHaveCount(1);
  await page.getByRole("button", { name: "Inicio", exact: true }).click();
  await page.getByRole("button", { name: "PROYECTO MANUAL" }).click();
  await page.getByRole("button", { name: "PROJECT", exact: true }).click();
  await expect(page.getByRole("button", { name: "My first project" })).toBeVisible();
  await page
    .getByRole("button", { name: "New part 1 entities · 8 mm deep" })
    .click();
  await page
    .locator(".properties select")
    .selectOption({ label: "1. rectangle" });
  await expect(page.getByLabel("width", { exact: true })).toHaveValue("30");
  await expect(page.getByLabel("height", { exact: true })).toHaveValue("20");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/mobile-2d.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("touch drawing, moving, resizing and panning", async ({
  page,
  context,
}) => {
  page.on("dialog", (d) => d.accept(d.defaultValue()));
  await page.goto("/napkin3d/");
  await page.getByRole("button", { name: "PROYECTO MANUAL" }).click();
  await page.getByRole("button", { name: "Create your first project" }).click();
  await page.getByRole("button", { name: "+ Part", exact: true }).click();
  const svg = page.locator("svg.editor");
  const cdp = await context.newCDPSession(page);
  async function drag(x: number, y: number, dx: number, dy: number) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 5; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + (dx * i) / 5, y: y + (dy * i) / 5 }],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  await page.getByRole("button", { name: "Circle", exact: true }).click();
  await svg.scrollIntoViewIfNeeded();
  let box = (await svg.boundingBox())!;
  await drag(box.x + 120, box.y + 120, 40, 0);
  await expect(page.getByLabel("diameter", { exact: true })).toBeVisible();
  await page.getByLabel("diameter", { exact: true }).fill("20.5");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await svg.scrollIntoViewIfNeeded();
  const circle = await svg.locator("g circle").boundingBox();
  const previous = Number(
    await page.getByLabel("x", { exact: true }).inputValue(),
  );
  await drag(
    circle!.x + circle!.width / 2,
    circle!.y + circle!.height / 2,
    30,
    20,
  );
  expect(
    Number(await page.getByLabel("x", { exact: true }).inputValue()),
  ).toBeGreaterThan(previous);
  await svg.scrollIntoViewIfNeeded();
  const handle = (await svg.locator("[data-handle]").boundingBox())!;
  await drag(handle.x + handle.width / 2, handle.y + handle.height / 2, 20, 0);
  expect(
    Number(await page.getByLabel("diameter", { exact: true }).inputValue()),
  ).toBeGreaterThan(20.5);
  await page.getByRole("button", { name: "Pan", exact: true }).click();
  await svg.scrollIntoViewIfNeeded();
  box = (await svg.boundingBox())!;
  const before = await svg.getAttribute("viewBox");
  await drag(box.x + 200, box.y + 220, 20, 30);
  expect(await svg.getAttribute("viewBox")).not.toBe(before);
  await page.getByRole("button", { name: "Line", exact: true }).click();
  await svg.scrollIntoViewIfNeeded();
  box = (await svg.boundingBox())!;
  await drag(box.x + 70, box.y + 100, 70, 60);
  await expect(page.getByLabel("x1", { exact: true })).toBeVisible();
  await page.getByLabel("x1", { exact: true }).fill("-12.25");
  await expect(page.getByLabel("x1", { exact: true })).toHaveValue("-12.25");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator(".viewer canvas")).toBeVisible();
  await page.getByLabel("Display").selectOption("Edges");
  await page.getByLabel("Display").selectOption("Transparent");
  await page
    .getByText("Part orientation (affects STL)", { exact: true })
    .click();
  await page.getByRole("button", { name: "Rotate X · 0°" }).click();
  await expect(
    page.getByRole("button", { name: "Rotate X · 90°" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("automatic scanner resolves a rectangular part with a circular hole", async ({
  page,
}) => {
  await page.goto("/napkin3d/");
  await page.getByRole("button", { name: "PROYECTO AUTOMÁTICO" }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "bracket.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="white"/><rect x="10" y="10" width="80" height="60" fill="none" stroke="black"/><circle cx="50" cy="40" r="8" fill="black"/></svg>',
      ),
    });
  await expect(page.getByRole("heading", { name: "REVISA EL BOCETO" })).toBeVisible();
  await page.getByLabel("Ancho exterior (mm)").fill("80");
  await page.getByLabel("Diámetro del agujero 1 (mm)").fill("10");
  await page.getByLabel("¿Qué grosor tendrá la pieza? (mm)").fill("5");
  await page.getByRole("button", { name: "CONTINUAR" }).click();
  await expect(page.getByRole("heading", { name: "CONFIRMA TU PIEZA" })).toBeVisible();
  await page.getByRole("button", { name: "CONFIRMAR PIEZA" }).click();
  await expect(page.locator(".viewer canvas")).toBeVisible();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator("svg.editor image")).toHaveCount(1);
  await page.locator(".properties select").selectOption({ label: "2. hole" });
  await expect(page.getByLabel("diameter", { exact: true })).toHaveValue("10");
  await page.getByLabel("diameter", { exact: true }).fill("12");
  await expect(page.getByLabel("diameter", { exact: true })).toHaveValue("12");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator(".viewer canvas")).toBeVisible();
});
