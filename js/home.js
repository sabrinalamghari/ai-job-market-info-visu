(() => {
  const input = document.getElementById("dataset-file");
  const reset = document.getElementById("dataset-reset");
  const message = document.getElementById("dataset-message");
  const source = document.getElementById("dataset-source");
  const summary = document.querySelector(".dataset-note");
  const links = document.querySelectorAll(".exploration-entry");
  const format = new Intl.NumberFormat("fr-FR");
  let busy = true;
  let current = null;

  const help = document.querySelector(".dataset-help");
  const helpTrigger = document.getElementById("dataset-help-trigger");
  const helpTooltip = document.getElementById("dataset-format");
  let helpTimer = null;
  let helpDismissed = false;

  function showHelp() {
    clearTimeout(helpTimer);
    if (helpDismissed) return;
    helpTooltip.hidden = false;
    helpTrigger.setAttribute("aria-expanded", "true");
    helpTrigger.setAttribute("aria-describedby", helpTooltip.id);
  }

  function hideHelp() {
    clearTimeout(helpTimer);
    helpTooltip.hidden = true;
    helpTrigger.setAttribute("aria-expanded", "false");
    helpTrigger.removeAttribute("aria-describedby");
  }

  helpTrigger.addEventListener("pointerenter", event => {
    if (event.pointerType !== "touch") showHelp();
  });
  helpTooltip.addEventListener("pointerenter", () => clearTimeout(helpTimer));
  help.addEventListener("pointerleave", () => {
    helpDismissed = false;
    helpTimer = setTimeout(() => {
      if (!help.contains(document.activeElement)) hideHelp();
    }, 120);
  });
  helpTrigger.addEventListener("focus", () => {
    if (helpTrigger.matches(":focus-visible")) { helpDismissed = false; showHelp(); }
  });
  help.addEventListener("focusout", event => {
    if (!help.contains(event.relatedTarget)) { helpDismissed = false; hideHelp(); }
  });
  helpTrigger.addEventListener("click", () => {
    if (helpTooltip.hidden) { helpDismissed = false; showHelp(); }
    else { helpDismissed = true; hideHelp(); }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !helpTooltip.hidden) { helpDismissed = true; hideHelp(); }
  });
  document.addEventListener("pointerdown", event => {
    if (!help.contains(event.target)) hideHelp();
  });

  function setBusy(value) {
    busy = value;
    input.disabled = value;
    reset.disabled = value;
    for (const link of links) {
      if (value) link.setAttribute("aria-disabled", "true");
      else link.removeAttribute("aria-disabled");
    }
  }

  function display(dataset) {
    current = dataset;
    const { jobs, source: active } = dataset;
    const titles = new Set(jobs.map(job => job.job_title).filter(Boolean)).size;
    const skills = new Set(jobs.flatMap(job => job.required_skills)).size;
    summary.textContent = `${format.format(jobs.length)} offre${jobs.length === 1 ? "" : "s"}, ${format.format(titles)} métier${titles === 1 ? "" : "s"} et ${format.format(skills)} compétence${skills === 1 ? "" : "s"}.`;
    source.textContent = active.imported ? `Fichier utilisé : ${active.name}` : "Fichier du projet";
    source.title = active.name;
    reset.hidden = !active.imported;
  }

  for (const link of links) link.addEventListener("click", event => {
    if (busy) event.preventDefault();
  });

  async function run(action, success) {
    if (busy) return;
    setBusy(true);
    message.dataset.error = "false";
    message.textContent = "Chargement du fichier…";
    try {
      const dataset = await action();
      display(dataset);
      const count = dataset.quality.rowsWithIssues;
      const issues = dataset.source.imported && count
        ? ` ${format.format(count)} offre${count === 1 ? " comporte" : "s comportent"} des alertes de qualité ; les lignes sont conservées.` : "";
      message.textContent = success + issues;
    } catch (error) {
      message.dataset.error = "true";
      message.textContent = `${error.message}${current ? " Le fichier actif est conservé." : ""}`;
    } finally {
      input.value = "";
      setBusy(false);
    }
  }

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (file) run(() => JobDataset.importFile(file), "Le fichier est utilisé par les quatre visualisations.");
  });
  reset.addEventListener("click", () => run(() => JobDataset.reset(), "Le fichier du projet est rétabli pour les quatre visualisations."));

  setBusy(true);
  JobDataset.load().then(dataset => {
    display(dataset);
    message.textContent = dataset.warning;
  }).catch(error => {
    summary.textContent = "Données indisponibles.";
    message.dataset.error = "true";
    message.textContent = `${error.message} Vous pouvez importer un CSV compatible.`;
  }).finally(() => setBusy(false));
})();
