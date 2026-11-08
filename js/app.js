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

  let activeDatasetName = "ai_jobs_market_2025_2026.csv";

  function updateDatasetNameDisplay() {
    const displays = document.querySelectorAll("#map-dataset-name, [data-dataset-name]");
    const count = state?.jobs?.length ?? 0;
    const countStr = new Intl.NumberFormat("fr-FR").format(count);
    const label = `${activeDatasetName} (${countStr} offre${count > 1 ? "s" : ""})`;
    displays.forEach(el => {
      el.textContent = label;
      el.title = label;
    });
  }

  async function loadFile(file) {
    if (!file) return;
    if (status) status.textContent = `Chargement de ${file.name}…`;
    try {
      const text = await file.text();
      const rows = d3.csvParse(text);
      const { jobs, quality } = JobData.prepareData(rows);
      activeDatasetName = file.name;
      state = { jobs, filteredJobs: jobs, quality, filters: { ...emptyFilters }, datasetName: activeDatasetName };
      console.log(`Bilan de qualité (${file.name}) :`, quality);
      updateFilteredJobs();
      updateDatasetNameDisplay();
    } catch (error) {
      console.error("Impossible de charger le fichier CSV :", error);
      if (status) status.textContent = `Erreur : ${error.message}${state ? " — données précédentes conservées." : ""}`;
    }
  }

  async function reloadDefaultData() {
    activeDatasetName = "ai_jobs_market_2025_2026.csv";
    await loadData();
    updateDatasetNameDisplay();
  }

  async function loadData() {
    if (status) status.textContent = "Chargement des données…";
    try {
      const rows = await d3.csv(csvUrl);
      const { jobs, quality } = JobData.prepareData(rows);
      state = { jobs, filteredJobs: jobs, quality, filters: { ...emptyFilters }, datasetName: activeDatasetName };
      console.log("Bilan de qualité des données :", quality);
      updateFilteredJobs();
      updateDatasetNameDisplay();
    } catch (error) {
      console.error("Impossible de charger les données :", error);
      if (status) status.textContent = `Erreur : ${error.message}${state ? " — données précédentes conservées." : ""}`;
    }
  }

  function setupDatasetControls() {
    document.querySelectorAll("input[type='file'][data-dataset-input], #map-csv-file").forEach(input => {
      if (input.dataset.bound) return;
      input.dataset.bound = "true";
      input.addEventListener("change", event => {
        const file = event.target.files?.[0];
        if (file) loadFile(file);
      });
    });
    document.querySelectorAll("[data-dataset-reset], #map-dataset-reset").forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "true";
      btn.addEventListener("click", () => {
        reloadDefaultData();
        const fileInput = document.getElementById("map-csv-file");
        if (fileInput) fileInput.value = "";
      });
    });
    updateDatasetNameDisplay();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupDatasetControls);
  } else {
    setupDatasetControls();
  }

  loadData();

  return { subscribe, setFilters, resetFilters, loadFile, reloadDefaultData, getState: () => state };
})();
