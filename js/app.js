const JobApp = (() => {
  const status = document.getElementById("data-status");
  const fileInput = document.getElementById("csv-file");
  const listeners = new Set();
  const emptyFilters = { job_category: "", experience_level: "", country: "", remote_work: "" };
  let state = null;

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
    state.filteredJobs = state.jobs.filter(job =>
      Object.entries(state.filters).every(([column, value]) => !value || job[column] === value)
    );
    status.textContent = `${state.filteredJobs.length} / ${state.jobs.length} lignes — ${state.filename}`;
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

  async function loadData(file) {
    fileInput.disabled = true;
    status.textContent = "Chargement des données…";
    try {
      const rows = file
        ? d3.csvParse(await file.text())
        : await d3.csv("data/ai_jobs_market_2025_2026.csv");
      const { jobs, quality } = JobData.prepareData(rows);
      state = { jobs, filteredJobs: jobs, quality, filters: { ...emptyFilters },
        filename: file ? file.name : "ai_jobs_market_2025_2026.csv" };
      console.log("Bilan de qualité des données :", quality);
      updateFilteredJobs();
    } catch (error) {
      console.error("Impossible de charger les données :", error);
      status.textContent = `Erreur : ${error.message}${state ? " — données précédentes conservées." : ""}`;
    } finally {
      fileInput.disabled = false;
      fileInput.value = "";
    }
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) loadData(file);
  });
  loadData();

  return { subscribe, setFilters, resetFilters };
})();
