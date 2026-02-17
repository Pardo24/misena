/**
 * One-time script to populate the database with recipes, images, and tags.
 *
 * Usage: node scripts/populate-all.mjs [--base http://localhost:3000]
 *
 * Steps:
 *   1. Import current week's menu from hfresh
 *   2. Import recipes from hfresh (all pages)
 *   3. Populate images for recipes missing them
 *   4. Auto-classify all recipes with tags
 */

const BASE = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] || "http://localhost:3000";
const DELAY_BETWEEN_PAGES = 5000; // 5s between page imports
const DELAY_BETWEEN_STEPS = 3000; // 3s between major steps

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path) {
  const url = `${BASE}${path}`;
  console.log(`  POST ${url}`);
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const text = await res.text();
    console.error(`  ERROR ${res.status}: ${text}`);
    return null;
  }
  return res.json();
}

// ── Step 1: Import current week's menu ──

async function importCurrentWeekMenu() {
  console.log("\n═══ Step 1: Import current week's menu ═══");

  // Get current year-week in YYYYWW format
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - jan1) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  const yearWeek = `${now.getFullYear()}${String(week).padStart(2, "0")}`;

  console.log(`  Current week: ${yearWeek}`);

  const result = await post(`/api/recipes/hfresh-import?menu=${yearWeek}`);
  if (result) {
    console.log(`  Menu import: ${result.imported ?? 0} imported, ${result.skipped ?? 0} skipped`);
  }
  return result;
}

// ── Step 2: Import all recipes from hfresh (paginated) ──

async function importAllRecipes() {
  console.log("\n═══ Step 2: Import recipes from hfresh ═══");

  let page = 1;
  let totalPages = 1;
  let totalImported = 0;
  let totalSkipped = 0;

  while (page <= totalPages) {
    console.log(`\n  Page ${page}/${totalPages}...`);
    const result = await post(`/api/recipes/hfresh-import?page=${page}&perPage=50`);

    if (!result) {
      console.error(`  Failed on page ${page}, stopping.`);
      break;
    }

    totalPages = result.totalPages;
    totalImported += result.imported ?? 0;
    totalSkipped += result.skipped ?? 0;

    console.log(`  Imported: ${result.imported}, Skipped: ${result.skipped}`);
    if (result.failed?.length) {
      console.log(`  Failed: ${result.failed.length}`);
      for (const f of result.failed.slice(0, 3)) {
        console.log(`    - ${f.name}: ${f.reason}`);
      }
    }

    console.log(`  Progress: page ${page}/${totalPages}, total imported so far: ${totalImported}`);

    page++;
    if (page <= totalPages) {
      console.log(`  Waiting ${DELAY_BETWEEN_PAGES / 1000}s before next page...`);
      await sleep(DELAY_BETWEEN_PAGES);
    }
  }

  console.log(`\n  Done! Total imported: ${totalImported}, skipped: ${totalSkipped}`);
}

// ── Step 3: Populate images ──

async function populateImages() {
  console.log("\n═══ Step 3: Populate images ═══");
  const result = await post("/api/recipes/populate-images");
  if (result) {
    console.log(`  Updated: ${result.updated}/${result.total}`);
    if (result.failed?.length) {
      console.log(`  Failed: ${result.failed.length}`);
    }
  }
}

// ── Step 4: Auto-classify ──

async function autoClassify() {
  console.log("\n═══ Step 4: Auto-classify recipes ═══");

  // Dry run first
  console.log("  Dry run...");
  const preview = await post("/api/recipes/auto-classify?dryRun=true");
  if (preview) {
    console.log(`  Would classify: ${preview.classified}/${preview.total} recipes`);
  }

  await sleep(1000);

  // Apply
  console.log("  Applying tags...");
  const result = await post("/api/recipes/auto-classify");
  if (result) {
    console.log(`  Classified: ${result.classified}/${result.total} recipes`);
  }
}

// ── Main ──

async function main() {
  console.log(`\nPopulate script starting...`);
  console.log(`Base URL: ${BASE}`);
  console.log(`Make sure 'pnpm dev' is running!\n`);

  // Step 1: Current week menu (skip errors silently - menu endpoint may not be wired up yet)
  try {
    await importCurrentWeekMenu();
  } catch (e) {
    console.log("  (Skipping menu import - endpoint not available)");
  }

  await sleep(DELAY_BETWEEN_STEPS);

  // Step 2: Import all recipes
  await importAllRecipes();

  await sleep(DELAY_BETWEEN_STEPS);

  // Step 3: Populate images for any recipes still missing them
  await populateImages();

  await sleep(DELAY_BETWEEN_STEPS);

  // Step 4: Auto-classify
  await autoClassify();

  console.log("\n═══ All done! ═══\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
