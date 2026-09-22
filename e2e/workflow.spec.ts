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
  await expect(page.locator('label[for="automatic-camera-input"]')).toBeVisible();
  await expect(page.locator('label[for="automatic-gallery-input"]')).toBeVisible();
  await page.getByRole("button", { name: "← Inicio" }).click();
  await page.getByRole("button", { name: "PROYECTO MANUAL" }).click();
  await page.getByRole("button", { name: "Create your first project" }).click();
  await page.getByRole("button", { name: "+ Part", exact: true }).click();
  await page.getByRole("button", { name: "Editor avanzado" }).click();
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
  await page.getByRole("button", { name: "Editor avanzado" }).click();
  await expect(page.locator("svg.editor image")).toHaveCount(1);
  await page.getByRole("button", { name: "Inicio", exact: true }).click();
  await page.getByRole("button", { name: "PROYECTO MANUAL" }).click();
  await page.getByRole("button", { name: "PROJECT", exact: true }).click();
  await expect(page.getByRole("button", { name: "My first project" })).toBeVisible();
  await page
    .getByRole("button", { name: "New part 1 entities · 8 mm deep" })
    .click();
  await page.getByRole("button", { name: "Editor avanzado" }).click();
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
  await page.getByRole("button", { name: "Editor avanzado" }).click();
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
  await page.getByText("LAB · Diagnóstico temporal", { exact: true }).click();
  const diagnostic = page.getByTestId("scan-diagnostic-json");
  await expect.poll(async () => JSON.parse((await diagnostic.textContent())!).ocr.status, { timeout: 60000 }).toMatch(/READY|ERROR/);
  let report = JSON.parse((await diagnostic.textContent())!);
  expect(["READY", "ERROR"]).toContain(report.ocr.status);
  expect(report.association.status).toMatch(/READY|NOT_READY/);
  expect(report.unresolved).toContain("thicknessMm");
  expect(report.parametricModel).toBeNull();
  await expect(page.getByRole("img", { name: "Diagnóstico sobre fotografía original" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByLabel("Ancho exterior (mm)").fill("80");
  await page.getByLabel("Diámetro del agujero 1 (mm)").fill("10");
  await page.getByLabel("¿Qué grosor tendrá la pieza? (mm)").fill("5");
  report = JSON.parse((await diagnostic.textContent())!);
  expect(report.unresolved).toEqual([]);
  expect(report.parametricModel.depth).toBe(5);
  expect(report.parametricModel.entities[0].width).toBe(80);
  await page.getByRole("button", { name: "CONTINUAR" }).click();
  await expect(page.getByRole("heading", { name: "CONFIRMA TU PIEZA" })).toBeVisible();
  await page.getByRole("button", { name: "CONFIRMAR PIEZA" }).click();
  await expect(page.locator(".viewer canvas")).toBeVisible();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.getByRole("button", { name: "Editor avanzado" }).click();
  await expect(page.locator("svg.editor image")).toHaveCount(1);
  await page.locator(".properties select").selectOption({ label: "2. hole" });
  await expect(page.getByLabel("diameter", { exact: true })).toHaveValue("10");
  await page.getByLabel("diameter", { exact: true }).fill("12");
  await expect(page.getByLabel("diameter", { exact: true })).toHaveValue("12");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator(".viewer canvas")).toBeVisible();
});

test("direct edit updates body, hole and thickness from the same part", async ({
  page,
}) => {
  await page.goto("/napkin3d/");
  await page.getByRole("button", { name: "PROYECTO AUTOMÁTICO" }).click();
  await page.locator("input[type=file]").first().setInputFiles({
    name: "direct.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="white"/><rect x="10" y="10" width="80" height="60" fill="none" stroke="black"/><circle cx="50" cy="40" r="8" fill="black"/></svg>',
    ),
  });
  await page.getByLabel("Ancho exterior (mm)").fill("80");
  await page.getByLabel("Diámetro del agujero 1 (mm)").fill("10");
  await page.getByLabel("¿Qué grosor tendrá la pieza? (mm)").fill("5");
  await page.getByRole("button", { name: "CONTINUAR" }).click();
  await page.getByRole("button", { name: "CONFIRMAR PIEZA" }).click();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  const surface = page.locator(".direct-edit-surface");
  await expect(surface).toBeVisible();
  const right = surface.locator('[data-handle="right"]');
  const rightBox = (await right.boundingBox())!;
  await right.dispatchEvent("pointerdown", {
    pointerId: 11,
    pointerType: "touch",
    clientX: rightBox.x,
    clientY: rightBox.y,
  });
  await surface.dispatchEvent("pointermove", {
    pointerId: 11,
    pointerType: "touch",
    clientX: rightBox.x + 24,
    clientY: rightBox.y,
  });
  await surface.dispatchEvent("pointerup", { pointerId: 11, pointerType: "touch" });
  await expect(surface.locator("text").first()).not.toHaveText("80 mm");

  const widthLabel = surface.locator(".dimension-label").nth(0);
  await widthLabel.dispatchEvent("pointerdown", { clientX: 0, clientY: 0 });
  await page.waitForTimeout(850);
  await expect(page.locator(".inline-dimension-input")).toBeVisible();
  await page.locator(".inline-dimension-input").fill("83.5");
  await page.locator(".inline-dimension-input").press("Enter");
  await expect(surface.locator("text").first()).toHaveText("83.5 mm");

  const hole = surface.locator('circle[data-id]').first();
  await hole.click();
  await expect(page.getByText("Ø10 mm", { exact: true })).toBeVisible();
  const center = surface.locator('[data-handle="hole-center"]');
  const centerBox = (await center.boundingBox())!;
  await center.dispatchEvent("pointerdown", { pointerId: 12, pointerType: "touch", clientX: centerBox.x, clientY: centerBox.y });
  await surface.dispatchEvent("pointermove", { pointerId: 12, pointerType: "touch", clientX: centerBox.x + 12, clientY: centerBox.y + 8 });
  await surface.dispatchEvent("pointerup", { pointerId: 12, pointerType: "touch" });
  const diameter = surface.locator('[data-handle="hole-diameter"]');
  const diameterBox = (await diameter.boundingBox())!;
  await diameter.dispatchEvent("pointerdown", { pointerId: 13, pointerType: "touch", clientX: diameterBox.x, clientY: diameterBox.y });
  await surface.dispatchEvent("pointermove", { pointerId: 13, pointerType: "touch", clientX: diameterBox.x + 10, clientY: diameterBox.y });
  await surface.dispatchEvent("pointerup", { pointerId: 13, pointerType: "touch" });

  await page.getByRole("button", { name: /Grosor/ }).click();
  await expect(page.locator(".direct-depth-surface")).toBeVisible();
  const depthHandle = page.locator('.direct-depth-surface [data-handle="depth"]');
  const depthBox = (await depthHandle.boundingBox())!;
  await depthHandle.dispatchEvent("pointerdown", { pointerId: 14, pointerType: "touch", clientX: depthBox.x, clientY: depthBox.y });
  await depthHandle.dispatchEvent("pointermove", { pointerId: 14, pointerType: "touch", clientX: depthBox.x + 18, clientY: depthBox.y });
  await depthHandle.dispatchEvent("pointerup", { pointerId: 14, pointerType: "touch" });
  await page.getByLabel("Grosor directo").fill("6.8");
  await expect(page.locator(".direct-depth-surface text")).toHaveText("6.8 mm");
});

test("automatic photo actions use separate native file inputs", async ({
  page,
}) => {
  const image = {
    name: "photo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="white"/><rect x="10" y="10" width="80" height="60" fill="none" stroke="black"/></svg>',
    ),
  };
  await page.goto("/napkin3d/");
  await page.getByRole("button", { name: "PROYECTO AUTOMÁTICO" }).click();
  await expect(page.locator("#automatic-camera-input")).toHaveAttribute(
    "accept",
    "image/*",
  );
  await expect(page.locator("#automatic-camera-input")).toHaveAttribute(
    "capture",
    "environment",
  );
  await expect(page.locator("#automatic-gallery-input")).toHaveAttribute(
    "accept",
    "image/*",
  );
  await expect(page.locator("#automatic-gallery-input")).not.toHaveAttribute(
    "capture",
  );

  const canceled = page.waitForEvent("filechooser");
  await page.locator('label[for="automatic-camera-input"]').click();
  await (await canceled).setFiles([]);
  await expect(page.getByRole("heading", { name: "NUEVA PIEZA" })).toBeVisible();

  const cameraChooser = page.waitForEvent("filechooser");
  await page.locator('label[for="automatic-camera-input"]').click();
  await (await cameraChooser).setFiles(image);
  await expect(page.getByRole("heading", { name: "REVISA EL BOCETO" })).toBeVisible();

  await page.getByRole("button", { name: "← Inicio" }).click();
  await page.getByRole("button", { name: "PROYECTO AUTOMÁTICO" }).click();
  const galleryChooser = page.waitForEvent("filechooser");
  await page.locator('label[for="automatic-gallery-input"]').click();
  await (await galleryChooser).setFiles(image);
  await expect(page.getByRole("heading", { name: "REVISA EL BOCETO" })).toBeVisible();
});

test("local PaddleOCR returns text detections with positions for a printed synthetic image", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/napkin3d/");
  await page.getByRole("button", { name: "PROYECTO AUTOMÁTICO" }).click();
  await page.locator("input[type=file]").first().setInputFiles({
    name: "printed-dimensions.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="white"/><rect x="100" y="100" width="400" height="220" fill="none" stroke="black" stroke-width="4"/><text x="250" y="75" font-family="Arial" font-size="42" fill="black">80</text><text x="45" y="220" font-family="Arial" font-size="42" fill="black">40</text><text x="450" y="370" font-family="Arial" font-size="42" fill="black">5</text></svg>'),
  });
  await expect(page.getByRole("heading", { name: "REVISA EL BOCETO" })).toBeVisible();
  await page.getByText("LAB · Diagnóstico temporal", { exact: true }).click();
  const diagnostic = page.getByTestId("scan-diagnostic-json");
  await expect.poll(async () => JSON.parse((await diagnostic.textContent())!).ocr.status, { timeout: 60000 }).toBe("READY");
  for (const field of await page.locator(".scan-fields input").all()) await field.fill("12");
  const report = JSON.parse((await diagnostic.textContent())!);
  expect(report.parametricModel).not.toBeNull();
  expect(report.ocr.coordinateSpace).toBe("original-image-pixels");
  expect(report.ocr.detections.length).toBeGreaterThan(0);
  expect(report.ocr.detections.every((d: { bbox: { width: number; height: number }; polygon: unknown[]; text: string }) => d.text && d.bbox.width > 0 && d.bbox.height > 0 && d.polygon.length >= 4)).toBeTruthy();
  expect(report.association.status).toBe("READY");
  await page.getByRole("button", { name: "Ejecutar TEST-002", exact: true }).click();
  const regionsJson = page.getByTestId("ocr-regions-json");
  await expect.poll(async () => {
    const text = await regionsJson.textContent();
    return text ? JSON.parse(text).status : "RUNNING";
  }, { timeout: 150000 }).toBe("READY");
  const regional = JSON.parse((await regionsJson.textContent())!);
  expect(regional.regions.length).toBe(report.ocr.detections.length);
  expect(regional.association).toBe("NOT_IMPLEMENTED");
  for (const region of regional.regions) {
    expect(region.variants).toHaveLength(6);
    expect(region.preview).toMatch(/^data:image\/png/);
    const cropMatchesOriginal = await page.evaluate(async ({ preview, crop }) => {
      const source = document.querySelector('svg[aria-label="Diagnóstico sobre fotografía original"] image')!.getAttribute('href')!;
      const original = new Image(); original.src = source; await original.decode();
      const actual = new Image(); actual.src = preview; await actual.decode();
      const expectedCanvas = document.createElement('canvas'); expectedCanvas.width = crop.width; expectedCanvas.height = crop.height;
      const context = expectedCanvas.getContext('2d')!;
      context.fillStyle = 'white'; context.fillRect(0, 0, crop.width, crop.height);
      context.drawImage(original, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      const expected = context.getImageData(0, 0, crop.width, crop.height).data;
      context.clearRect(0, 0, crop.width, crop.height); context.drawImage(actual, 0, 0);
      return context.getImageData(0, 0, crop.width, crop.height).data.every((value, index) => value === expected[index]);
    }, { preview: region.preview, crop: region.crop });
    expect(cropMatchesOriginal).toBe(true);
    expect(region.crop.x).toBeGreaterThanOrEqual(0);
    expect(region.crop.x + region.crop.width).toBeLessThanOrEqual(600);
    expect(region.crop.y + region.crop.height).toBeLessThanOrEqual(400);
    expect(region.variants[1].width).toBe(region.crop.width * 2);
    for (const variant of region.variants) {
      expect(variant.ocrMs).toBeGreaterThan(0);
      for (const candidate of variant.candidates) {
        expect(candidate.bbox.x).toBeGreaterThanOrEqual(region.crop.x);
        expect(candidate.bbox.y).toBeGreaterThanOrEqual(region.crop.y);
        expect(['dimension-compatible', 'non-dimension-compatible', 'ambiguous']).toContain(candidate.classification);
      }
    }
  }
  expect(regional.regions.some((r: { variants: { candidates: unknown[] }[] }) => r.variants.some(v => v.candidates.length))).toBeTruthy();
  const after = JSON.parse((await diagnostic.textContent())!);
  expect(after).toEqual(report);
  console.log('TEST-002 synthetic timings', JSON.stringify(regional.timings));
  console.log('TEST-002 candidates', JSON.stringify(regional.regions.map((r: { baseline: { text: string }; variants: { name: string; ocrMs: number; candidates: { text: string }[] }[] }) => ({ baseline: r.baseline.text, variants: r.variants.map(v => ({ name: v.name, ms: v.ocrMs, texts: v.candidates.map(c => c.text) })) }))));
});
