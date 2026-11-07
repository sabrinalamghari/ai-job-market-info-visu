const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const JobData = require("../js/data.js");
const ParallelData = require("../visualizations/visualization-2/visualization-2.js");

test("CSV réel : 1500 offres, 25 profils complets, filtres avant agrégation", async () => {
  const d3 = await import("d3");
  const rows = d3.csvParse(fs.readFileSync("data/ai_jobs_market_2025_2026.csv", "utf8"));
  const { jobs, quality } = JobData.prepareData(rows);
  const families = new Map();
  for (const job of jobs) {
    if (!families.has(job.job_family)) families.set(job.job_family, new Set());
    families.get(job.job_family).add(job.job_title);
  }
  assert.equal(families.size, 5);
  assert.deepEqual([...families.values()].map(titles => titles.size).sort((a, b) => a - b), [2, 3, 3, 3, 14]);
  const platformJobs = jobs.filter(row => row.job_family === "Plateformes et déploiement");
  assert.equal(ParallelData.aggregateByJob(platformJobs).length, 3);
  assert.deepEqual([...new Set(platformJobs.map(row => row.job_category))].sort(), ["Architecture", "Infrastructure", "ML Operations"]);
  const profiles = ParallelData.aggregateByJob(jobs);
  assert.equal(jobs.length, 1500);
  assert.equal(profiles.length, 25);
  assert.equal(profiles.reduce((sum, row) => sum + row.count, 0), jobs.length);
  for (const profile of profiles) {
    assert.ok(ParallelData.dimensions.every(axis => Number.isFinite(profile[axis.key])));
    const offers = jobs.filter(job => job.job_title === profile.job);
    assert.equal(profile.salaryMedian, d3.median(offers, row => row.annual_salary_usd));
    assert.equal(profile.demandMean, d3.mean(offers, row => row.demand_score));
    assert.equal(profile.remoteRate, offers.filter(row => row.remote_work !== "On-site").length / offers.length);
  }
  const filtered = jobs.filter(row => row.country === "France" && row.experience_level === "Entry (0-2 yrs)");
  assert.ok(filtered.length > 0);
  const juniorProfiles = ParallelData.aggregateByJob(filtered);
  assert.equal(juniorProfiles.reduce((sum, row) => sum + row.count, 0), filtered.length);
  assert.ok(juniorProfiles.every(row => row.entryRate === 1));
  console.log(JSON.stringify({ columns: rows.columns, quality, franceEntry: filtered.length }));
  for (const column of ["annual_salary_usd", "demand_score", "demand_growth_yoy_pct", "benefits_score_10"]) {
    const values = jobs.map(row => row[column]).sort(d3.ascending);
    const q1 = d3.quantile(values, .25), q3 = d3.quantile(values, .75), iqr = q3 - q1;
    console.log(column, JSON.stringify({ extent: d3.extent(values), iqrOutliers: values.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length }));
  }
});

test("métriques : médiane paire, inconnus exclus, effectifs et égalités", () => {
  const profiles = ParallelData.aggregateByJob([
    { job_title: "A", annual_salary_usd: 100, demand_score: 80, demand_growth_yoy_pct: -5, benefits_score_10: 8, remote_work: "Hybrid", experience_level: "Entry (0-2 yrs)", issues: [{}] },
    { job_title: "A", annual_salary_usd: 200, demand_score: null, demand_growth_yoy_pct: 15, benefits_score_10: 11, remote_work: "Unknown", experience_level: "Mid (3-5 yrs)" },
    { job_title: "A", annual_salary_usd: null, demand_score: 100, demand_growth_yoy_pct: null, benefits_score_10: null, remote_work: "Fully Remote", experience_level: "Unknown" },
  ]);
  const row = profiles[0];
  assert.equal(row.salaryMedian, 150);
  assert.equal(row.demandMean, 90);
  assert.equal(row.growthMean, 5);
  assert.equal(row.benefitsMean, 8);
  assert.equal(row.remoteRate, 1);
  assert.equal(row.entryRate, .5);
  assert.equal(row.validCounts.remoteRate, 2);
  assert.equal(row.issueCount, 1);
  assert.equal(row.experience, "Entry (0-2 yrs) / Mid (3-5 yrs) / Unknown");
  assert.equal(ParallelData.aggregateByJob([{ job_title: "Empty" }])[0].salaryMedian, null);
  assert.deepEqual(ParallelData.aggregateByJob([]), []);
});

test("les brushes combinent leurs plages avec ET et excluent les valeurs inconnues", () => {
  const ranges = new Map([["salaryMedian", [100, 200]], ["remoteRate", [.5, 1]]]);
  assert.ok(ParallelData.matchesBrushes({ salaryMedian: 150, remoteRate: .5 }, ranges));
  assert.ok(!ParallelData.matchesBrushes({ salaryMedian: 150, remoteRate: .4 }, ranges));
  assert.ok(!ParallelData.matchesBrushes({ salaryMedian: null, remoteRate: .8 }, ranges));
  assert.ok(ParallelData.matchesBrushes({}, new Map()));
});

test("profils guidés réels, entonnoir et références recalculées après filtre", async () => {
  const d3 = await import("d3");
  const { jobs } = JobData.prepareData(d3.csvParse(fs.readFileSync("data/ai_jobs_market_2025_2026.csv", "utf8")));
  const profiles = ParallelData.aggregateByJob(jobs).filter(ParallelData.eligible);
  const stats = ParallelData.statistics(profiles);
  assert.equal(profiles.length, 25);
  assert.equal(stats.salaryMedian.median, 185000);
  const names = preset => profiles.filter(row => ParallelData.matchesBrushes(row, ParallelData.presetRanges(preset, stats))).map(row => row.job);
  assert.deepEqual(names("sweet"), ["RAG Engineer"]);
  assert.deepEqual(names("reward"), ["Senior ML Engineer"]);
  assert.ok(names("balanced").includes("Data Engineer (AI)"));
  const ranges = new Map();
  const counts = [];
  for (const [key, min] of [["entryRate", .30], ["remoteRate", .75], ["demandMean", 89], ["salaryMedian", 185000]]) {
    ranges.set(key, [min, Infinity]);
    counts.push(profiles.filter(row => ParallelData.matchesBrushes(row, ranges)).length);
  }
  assert.deepEqual(counts, [5, 4, 1, 1]);
  const junior = ParallelData.aggregateByJob(jobs.filter(row => row.experience_level === "Entry (0-2 yrs)")).filter(ParallelData.eligible);
  const juniorStats = ParallelData.statistics(junior);
  assert.equal(juniorStats.entryRate.min, 1);
  assert.equal(juniorStats.entryRate.max, 1);
  assert.notEqual(juniorStats.salaryMedian.median, stats.salaryMedian.median);
  const empty = ParallelData.statistics([]);
  assert.equal(empty.salaryMedian.median, null);
  assert.doesNotThrow(() => ParallelData.presetRanges("sweet", empty));
});

test("quartiles interpolés, rang des égalités et effectif minimum par métrique", () => {
  assert.equal(ParallelData.quantile([0, 10, 20, 30, null], .25), 7.5);
  const rows = Array.from({ length: 10 }, () => ({ job_title: "A", annual_salary_usd: 100, demand_score: 80, demand_growth_yoy_pct: 5, benefits_score_10: 8, experience_level: "Entry (0-2 yrs)", remote_work: "Hybrid" }));
  const profile = ParallelData.aggregateByJob(rows)[0];
  assert.ok(ParallelData.eligible(profile));
  assert.ok(!ParallelData.eligible(ParallelData.aggregateByJob(rows.slice(1))[0]));
  assert.ok(!ParallelData.eligible(ParallelData.aggregateByJob(rows.map((row, i) => i ? row : { ...row, demand_score: null }))[0]));
  const stats = ParallelData.statistics([profile, profile]);
  assert.equal(ParallelData.comparison(profile, ParallelData.dimensions[0], stats, [profile, profile]).percentile, 50);
});

test("hidden gems : profil solide sans maximum, axes constants exclus", () => {
  const keys = ParallelData.dimensions.map(axis => axis.key);
  const make = (job, values) => ({ job, ...Object.fromEntries(keys.map((key, i) => [key, values[i]])) });
  const stats = Object.fromEntries(keys.map(key => [key, { min: 0, q1: 25, median: 50, q3: 75, max: 100 }]));
  const candidates = [
    make("Solide", [60, 60, 60, 60, 30, 30]),
    make("Maximum", [100, 60, 60, 60, 30, 30]),
    make("Faiblesse", [60, 60, 60, 60, 20, 30]),
    make("Modéré", [60, 60, 60, 30, 30, 30]),
  ];
  assert.deepEqual(ParallelData.hiddenGems(candidates, stats).map(row => row.job), ["Solide"]);
  const constantStats = Object.fromEntries(keys.map(key => [key, { min: 60, q1: 60, median: 60, q3: 60, max: 60 }]));
  assert.deepEqual(ParallelData.hiddenGems([make("Constant", keys.map(() => 60))], constantStats), []);
  assert.deepEqual(ParallelData.hiddenGems([], ParallelData.statistics([])), []);
});

test("un CSV incompatible est rejeté explicitement par le chargement commun", () => {
  assert.throws(() => JobData.prepareData([{ job_title: "A" }]), /Colonnes manquantes/);
});

test("les catégories inconnues sont regroupées sans altérer leur libellé original", async () => {
  const d3 = await import("d3");
  const rows = d3.csvParse(fs.readFileSync("data/ai_jobs_market_2025_2026.csv", "utf8"));
  const row = { ...rows[0], job_category: "New category" };
  const unknown = JobData.prepareData([row]).jobs[0];
  assert.equal(unknown.job_family, "Autres métiers");
  assert.equal(unknown.job_category, "New category");
  assert.equal(row.job_category, "New category");
  const missing = JobData.prepareData([{ ...row, job_category: "" }]).jobs[0];
  assert.equal(missing.job_family, "");
});

test("JobApp charge le CSV fixe depuis son script sans sélecteur de fichier", async () => {
  const status = { textContent: "" };
  const jobs = [{ country: "France" }, { country: "USA" }];
  let requestedUrl;
  const requestedElements = [];
  const context = vm.createContext({
    URL, console: { log() {}, error(error) { throw error; } },
    document: {
      currentScript: { src: "http://localhost:3000/js/app.js" },
      getElementById(id) { requestedElements.push(id); return id === "data-status" ? status : null; },
    },
    d3: { async csv(url) { requestedUrl = String(url); return []; } },
    JobData: { prepareData() { return { jobs, quality: {} }; } },
  });
  vm.runInContext(fs.readFileSync("js/app.js", "utf8"), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requestedUrl, "http://localhost:3000/data/ai_jobs_market_2025_2026.csv");
  assert.ok(!requestedElements.includes("csv-file"));
  assert.equal(status.textContent, "2 offres");
  vm.runInContext('JobApp.setFilters({ country: "France" })', context);
  assert.equal(status.textContent, "1 offre");
});

test("les pages carte et coordonnées parallèles référencent des ressources locales existantes", () => {
  for (const filename of ["index.html", "visualizations/visualization-1/visualization-1.html", "visualizations/visualization-2/visualization-2.html"]) {
    const html = fs.readFileSync(filename, "utf8");
    for (const [, reference] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (reference.startsWith("#") || /^https?:/.test(reference)) continue;
      assert.ok(fs.existsSync(path.resolve(path.dirname(filename), reference)), `${filename} : ${reference}`);
    }
  }
});
