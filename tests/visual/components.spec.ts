"use strict";

import { expect, test } from "@playwright/test";

const cases = [
  { name: "repo-card", path: "/showcase?component=repo-card" },
  { name: "commit-graph", path: "/showcase?component=commit-graph" },
  { name: "activity-graph", path: "/showcase?component=activity-graph" },
  { name: "file-tree", path: "/showcase?component=file-tree" },
];

for (const componentCase of cases) {
  test(`${componentCase.name} visual`, async ({ page }) => {
    await page.goto(componentCase.path, { waitUntil: "networkidle" });
    const preview = page.getByTestId(`${componentCase.name}-preview`);
    await expect(preview).toBeVisible();
    await expect(preview).toHaveScreenshot(`${componentCase.name}.png`, {
      animations: "disabled",
      caret: "hide",
      scale: "device",
    });
  });
}
