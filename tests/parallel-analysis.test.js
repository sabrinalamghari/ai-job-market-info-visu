const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const P = require("../visualizations/visualization-2/visualization-2.js");
const JobData = require("../js/data.js");
const keys = P.dimensions.map(axis => axis.key);
const profile = (job, values) => ({ job, ...Object.fromEntries(keys.map((key, i) => [key, values[i]])) });

test("distance : normalisation, poids égaux, symétrie et trois voisins déterministes", () => {
  const a = profile("A", [0, 100000, 0, 0, 0, 0]);
  const b = profile("B", [1, 200000, 1, 1, 1, 1]);
  const c = profile("C", [.5, 150000, .5, .5, .5, .5]);
  const stats = P.statistics([a, b, c]);
  assert.equal(P.distance(a, b, stats), 1);
  assert.equal(P.distance(a, c, stats), .5);
  assert.equal(P.distance(a, b, stats), P.distance(b, a, stats));
  assert.deepEqual(P.similar(a, [a, b, c, { ...c, job: "D" }, { ...c, job: "E" }], stats).map(row => row.profile.job), ["C", "D", "E"]);
  assert.equal(P.distance(a, { ...b, salaryMedian: null }, stats), null);
  assert.equal(P.distance(a, { ...b, demandMean: NaN }, stats), null);
  assert.deepEqual(P.similar(a, [a], stats), []);
});

test("axes constants, profils identiques et absence de données", () => {
  const a = profile("A", keys.map(() => 2));
  const b = { ...a, job: "B" };
  const stats = P.statistics([a, b]);
  assert.equal(P.distance(a, b, stats), 0);
  assert.equal(P.similar(a, [a, b], stats)[0].distance, 0);
  assert.deepEqual(P.atypical([a, b], stats), []);
  assert.equal(P.correlation([a, b, a], "entryRate", "salaryMedian").value, null);
  assert.equal(P.relationship(a, "entryRate", "salaryMedian", stats), null);
  assert.deepEqual(P.atypical([], P.statistics([])), []);
  assert.equal(P.distance(a, b, P.statistics([])), null);
});

test("un axe constant n’affaiblit pas la distance des axes variables", () => {
  const a = profile("A", [0, 100000, 1, 1, 1, 1]);
  const b = profile("B", [1, 200000, 1, 1, 1, 1]);
  assert.equal(P.distance(a, b, P.statistics([a, b])), 1);
});

test("Pearson : positif, négatif, égalités, données manquantes et petits groupes", () => {
  const rows = [1, 2, 2, 4].map(x => ({ a: x, b: x * 20000, c: -x }));
  assert.equal(P.correlation(rows, "a", "b").value, 1);
  assert.equal(P.correlation(rows, "a", "c").value, -1);
  assert.equal(P.correlation([...rows, { a: null, b: 0 }], "a", "b").n, 4);
  assert.equal(P.correlation(rows.slice(0, 2), "a", "b").value, null);
  assert.deepEqual(P.correlation([], "a", "b"), { n: 0, value: null });
});

test("atypicité : distance au profil médian et principales contributions", () => {
  const rows = [profile("A", [0, 0, 0, 0, 0, 0]), profile("B", [.1, .1, .1, .1, .1, .1]), profile("C", [1, .1, .1, .1, .1, .1])];
  const result = P.atypical(rows, P.statistics(rows));
  // A differs on five other dimensions; the largest departure is therefore A.
  assert.equal(result[0].profile.job, "A");
  const c = result.find(row => row.profile.job === "C");
  assert.equal(c.contributions[0].key, "entryRate");
  assert.equal(c.distance, Math.sqrt(.81 / 6));
  assert.ok(!result.some(row => row.profile.job === "B"));
});

test("relations : valeurs élevées, faibles et compromis définis par quartiles", () => {
  const rows = [0, .25, .5, .75, 1].map((v, i) => profile(String(i), keys.map(() => v)));
  const stats = P.statistics(rows);
  assert.equal(P.relationship(rows[4], keys[0], keys[1], stats), "high");
  assert.equal(P.relationship(rows[0], keys[0], keys[1], stats), "low");
  assert.equal(P.relationship({ ...rows[4], salaryMedian: 0 }, keys[0], keys[1], stats), "tradeoff");
  assert.equal(P.relationship(rows[2], keys[0], keys[1], stats), null);
});

test("salaire Entry : libellé exact, salaires valides uniquement, seuil de dix", () => {
  const base = { job_title: "A", demand_score: 80, demand_growth_yoy_pct: 5, benefits_score_10: 8, remote_work: "Hybrid" };
  const rows = Array.from({ length: 10 }, () => ({ ...base, annual_salary_usd: 100, experience_level: "Entry (0-2 yrs)" }));
  rows.push({ ...base, annual_salary_usd: 1000, experience_level: "Senior (6-9 yrs)" });
  rows.push({ ...base, annual_salary_usd: null, experience_level: "Entry (0-2 yrs)" });
  rows.push({ ...base, annual_salary_usd: -1, experience_level: "Entry (0-2 yrs)" });
  const entry = P.aggregateByJob(rows, "job_title", "entry")[0];
  assert.equal(entry.salaryMedian, 100);
  assert.equal(entry.validCounts.salaryMedian, 10);
  assert.ok(P.eligible(entry));
  assert.ok(!P.eligible(P.aggregateByJob(rows.slice(1), "job_title", "entry")[0]));
  const absent = P.aggregateByJob(rows.filter(row => row.experience_level.startsWith("Senior")), "job_title", "entry")[0];
  assert.equal(absent.salaryMedian, null);
  assert.equal(absent.validCounts.salaryMedian, 0);
});

test("CSV réel : références Entry, brushes vides et regroupement par famille", async () => {
  const d3 = await import("d3");
  const jobs = JobData.prepareData(d3.csvParse(fs.readFileSync("data/ai_jobs_market_2025_2026.csv", "utf8"))).jobs;
  for (const column of ["job_title", "job_family"]) {
    for (const mode of ["global", "entry"]) {
      const profiles = P.aggregateByJob(jobs, column, mode).filter(P.eligible);
      assert.ok(profiles.length > 0);
      const stats = P.statistics(profiles);
      for (const row of profiles) {
        const salaries = jobs.filter(job => job[column] === row.job && (mode !== "entry" || job.experience_level === "Entry (0-2 yrs)")).map(job => job.annual_salary_usd);
        assert.equal(row.salaryMedian, d3.median(salaries));
        assert.ok(Number.isFinite(P.distance(row, row, stats)));
      }
      assert.equal(profiles.filter(row => P.matchesBrushes(row, new Map([["entryRate", [2, 3]]]))).length, 0);
      assert.deepEqual(P.atypical([], stats), []);
    }
  }
});
