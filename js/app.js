const JobApp = (() => {
  const csvUrl = new URL("../data/ai_jobs_market_2025_2026.csv", document.currentScript.src);
  const status = document.getElementById("data-status");
  const listeners = new Set();
  const emptyFilters = { job_category: "", job_family: "", experience_level: "", country: "", remote_work: "", industry: "", company_size: "", education_required: "" };
  let state = null;
  const filterControls = document.getElementById("global-filters");
  const filterLabels = { job_family: "Famille de métiers", experience_level: "Expérience", country: "Pays", remote_work: "Mode de travail" };
  if (filterControls?.dataset?.careerFilters === "true") Object.assign(filterLabels, { industry: "Secteur", company_size: "Taille d’entreprise", education_required: "Formation demandée" });
  const selects = {};
  let advancedFilters = null, advancedSummary = null, advancedFields = null;
  if (filterControls?.dataset?.careerFilters === "true") {
    advancedFilters = document.createElement("details");
    advancedFilters.className = "parallel-options global-filter-options";
    advancedSummary = document.createElement("summary");
    advancedSummary.textContent = "Plus de filtres";
    advancedFilters.append(advancedSummary);
    advancedFields = document.createElement("div");
    advancedFields.className = "global-filter-fields";
    advancedFilters.append(advancedFields);
  }
  for (const [column, label] of Object.entries(filterLabels)) {
    // Les pages comme la carte possèdent leurs propres contrôles.
    if (!filterControls) break;
    const field = document.createElement("label");
    field.textContent = label;
    const select = document.createElement("select");
    select.addEventListener("change", () => setFilters({ [column]: select.value }));
    field.append(select);
    const advanced = advancedFilters && ["job_family", "industry", "company_size", "education_required"].includes(column);
    (advanced ? advancedFields : filterControls).append(field);
    selects[column] = select;
  }
  if (advancedFilters) filterControls.append(advancedFilters);

  function notify() {
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (error) {
        console.error("Erreur dans une visualisation :", error);
      }
    }
  }

  function updateFilteredJobs() {
    if (advancedSummary) {
      const active = ["job_family", "industry", "company_size", "education_required"].filter(key => state.filters[key]).length;
      advancedSummary.textContent = `Plus de filtres${active ? ` (${active} actifs)` : ""}`;
    }
    for (const [column, select] of Object.entries(selects)) {
      const values = [...new Set(state.jobs.map(job => job[column]).filter(Boolean))].sort();
      select.replaceChildren(new Option("Tous", ""), ...values.map(value => new Option(value, value)));
      select.value = state.filters[column];
    }
    state.filteredJobs = state.jobs.filter(job =>
      Object.entries(state.filters).every(([column, value]) => !value || job[column] === value)
    );
    const count = state.filteredJobs.length;
    status.textContent = `${new Intl.NumberFormat("fr-FR").format(count)} offre${count === 1 ? "" : "s"}`;
    notify();
  }

  function subscribe(listener) {
    listeners.add(listener);
    if (state) listener(state);
    return () => listeners.delete(listener);
  }

  function setFilters(changes) {
    if (!state) return;
    for (const column of Object.keys(changes)) {
      if (!(column in emptyFilters)) throw new Error(`Filtre inconnu : ${column}`);
      if (typeof changes[column] !== "string") throw new Error("Un filtre doit être un texte.");
    }
    state.filters = { ...state.filters, ...changes };
    updateFilteredJobs();
  }

  function resetFilters() {
    if (!state) return;
    state.filters = { ...emptyFilters };
    updateFilteredJobs();
  }

  async function loadData() {
    status.textContent = "Chargement des données…";
    try {
      const rows = await d3.csv(csvUrl);
      const { jobs, quality } = JobData.prepareData(rows);
      state = { jobs, filteredJobs: jobs, quality, filters: { ...emptyFilters } };
      console.log("Bilan de qualité des données :", quality);
      updateFilteredJobs();
    } catch (error) {
      console.error("Impossible de charger les données :", error);
      status.textContent = `Erreur : ${error.message}${state ? " — données précédentes conservées." : ""}`;
    }
  }

  loadData();

  return { subscribe, setFilters, resetFilters };
})();
