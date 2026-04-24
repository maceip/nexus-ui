Target screenshots for manual comparison can be stored in `tests/visual/targets/`.

Current automated coverage uses Playwright snapshot assertions against checked-in
component screenshots generated from `/showcase`.

Commands:
- `npm run test:visual` — run visual regression tests
- `npm run test:visual:update` — refresh Playwright snapshots after intentional UI changes
- `npm run test:visual:install` — install Playwright browser dependencies
