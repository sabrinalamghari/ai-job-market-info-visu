const JobData = (() => {
  const textColumns = ["job_id", "job_title", "job_category", "experience_level", "education_required", "city", "country", "remote_work", "company_size", "industry", "required_skills", "salary_tier"];
  const numberColumns = ["years_of_experience", "annual_salary_usd", "salary_min_usd", "salary_max_usd", "ai_salary_premium_pct", "demand_score", "demand_growth_yoy_pct", "benefits_score_10", "posting_year", "posting_month"];
  const booleanColumns = ["is_senior", "is_remote_friendly", "is_llm_role"];
  const requiredColumns = [...textColumns, ...numberColumns, ...booleanColumns];
  const experienceRanges = {
    "Entry (0-2 yrs)": [0, 2],
    "Mid (3-5 yrs)": [3, 5],
    "Senior (6-9 yrs)": [6, 9],
    "Lead (10+ yrs)": [10, Infinity],
  };

  function transformJob(row) {
    const job = {};
    const issues = [];
    const addIssue = (code, columns) => issues.push({ code, columns });
    for (const column of textColumns) {
      job[column] = String(row[column] ?? "").trim();
      if (!job[column]) addIssue("missing_value", [column]);
    }

    for (const column of numberColumns) {
      const value = String(row[column] ?? "").trim();
      const number = value === "" ? NaN : Number(value);
      job[column] = Number.isFinite(number) ? number : null;
      if (job[column] === null) {
        addIssue(value === "" ? "missing_value" : "invalid_number", [column]);
      }
    }

    for (const column of booleanColumns) {
      const value = String(row[column] ?? "").trim();
      job[column] = value === "1" ? true : value === "0" ? false : null;
      if (job[column] === null) {
        addIssue(value === "" ? "missing_value" : "invalid_boolean", [column]);
      }
    }

    const skills = job.required_skills.split("|").map(skill => skill.trim()).filter(Boolean);
    job.required_skills = [...new Set(skills)];
    if (skills.length !== job.required_skills.length) {
      addIssue("duplicate_skills", ["required_skills"]);
    }

    const range = experienceRanges[job.experience_level];
    if (!range) addIssue("unknown_experience_level", ["experience_level"]);
    if (job.years_of_experience !== null) {
      if (!Number.isInteger(job.years_of_experience) || job.years_of_experience < 0) {
        addIssue("invalid_experience_years", ["years_of_experience"]);
      } else if (range && (job.years_of_experience < range[0] || job.years_of_experience > range[1])) {
        addIssue("experience_mismatch", ["experience_level", "years_of_experience"]);
      }
    }

    const salaryColumns = ["annual_salary_usd", "salary_min_usd", "salary_max_usd"];
    for (const column of salaryColumns) {
      if (job[column] !== null && job[column] < 0) addIssue("negative_salary", [column]);
    }
    if (job.salary_min_usd !== null && job.salary_max_usd !== null) {
      if (job.salary_min_usd > job.salary_max_usd) {
        addIssue("reversed_salary_range", ["salary_min_usd", "salary_max_usd"]);
      } else if (job.annual_salary_usd !== null &&
        (job.annual_salary_usd < job.salary_min_usd || job.annual_salary_usd > job.salary_max_usd)) {
        addIssue("salary_outside_range", salaryColumns);
      }
    }

    const knownRemote = ["On-site", "Hybrid", "Fully Remote"].includes(job.remote_work);
    if (!knownRemote) addIssue("unknown_remote_work", ["remote_work"]);
    if (knownRemote && job.is_remote_friendly !== null &&
      job.is_remote_friendly !== (job.remote_work !== "On-site")) {
      addIssue("remote_flag_mismatch", ["remote_work", "is_remote_friendly"]);
    }
    if (range && job.is_senior !== null &&
      job.is_senior !== ["Senior (6-9 yrs)", "Lead (10+ yrs)"].includes(job.experience_level)) {
      addIssue("senior_flag_mismatch", ["experience_level", "is_senior"]);
    }
    job.has_geographic_location = Boolean(job.city && job.country &&
      job.city !== "Remote" && job.country !== "Global");
    if ((job.city === "Remote" || job.country === "Global") && job.remote_work === "On-site") {
      addIssue("remote_location_onsite", ["city", "country", "remote_work"]);
    }

    const validPeriod = Number.isInteger(job.posting_year) && job.posting_year >= 1 && Number.isInteger(job.posting_month) && job.posting_month >= 1 && job.posting_month <= 12;
    job.posting_period = validPeriod
      ? `${job.posting_year}-${String(job.posting_month).padStart(2, "0")}` : null;
    if (!validPeriod) addIssue("invalid_posting_period", ["posting_year", "posting_month"]);
    job.issues = issues;
    return job;
  }

  function prepareData(rows, columns = rows.columns ?? Object.keys(rows[0] ?? {})) {
    const missingColumns = requiredColumns.filter(column => !columns.includes(column));
    if (missingColumns.length) {
      throw new Error(`Colonnes manquantes : ${missingColumns.join(", ")}`);
    }

    const jobs = rows.map(transformJob);
    const ids = new Set();
    const issueCounts = {};
    for (const job of jobs) {
      if (job.job_id && ids.has(job.job_id)) {
        job.issues.push({ code: "duplicate_job_id", columns: ["job_id"] });
      }
      if (job.job_id) ids.add(job.job_id);
      for (const code of new Set(job.issues.map(issue => issue.code))) {
        issueCounts[code] = (issueCounts[code] ?? 0) + 1;
      }
    }
    return {
      jobs,
      quality: {
        rowCount: jobs.length,
        rowsWithIssues: jobs.filter(job => job.issues.length > 0).length,
        issueCounts,
      },
    };
  }

  return { requiredColumns, prepareData };
})();

if (typeof module !== "undefined" && module.exports) module.exports = JobData;