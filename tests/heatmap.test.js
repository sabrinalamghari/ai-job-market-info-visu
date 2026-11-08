const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const HeatmapData = require("../visualizations/visualization-3/visualization-3.js");
const JobData = require("../js/data.js");

test("une offre ne compte qu’une fois par compétence ; zéro et absence d’offres sont distincts", () => {
  const profiles = HeatmapData.aggregateByJob([
    { job_title: "A", required_skills: ["Python", "Python", "SQL"] },
    { job_title: "A", required_skills: ["SQL"] },
  ], ["A", "B"]);
  assert.deepEqual(HeatmapData.cell(profiles[0], "Python"), { job: "A", skill: "Python", count: 1, total: 2, rate: 0.5 });
  assert.equal(HeatmapData.cell(profiles[0], "ROS").rate, 0);
  assert.equal(HeatmapData.cell(profiles[1], "Python").rate, null);
});

test("les filtres changent le dénominateur, la sélection des colonnes ne le change pas", () => {
  const rows = [
    { job_title: "A", country: "France", required_skills: ["Python"] },
    { job_title: "A", country: "France", required_skills: ["SQL"] },
    { job_title: "A", country: "USA", required_skills: ["Python"] },
  ];
  const [profile] = HeatmapData.aggregateByJob(rows.filter(row => row.country === "France"));
  assert.equal(HeatmapData.cell(profile, "Python").rate, 0.5);
  HeatmapData.orderProfiles([profile], ["Python"], "similarity");
  HeatmapData.orderSkills(["Python"], [profile], "count");
  assert.equal(HeatmapData.cell(profile, "Python").total, 2);
});

test("les tris préservent les profils et placent les métiers sans offres en fin de similarité", () => {
  const profiles = HeatmapData.aggregateByJob([
    { job_title: "A", required_skills: ["X"] },
    { job_title: "B", required_skills: ["Y"] },
    { job_title: "C", required_skills: ["X"] },
  ], ["A", "B", "C", "D"]);
  assert.deepEqual(HeatmapData.orderProfiles(profiles, ["X", "Y"], "similarity").map(profile => profile.job), ["A", "C", "B", "D"]);
  assert.deepEqual(profiles.map(profile => profile.job), ["A", "B", "C", "D"]);
  assert.deepEqual(HeatmapData.orderSkills(["X", "Y"], [], "similarity"), ["X", "Y"]);
  assert.deepEqual(HeatmapData.topSkills(profiles, 1), ["X"]);
});

test("le CSV réel produit 25 métiers, 93 compétences et des comptes exacts après préparation commune", async () => {
  const { csvParse } = await import("d3");
  const source = fs.readFileSync(path.join(__dirname, "../data/ai_jobs_market_2025_2026.csv"), "utf8");
  const { jobs } = JobData.prepareData(csvParse(source));
  const profiles = HeatmapData.aggregateByJob(jobs);
  assert.equal(profiles.length, 25);
  assert.equal(HeatmapData.skillCounts(profiles).size, 93);
  assert.equal(HeatmapData.skillCounts(profiles).get("Python"), 942);
  const llm = profiles.find(profile => profile.job === "LLM Engineer");
  assert.equal(HeatmapData.cell(llm, "RAG").count, 63);
  assert.equal(HeatmapData.cell(llm, "RAG").total, 75);
  assert.equal(HeatmapData.cell(llm, "RAG").rate, 0.84);
  for (const profile of profiles) for (const count of profile.skills.values()) assert.ok(count <= profile.count);
  const filtered = jobs.filter(job => job.country === "France" && job.experience_level === "Entry (0-2 yrs)");
  const subset = HeatmapData.aggregateByJob(filtered, profiles.map(profile => profile.job));
  assert.equal(subset.reduce((sum, profile) => sum + profile.count, 0), filtered.length);
});
