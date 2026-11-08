const HeatmapData = (() => {
  const compare = (a, b) => a.localeCompare(b, "fr");

  // One offer contributes at most once to each skill. Keep titles without offers
  // after filtering so that unavailable cells remain distinct from observed zeroes.
  function aggregateByJob(rows, titles = [...new Set(rows.map(row => row.job_title))]) {
    const groups = new Map(titles.map(job => [job, { job, count: 0, skills: new Map() }]));
    for (const row of rows) {
      if (!groups.has(row.job_title)) continue;
      const profile = groups.get(row.job_title);
      profile.count++;
      for (const skill of new Set(row.required_skills)) {
        profile.skills.set(skill, (profile.skills.get(skill) ?? 0) + 1);
      }
    }
    return [...groups.values()].sort((a, b) => compare(a.job, b.job));
  }

  function cell(profile, skill) {
    const count = profile.skills.get(skill) ?? 0;
    return { job: profile.job, skill, count, total: profile.count, rate: profile.count ? count / profile.count : null };
  }

  function skillCounts(profiles) {
    const counts = new Map();
    for (const profile of profiles) for (const [skill, count] of profile.skills) {
      counts.set(skill, (counts.get(skill) ?? 0) + count);
    }
    return counts;
  }

  function topSkills(profiles, limit = 20) {
    return [...skillCounts(profiles)].sort((a, b) => b[1] - a[1] || compare(a[0], b[0])).slice(0, limit).map(([skill]) => skill);
  }

  // Deterministic nearest-neighbour ordering, not a statistical clustering.
  // Input is alphabetical; vectors contain rates on the displayed dimensions.
  function similarityOrder(items, vector) {
    if (items.length < 2) return [...items];
    const remaining = items.slice(1), result = [items[0]];
    const vectors = new Map(items.map(item => [item, vector(item)]));
    while (remaining.length) {
      const last = vectors.get(result[result.length - 1]);
      let best = 0, minimum = Infinity;
      remaining.forEach((item, index) => {
        const values = vectors.get(item);
        const distance = values.reduce((sum, value, i) => sum + (value - last[i]) ** 2, 0);
        if (distance < minimum) { minimum = distance; best = index; }
      });
      result.push(remaining.splice(best, 1)[0]);
    }
    return result;
  }

  function orderProfiles(profiles, skills, mode) {
    const sorted = [...profiles].sort((a, b) => compare(a.job, b.job));
    if (mode === "count") return sorted.sort((a, b) => b.count - a.count || compare(a.job, b.job));
    if (mode !== "similarity" || !skills.length) return sorted;
    const available = sorted.filter(profile => profile.count);
    return [...similarityOrder(available, profile => skills.map(skill => cell(profile, skill).rate)), ...sorted.filter(profile => !profile.count)];
  }

  function orderSkills(skills, profiles, mode) {
    const sorted = [...skills].sort(compare);
    if (mode === "count") {
      const counts = skillCounts(profiles);
      return sorted.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || compare(a, b));
    }
    const available = profiles.filter(profile => profile.count);
    if (mode !== "similarity" || !available.length) return sorted;
    return similarityOrder(sorted, skill => available.map(profile => cell(profile, skill).rate));
  }

  return { aggregateByJob, cell, skillCounts, topSkills, similarityOrder, orderProfiles, orderSkills };
})();
if (typeof module !== "undefined" && module.exports) module.exports = HeatmapData;

(() => {
  if (typeof document === "undefined") return;
  const container = document.getElementById("visualization-3");
  if (!container) return;
  container.replaceChildren();
  const create = (tag, className, text, parent = container) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    parent.append(element);
    return element;
  };
  const select = (parent, label, entries) => {
    const field = create("label", "", label, parent);
    const control = create("select", "", "", field);
    control.append(...entries.map(([value, text]) => new Option(text, value)));
    return control;
  };
  const button = (parent, label, action) => {
    const control = create("button", "", label, parent);
    control.type = "button";
    control.addEventListener("click", action);
    return control;
  };
  const controls = create("div", "heatmap-controls");
  const filters = create("details", "heatmap-options heatmap-filter-panel", "", controls);
  const filterSummary = create("summary", "", "Filtrer les offres", filters);
  const filterFields = create("div", "heatmap-filter-fields", "", filters);
  const filterSelects = {};
  for (const [column, label] of [["experience_level", "Expérience"], ["country", "Pays"], ["industry", "Secteur"]]) {
    const control = select(filterFields, label, [["", "Tous"]]);
    control.addEventListener("change", () => JobApp.setFilters({ [column]: control.value }));
    filterSelects[column] = control;
  }
  button(filters, "Effacer les filtres", () => JobApp.resetFilters());
  const options = create("details", "heatmap-options");
  create("summary", "", "Options de lecture et aide", options);
  const toolbar = create("div", "heatmap-toolbar", "", options);
  const metric = select(toolbar, "Couleur des cellules", [["rate", "Part des offres du métier (%)"], ["count", "Nombre d’offres"]]);
  const rowOrder = select(toolbar, "Ordre des métiers", [["alpha", "Alphabétique"], ["count", "Nombre d’offres"], ["similarity", "Similarité des profils"]]);
  const columnOrder = select(toolbar, "Ordre des compétences", [["count", "Fréquence dans les métiers affichés"], ["alpha", "Alphabétique"], ["similarity", "Similarité des profils"]]);
  const help = create("p", "heatmap-help", "Survolez une cellule pour voir ses valeurs, cliquez pour conserver le détail.");
  help.id = "heatmap-help";
  const selectionPanel = create("details", "heatmap-options heatmap-selection-panel", "", controls);
  const selectionSummary = create("summary", "", "Choisir les métiers et compétences", selectionPanel);
  const selection = create("div", "heatmap-selection", "", selectionPanel);
  const pickers = {};
  for (const [key, title] of [["jobs", "Métiers affichés"], ["skills", "Compétences affichées"]]) {
    const field = create("fieldset", "", "", selection);
    create("legend", "", title, field);
    const label = create("label", "", `Rechercher ${key === "jobs" ? "un métier" : "une compétence"}`, field);
    const search = create("input", "heatmap-search", "", label);
    search.type = "search";
    const actions = create("div", "heatmap-actions", "", field);
    const list = create("div", "heatmap-checklist", "", field);
    pickers[key] = { search, list, actions };
    search.addEventListener("input", () => renderPicker(key));
    button(actions, "Tout afficher", () => {
      const values = key === "jobs" ? allTitles : allSkills;
      if (key === "jobs") selectedJobs = new Set(values); else selectedSkills = new Set(values);
      renderPickers(); render();
    });
    button(actions, "Tout masquer", () => {
      if (key === "jobs") selectedJobs.clear(); else selectedSkills.clear();
      renderPickers(); render();
    });
  }
  button(pickers.skills.actions, "20 plus fréquentes des métiers affichés", () => {
    selectedSkills = new Set(HeatmapData.topSkills(profiles.filter(profile => selectedJobs.has(profile.job))));
    renderPickers(); render();
  });
  const actions = create("div", "heatmap-actions", "", options);
  button(actions, "Réinitialiser la vue et les filtres", () => {
    selectedJobs = new Set(allTitles);
    selectedSkills = new Set(initialSkills);
    metric.value = "rate"; rowOrder.value = "alpha"; columnOrder.value = "count";
    chosen = null;
    for (const picker of Object.values(pickers)) picker.search.value = "";
    renderPickers(); JobApp.resetFilters();
  });
  create("p", "heatmap-help", "Les sélections ci-dessus changent l’affichage, sans filtrer les offres. Le tri par similarité rapproche successivement les profils de proportions les plus proches, sur les lignes ou colonnes affichées. Ce tri ne constitue pas un classement des métiers.", options);
  create("p", "heatmap-help", "Les nombres à côté des métiers indiquent leurs offres après filtrage. Une proportion est calculée sur ce total. Au clavier : Tab vers la matrice, flèches pour parcourir, Entrée ou Espace pour sélectionner, Échap pour fermer le détail et l’infobulle.", options);
  const summary = create("p", "heatmap-summary");
  summary.setAttribute("role", "status");
  const legend = create("div", "heatmap-legend");
  const empty = create("p", "heatmap-empty");
  empty.setAttribute("role", "status");
  const scroll = create("div", "heatmap-scroll");
  const svg = d3.select(scroll).append("svg").attr("role", "group").attr("aria-label", "Matrice des compétences par métier").attr("aria-describedby", help.id);
  const pattern = svg.append("defs").append("pattern").attr("id", "heatmap-unavailable").attr("width", 6).attr("height", 6).attr("patternUnits", "userSpaceOnUse");
  pattern.append("rect").attr("width", 6).attr("height", 6).attr("fill", "#eef0f2");
  pattern.append("path").attr("d", "M0,6L6,0").attr("stroke", "#cad1d6");
  const cellsLayer = svg.append("g"), columnLabels = svg.append("g"), rowLabels = svg.append("g");
  const columnBackground = columnLabels.append("rect").attr("fill", "white");
  const rowBackground = rowLabels.append("rect").attr("fill", "white");
  const corner = svg.append("rect").attr("fill", "white");
  const details = create("div", "heatmap-details");
  details.hidden = true;
  const tableDetails = create("details", "heatmap-options");
  create("summary", "", "Voir les valeurs de la matrice en tableau", tableDetails);
  const tableScroll = create("div", "heatmap-table-scroll", "", tableDetails);
  const table = create("table", "", "", tableScroll);
  create("caption", "", "Valeurs des métiers et compétences affichés après filtrage des offres", table);
  const head = create("tr", "", "", create("thead", "", "", table));
  for (const label of ["Métier", "Compétence", "Offres avec compétence", "Offres du métier", "Part"]) {
    create("th", "", label, head).scope = "col";
  }
  const tbody = create("tbody", "", "", table);
  const tooltip = create("div", "heatmap-tooltip");
  tooltip.id = "heatmap-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  container.replaceChildren(controls, summary, help, legend, empty, scroll, details, options, tableDetails, tooltip);
  let state = null, dataset = null, profiles = [], allTitles = [], allSkills = [], initialSkills = [];
  let selectedJobs = new Set(), selectedSkills = new Set(), chosen = null, matrix = [];
  let countMaximum = 1;
  let tooltipTarget = null, tooltipTimer = null;
  let pointerPosition = null, dismissedPointer = null;
  const percent = value => value === null ? "Non disponible" : `${(value * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
  const description = value => `${value.job} · ${value.skill}\n${value.total ? `${value.count} / ${value.total} offres · ${percent(value.rate)}` : "Aucune offre de ce métier après filtrage"}`;

  function hideTooltip() {
    clearTimeout(tooltipTimer);
    tooltip.hidden = true;
    tooltipTarget?.removeAttribute("aria-describedby");
    tooltipTarget = null;
  }

  function delayHideTooltip() {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      if (document.activeElement !== tooltipTarget && !tooltip.matches(":hover")) hideTooltip();
    }, 120);
  }

  function showTooltip(event, value) {
    // Removing a hovered tooltip can expose a different cell under the pointer.
    // Escape must not immediately reopen a tooltip without deliberate movement.
    if (event.type === "pointerenter" && dismissedPointer && event.clientX === dismissedPointer.x && event.clientY === dismissedPointer.y) return;
    dismissedPointer = null;
    hideTooltip();
    tooltipTarget = event.currentTarget;
    tooltip.textContent = description(value);
    tooltip.hidden = false;
    tooltipTarget.setAttribute("aria-describedby", tooltip.id);
    const box = tooltipTarget.getBoundingClientRect();
    const gap = 10, width = tooltip.offsetWidth, height = tooltip.offsetHeight;
    let x = box.right + gap, y = box.top + (box.height - height) / 2;
    if (x + width > window.innerWidth - 8) x = box.left - width - gap;
    if (x < 8) { x = box.left; y = box.bottom + gap; }
    if (y + height > window.innerHeight - 8) y = box.top - height - gap;
    tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, x))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, y))}px`;
  }

  tooltip.addEventListener("pointerenter", () => clearTimeout(tooltipTimer));
  tooltip.addEventListener("pointerleave", delayHideTooltip);
  document.addEventListener("pointermove", event => { pointerPosition = { x: event.clientX, y: event.clientY }; }, { passive: true });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { dismissedPointer = pointerPosition; hideTooltip(); }
  });

  function renderPicker(key) {
    const { search, list } = pickers[key];
    const selected = key === "jobs" ? selectedJobs : selectedSkills;
    const values = key === "jobs" ? allTitles : allSkills;
    const query = search.value.trim().toLocaleLowerCase("fr");
    list.replaceChildren();
    for (const value of values.filter(value => value.toLocaleLowerCase("fr").includes(query))) {
      const label = create("label", "", "", list);
      const check = create("input", "", "", label);
      check.type = "checkbox"; check.checked = selected.has(value);
      label.append(document.createTextNode(value));
      check.addEventListener("change", () => {
        if (check.checked) selected.add(value); else selected.delete(value);
        render();
      });
    }
    if (!list.children.length) create("p", "heatmap-help", "Aucun résultat.", list);
  }
  function renderPickers() { renderPicker("jobs"); renderPicker("skills"); }

  function renderDetail() {
    details.replaceChildren();
    if (!chosen) { details.hidden = true; return; }
    const profile = profiles.find(profile => profile.job === chosen.job);
    if (!profile || !selectedJobs.has(chosen.job) || !selectedSkills.has(chosen.skill)) {
      chosen = null; details.hidden = true; return;
    }
    const value = HeatmapData.cell(profile, chosen.skill);
    details.hidden = false;
    create("h3", "", `${value.job} × ${value.skill}`, details);
    create("p", "", value.total ? `${value.count} offres sur ${value.total} mentionnent cette compétence (${percent(value.rate)}).` : "Aucune offre de ce métier après filtrage : proportion non disponible.", details);
    if (value.count) {
      const offers = state.filteredJobs.filter(row => row.job_title === value.job && row.required_skills.includes(value.skill));
      const related = new Map();
      for (const offer of offers) for (const skill of new Set(offer.required_skills)) if (skill !== value.skill) related.set(skill, (related.get(skill) ?? 0) + 1);
      create("p", "heatmap-help", `Autres compétences dans ces ${offers.length} offres uniquement :`, details);
      const list = create("ul", "", "", details);
      for (const [skill, count] of [...related].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")).slice(0, 8)) {
        create("li", "", `${skill} : ${count} / ${offers.length} (${percent(count / offers.length)})`, list);
      }
    }
    button(details, "Fermer le détail", () => { chosen = null; render(); });
  }

  function renderTable() {
    tbody.replaceChildren();
    if (!tableDetails.open) return;
    for (const value of matrix) {
      const row = create("tr", "", "", tbody);
      for (const text of [value.job, value.skill, value.total ? value.count : "—", value.total, percent(value.rate)]) create("td", "", String(text), row);
    }
  }
  tableDetails.addEventListener("toggle", renderTable);

  function render() {
    if (!state) return;
    hideTooltip();
    let displayed = profiles.filter(profile => selectedJobs.has(profile.job));
    const skills = HeatmapData.orderSkills([...selectedSkills], displayed, columnOrder.value);
    displayed = HeatmapData.orderProfiles(displayed, skills, rowOrder.value);
    matrix = displayed.flatMap((profile, row) => skills.map((skill, column) => ({ ...HeatmapData.cell(profile, skill), row, column })));
    const available = displayed.filter(profile => profile.count).length;
    const shownOffers = displayed.reduce((sum, profile) => sum + profile.count, 0);
    summary.textContent = `${displayed.length} métiers · ${skills.length} compétences · ${shownOffers.toLocaleString("fr-FR")} offres${available < displayed.length ? ` · ${displayed.length - available} métiers sans offre` : ""}`;
    const activeFilters = Object.entries(filterSelects).filter(([column]) => state.filters[column]);
    filterSummary.textContent = `Filtrer les offres${activeFilters.length ? ` (${activeFilters.length})` : ""}`;
    selectionSummary.textContent = `Métiers et compétences (${displayed.length} / ${allTitles.length} · ${skills.length} / ${allSkills.length})`;
    for (const [column, control] of Object.entries(filterSelects)) control.value = state.filters[column];
    if (activeFilters.length) summary.textContent += ` · ${activeFilters.map(([column]) => state.filters[column]).join(" · ")}`;
    empty.hidden = Boolean(matrix.length && shownOffers);
    empty.textContent = !displayed.length ? "Sélectionnez au moins un métier dans les options de la vue." : !skills.length ? "Sélectionnez au moins une compétence, ou affichez les 20 plus fréquentes des métiers affichés." : "Aucune offre dans les métiers affichés avec ces filtres. Modifiez les filtres ou les métiers sélectionnés.";
    scroll.hidden = !matrix.length;
    const maximum = metric.value === "rate" ? 1 : countMaximum;
    const color = d3.scaleSequential().domain([0, maximum]).interpolator(d3.interpolateRgb("#f0f5f8", "#185b83"));
    legend.replaceChildren();
    const ramp = create("span", "", "0 ", legend);
    create("span", "heatmap-ramp", "", ramp).setAttribute("aria-hidden", "true");
    ramp.append(document.createTextNode(metric.value === "rate" ? " 100 %" : ` ${maximum} offres`));
    const unavailable = create("span", "", "", legend);
    create("span", "heatmap-none", "", unavailable).setAttribute("aria-hidden", "true");
    unavailable.append(document.createTextNode(" Aucune offre du métier"));
    create("span", "", metric.value === "rate" ? "Part des offres du métier" : "Nombre d’offres · échelle fixe", legend);
    const left = window.innerWidth < 700 ? 190 : 270, top = 145, size = 32;
    svg.attr("width", left + skills.length * size + 16).attr("height", top + displayed.length * size + 16);
    columnBackground.attr("x", left).attr("width", skills.length * size + 16).attr("height", top);
    rowBackground.attr("width", left).attr("height", top + displayed.length * size + 16);
    corner.attr("width", left).attr("height", top);
    rowLabels.selectAll("text").data(displayed, profile => profile.job).join("text")
      .attr("class", "heatmap-axis").attr("x", left - 10).attr("y", (_, index) => top + index * size + size / 2)
      .attr("text-anchor", "end").attr("dominant-baseline", "middle")
      .text(profile => `${left < 270 && profile.job.length > 18 ? `${profile.job.slice(0, 16)}…` : profile.job} · ${profile.count} offres`);
    columnLabels.selectAll("text").data(skills, skill => skill).join("text")
      .attr("class", "heatmap-axis").attr("transform", (_, index) => `translate(${left + index * size + size / 2},${top - 10}) rotate(-55)`)
      .attr("text-anchor", "start").text(skill => skill);
    const cells = cellsLayer.selectAll("rect").data(matrix, value => JSON.stringify([value.job, value.skill])).join("rect")
      .attr("class", "heatmap-cell").classed("is-selected", value => chosen?.job === value.job && chosen?.skill === value.skill)
      .attr("x", value => left + value.column * size).attr("y", value => top + value.row * size)
      .attr("width", size).attr("height", size)
      .attr("fill", value => value.rate === null ? "url(#heatmap-unavailable)" : color(metric.value === "rate" ? value.rate : value.count))
      .attr("role", "button").attr("tabindex", (_, index) => index === 0 ? 0 : -1)
      .attr("aria-pressed", value => chosen?.job === value.job && chosen?.skill === value.skill ? "true" : "false")
      .attr("aria-label", description);
    const choose = value => {
      dismissedPointer = pointerPosition;
      hideTooltip();
      chosen = chosen?.job === value.job && chosen?.skill === value.skill ? null : { job: value.job, skill: value.skill };
      cells.classed("is-selected", value => chosen?.job === value.job && chosen?.skill === value.skill)
        .attr("aria-pressed", value => chosen?.job === value.job && chosen?.skill === value.skill ? "true" : "false");
      renderDetail();
    };
    cells.on("pointerenter focus", showTooltip).on("pointerleave blur", delayHideTooltip)
      .on("click", (_, value) => choose(value))
      .on("keydown", (event, value) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(value); return; }
        if (event.key === "Escape") { chosen = null; hideTooltip(); cells.classed("is-selected", false).attr("aria-pressed", "false"); renderDetail(); return; }
        const movement = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0], Home: [0, -value.column], End: [0, skills.length - value.column - 1] }[event.key];
        if (!movement) return;
        event.preventDefault();
        const row = Math.max(0, Math.min(displayed.length - 1, value.row + movement[0]));
        const column = Math.max(0, Math.min(skills.length - 1, value.column + movement[1]));
        cells.attr("tabindex", cell => cell.row === row && cell.column === column ? 0 : -1);
        const next = cells.nodes()[row * skills.length + column];
        next.focus({ preventScroll: true });
        const targetX = left + column * size, targetY = top + row * size;
        if (targetX < scroll.scrollLeft + left) scroll.scrollLeft = targetX - left;
        else if (targetX + size > scroll.scrollLeft + scroll.clientWidth) scroll.scrollLeft = targetX + size - scroll.clientWidth;
        if (targetY < scroll.scrollTop + top) scroll.scrollTop = targetY - top;
        else if (targetY + size > scroll.scrollTop + scroll.clientHeight) scroll.scrollTop = targetY + size - scroll.clientHeight;
        pinLabels();
      });
    pinLabels(); renderDetail(); renderTable();
  }

  function pinLabels() {
    rowLabels.attr("transform", `translate(${scroll.scrollLeft},0)`);
    columnLabels.attr("transform", `translate(0,${scroll.scrollTop})`);
    corner.attr("transform", `translate(${scroll.scrollLeft},${scroll.scrollTop})`);
  }
  for (const control of [metric, rowOrder, columnOrder]) control.addEventListener("change", render);
  scroll.addEventListener("scroll", () => { hideTooltip(); pinLabels(); });
  window.addEventListener("resize", render);
  window.addEventListener("scroll", hideTooltip, { passive: true });
  JobApp.subscribe(nextState => {
    state = nextState;
    if (dataset !== state.jobs) {
      dataset = state.jobs;
      allTitles = [...new Set(dataset.map(row => row.job_title))].filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
      const fullProfiles = HeatmapData.aggregateByJob(dataset, allTitles);
      allSkills = [...HeatmapData.skillCounts(fullProfiles).keys()].sort((a, b) => a.localeCompare(b, "fr"));
      initialSkills = HeatmapData.topSkills(fullProfiles);
      for (const [column, control] of Object.entries(filterSelects)) {
        const values = [...new Set(dataset.map(row => row[column]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
        control.replaceChildren(new Option("Tous", ""), ...values.map(value => new Option(value, value)));
      }
      selectedJobs = new Set(allTitles); selectedSkills = new Set(initialSkills); chosen = null;
      countMaximum = Math.max(1, ...fullProfiles.flatMap(profile => [...profile.skills.values()]));
      renderPickers();
    }
    profiles = HeatmapData.aggregateByJob(state.filteredJobs, allTitles);
    render();
  });
})();
