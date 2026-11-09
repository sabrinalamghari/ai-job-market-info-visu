const ParallelData = (() => {
  const dimensions = [
    { key: "entryRate", label: "Offres Entry", unit: "%", format: v => `${(v * 100).toFixed(1)} %`, percent: true },
    { key: "salaryMedian", label: "Salaire médian", unit: "USD / an", format: v => `${Math.round(v).toLocaleString("fr-FR")} $` },
    { key: "demandMean", label: "Demande moyenne", unit: "score du CSV", format: v => v.toFixed(1) },
    { key: "growthMean", label: "Croissance moyenne", unit: "% annuel", format: v => `${v.toFixed(1)} %` },
    { key: "remoteRate", label: "Hybrid + Remote", unit: "%", format: v => `${(v * 100).toFixed(1)} %`, percent: true },
    { key: "benefitsMean", label: "Avantages moyens", unit: "/ 10", format: v => v.toFixed(1) },
  ];
  const finite = v => typeof v === "number" && Number.isFinite(v);
  const mean = values => values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  function dominant(rows, column) {
    const counts = new Map();
    rows.forEach(row => { if (row[column]) counts.set(row[column], (counts.get(row[column]) || 0) + 1); });
    const max = Math.max(0, ...counts.values());
    return [...counts].filter(([, count]) => count === max).map(([value]) => value).join(" / ") || "Non renseigné";
  }
  function computeMetrics(job, rows, salaryMode = "global") {
    const numeric = (column, valid = () => true) => rows.map(row => row[column]).filter(v => finite(v) && valid(v));
    const salary = rows.filter(row => salaryMode !== "entry" || row.experience_level === "Entry (0-2 yrs)")
      .map(row => row.annual_salary_usd).filter(v => finite(v) && v >= 0);
    const demand = numeric("demand_score");
    const growth = numeric("demand_growth_yoy_pct"), benefits = numeric("benefits_score_10", v => v >= 0 && v <= 10);
    const experience = rows.filter(row => ["Entry (0-2 yrs)", "Mid (3-5 yrs)", "Senior (6-9 yrs)", "Lead (10+ yrs)"].includes(row.experience_level));
    const remote = rows.filter(row => ["On-site", "Hybrid", "Fully Remote"].includes(row.remote_work));
    return {
      job, count: rows.length, salaryMedian: median(salary), demandMean: mean(demand), growthMean: mean(growth), benefitsMean: mean(benefits),
      entryRate: experience.length ? experience.filter(row => row.experience_level === "Entry (0-2 yrs)").length / experience.length : null,
      remoteRate: remote.length ? remote.filter(row => row.remote_work !== "On-site").length / remote.length : null,
      validCounts: { salaryMedian: salary.length, demandMean: demand.length, growthMean: growth.length, benefitsMean: benefits.length, entryRate: experience.length, remoteRate: remote.length },
      experience: dominant(rows, "experience_level"), category: dominant(rows, "job_category"), family: dominant(rows, "job_family"), issueCount: rows.filter(row => row.issues?.length).length,
    };
  }
  function aggregateByJob(rows, column = "job_title", salaryMode = "global") {
    const groups = new Map();
    rows.forEach(row => { if (row[column]) { if (!groups.has(row[column])) groups.set(row[column], []); groups.get(row[column]).push(row); } });
    return [...groups].map(([job, group]) => computeMetrics(job, group, salaryMode)).sort((a, b) => a.job.localeCompare(b.job));
  }
  function matchesBrushes(profile, ranges) {
    return [...ranges].every(([key, [min, max]]) => finite(profile[key]) && profile[key] >= min && profile[key] <= max);
  }

  const minimumCount = 10;
  function eligible(profile) {
    return profile.count >= minimumCount && dimensions.every(axis => finite(profile[axis.key]) && profile.validCounts[axis.key] >= minimumCount);
  }
  // Avec un filtre actif, ne pas masquer toutes les catégories peu représentées.
  // Chaque mesure doit néanmoins disposer d'au moins une valeur réelle valide.
  function eligibleForDisplay(profile, hasFilters = false) {
    const min = hasFilters ? 1 : minimumCount;
    return profile.count >= min && dimensions.every(axis => finite(profile[axis.key]) && profile.validCounts[axis.key] >= min);
  }
  // La proportion Entry doit être calculée indépendamment du filtre expérience.
  // Les autres filtres (pays, secteur, etc.) restent pris en compte.
  function entryReferenceRows(allRows, filters = {}) {
    return allRows.filter(row => Object.entries(filters).every(([key, value]) =>
      key === "experience_level" || !value || row[key] === value));
  }
  function applyEntryReference(aggregated, referenceRows, column = "job_title") {
    const reference = new Map(aggregateByJob(referenceRows, column).map(row => [row.job, row]));
    return aggregated.map(profile => {
      const baseline = reference.get(profile.job);
      return { ...profile, entryRate: baseline?.entryRate ?? null,
        validCounts: { ...profile.validCounts, entryRate: baseline?.validCounts.entryRate ?? 0 } };
    });
  }
  function quantile(values, p) {
    const sorted = values.filter(finite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const index = (sorted.length - 1) * p, low = Math.floor(index);
    return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low);
  }
  function statistics(profiles) {
    return Object.fromEntries(dimensions.map(({ key }) => {
      const values = profiles.map(row => row[key]).filter(finite);
      return [key, { min: quantile(values, 0), q1: quantile(values, .25), median: quantile(values, .5), q3: quantile(values, .75), max: quantile(values, 1) }];
    }));
  }
  function presetRanges(name, stats) {
    const high = (key, threshold = "q3") => [key, [stats[key][threshold], stats[key].max]];
    const primary = dimensions.slice(0, 5).map(axis => axis.key);
    const presets = {
      sweet: primary.map(key => high(key, "median")),
      reward: [high("salaryMedian"), high("demandMean"), ["entryRate", [stats.entryRate.min, stats.entryRate.q1]]],
      accessible: [high("entryRate"), ["salaryMedian", [stats.salaryMedian.min, stats.salaryMedian.median]]],
      balanced: dimensions.map(axis => high(axis.key, "q1")),
      salary: [high("salaryMedian")], growth: [high("growthMean")],
      remote: [high("remoteRate")], junior: [high("entryRate")],
    };
    return new Map(presets[name] || []);
  }
  function comparison(profile, axis, stats, profiles) {
    const value = profile[axis.key], baseline = stats[axis.key].median;
    const delta = value - baseline;
    const sign = delta >= 0 ? "+" : "−";
    const difference = axis.percent || axis.key === "growthMean"
      ? `${sign}${(Math.abs(delta) * (axis.percent ? 100 : 1)).toFixed(1)} points`
      : axis.key === "salaryMedian" && baseline !== 0
        ? `${sign}${(Math.abs(delta / baseline) * 100).toFixed(1)} %`
        : `${sign}${Math.abs(delta).toFixed(1)}`;
    // Rang médian des ex æquo ; tous égaux => 50e percentile.
    const below = profiles.filter(row => row[axis.key] < value).length;
    const equal = profiles.filter(row => row[axis.key] === value).length;
    return { difference, percentile: 100 * (below + equal / 2) / profiles.length };
  }
  function hiddenGems(profiles, stats) {
    const varying = dimensions.filter(axis => stats[axis.key].min < stats[axis.key].max);
    return profiles.filter(profile => varying.length >= 4
      && dimensions.every(axis => profile[axis.key] >= stats[axis.key].q1)
      && varying.every(axis => profile[axis.key] < stats[axis.key].max)
      && varying.filter(axis => profile[axis.key] >= stats[axis.key].median).length >= 4);
  }
  // Min/max taken before brushing: distances remain comparable as candidates change.
  // Incomplete pairs are excluded, never imputed; constant axes carry no distance.
  function distance(a, b, stats) {
    let sum = 0, count = 0;
    for (const { key } of dimensions) {
      if (!finite(a[key]) || !finite(b[key])) return null;
      const { min, max } = stats[key];
      if (!finite(min) || !finite(max)) return null;
      if (max > min) { sum += ((a[key] - b[key]) / (max - min)) ** 2; count++; }
    }
    return count ? Math.sqrt(sum / count) : 0;
  }
  function similar(reference, candidates, stats, limit = 3) {
    return candidates.filter(row => row.job !== reference.job)
      .map(profile => ({ profile, distance: distance(reference, profile, stats) }))
      .filter(row => row.distance !== null)
      .sort((a, b) => a.distance - b.distance || a.profile.job.localeCompare(b.profile.job)).slice(0, limit);
  }
  function atypical(candidates, stats, limit = 3) {
    const center = Object.fromEntries(dimensions.map(({ key }) => [key, stats[key].median]));
    return candidates.map(profile => ({ profile, distance: distance(profile, center, stats),
      contributions: dimensions.filter(({ key }) => stats[key].max > stats[key].min && finite(profile[key]))
        .map(axis => ({ key: axis.key, contribution: ((profile[axis.key] - center[axis.key]) / (stats[axis.key].max - stats[axis.key].min)) ** 2 }))
        .sort((a, b) => b.contribution - a.contribution) }))
      .filter(row => row.distance !== null && row.distance > 0)
      .sort((a, b) => b.distance - a.distance || a.profile.job.localeCompare(b.profile.job)).slice(0, limit);
  }
  function correlation(profiles, keyA, keyB) {
    const pairs = profiles.filter(row => finite(row[keyA]) && finite(row[keyB]));
    const n = pairs.length;
    if (n < 3) return { n, value: null };
    const a = mean(pairs.map(row => row[keyA])), b = mean(pairs.map(row => row[keyB]));
    let aa = 0, bb = 0, ab = 0;
    for (const row of pairs) { const da = row[keyA] - a, db = row[keyB] - b; aa += da * da; bb += db * db; ab += da * db; }
    return { n, value: aa && bb ? Math.max(-1, Math.min(1, ab / Math.sqrt(aa * bb))) : null };
  }
  function relationship(profile, keyA, keyB, stats) {
    if (![keyA, keyB].every(key => finite(profile[key]) && stats[key].max > stats[key].min)) return null;
    const a = profile[keyA], b = profile[keyB];
    if (a >= stats[keyA].q3 && b >= stats[keyB].q3) return "high";
    if (a <= stats[keyA].q1 && b <= stats[keyB].q1) return "low";
    if ((a >= stats[keyA].q3 && b <= stats[keyB].q1) || (b >= stats[keyB].q3 && a <= stats[keyA].q1)) return "tradeoff";
    return null;
  }
  return { dimensions, aggregateByJob, matchesBrushes, minimumCount, eligible, eligibleForDisplay, entryReferenceRows, applyEntryReference, quantile, statistics, presetRanges, comparison, hiddenGems,
    distance, similar, atypical, correlation, relationship };
})();
if (typeof module !== "undefined" && module.exports) module.exports = ParallelData;

(() => {
  if (typeof document === "undefined") return;
  const container = document.getElementById("visualization-2");
  if (!container) return;
  container.replaceChildren();
  const create = (tag, className, text, parent = container) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    parent.append(element);
    return element;
  };
  const chartHelp = create("p", "sr-only", "Sélectionnez deux métiers pour les comparer.");
  const filterPanel = document.querySelector(".parallel-filter-panel");
  const toolbar = create("div", "parallel-toolbar");
  const reset = create("button", "", "Réinitialiser la vue et les filtres", toolbar);
  reset.type = "button";
  reset.id = "parallel-reset";
  const choiceLabel = create("label", "", "Métier ", toolbar);
  const choice = create("select", "", "", choiceLabel);
  const clear = create("button", "", "Effacer les plages", toolbar);
  clear.type = "button";
  clear.id = "parallel-clear-brushes";
  const secondLabel = create("label", "", "Comparer à ", toolbar);
  const secondChoice = create("select", "", "", secondLabel);
  const salaryLabel = create("label", "", "Salaire ", toolbar);
  const salaryChoice = create("select", "", "", salaryLabel);
  salaryChoice.append(new Option("Salaire médian global", "global"), new Option("Salaire médian Entry", "entry"));
  const resetOrder = create("button", "", "Réinitialiser l’ordre des axes", toolbar);
  resetOrder.type = "button";
  const exploration = create("details", "parallel-options parallel-exploration");
  create("summary", "", "Options de la vue", exploration);
  const comparisonPanel = create("div", "parallel-pair");
  const analysisResults = create("div", "parallel-analysis-results");
  const modeStatus = create("p", "parallel-mode");
  modeStatus.setAttribute("role", "status");
  const familyColors = new Map([
    ["IA, recherche et robotique", "#0072b2"],
    ["Data science et ingénierie", "#d55e00"],
    ["Plateformes et déploiement", "#009e73"],
    ["Produit et business", "#a65390"],
    ["Sécurité et gouvernance", "#947000"],
  ]);
  const familyColor = family => familyColors.get(family) ?? "#68747d";
  const legend = create("ul", "parallel-legend");
  legend.setAttribute("aria-label", "Couleurs des familles de métiers");
  const summary = create("p", "parallel-summary");
  summary.setAttribute("role", "status");
  const funnel = create("div", "parallel-funnel");
  const instructions = create("ul", "parallel-help parallel-view-instructions", "", exploration);
  for (const text of [
    "Pointillés : médiane. Segments : intervalle entre les quartiles.",
    "Double-clic sur une plage pour l’effacer.",
    "Déplacez un axe par son titre, à la souris ou avec les flèches gauche et droite.",
  ]) {
    create("li", "", text, instructions);
  }
  const scroll = create("div", "parallel-scroll");
  const svg = d3.select(scroll).append("svg").attr("viewBox", "0 0 1040 450").attr("role", "img").attr("aria-label", "Coordonnées parallèles des profils de métiers, six dimensions");
  svg.append("title").text("Comparer les profils de métiers sur six axes indépendants");
  const plot = svg.append("g").attr("transform", "translate(95,75)");
  const referenceLayer = plot.append("g").attr("class", "parallel-references").attr("pointer-events", "none");
  const lineLayer = plot.append("g"), axisLayer = plot.append("g");
  const markerLayer = plot.append("g").attr("class", "parallel-markers").attr("pointer-events", "none");
  const tooltip = create("div", "parallel-tooltip");
  tooltip.hidden = true;
  const details = create("div", "parallel-details");
  const actions = create("div", "parallel-toolbar parallel-actions", "", exploration);
  actions.append(clear, resetOrder, reset);
  container.replaceChildren(toolbar, chartHelp, ...(filterPanel ? [filterPanel] : []), summary, scroll, legend, comparisonPanel, details, analysisResults, modeStatus, funnel, exploration, tooltip);
  let profiles = [], visible = [], selected = null, hovered = null, scales = {}, unit = "métiers", omitted = 0, stats = {};
  let compared = [], mode = "none", currentState = null, dataset = null;
  let analysisJobs = new Set();
  let availabilityNote = "";
  let filteredView = false;
  const brushes = new Map();
  let movingBrushes = false;
  const ranges = new Map();
  const dimensions = ParallelData.dimensions.map(axis => ({ ...axis }));
  const x = d3.scalePoint().domain(dimensions.map(axis => axis.key)).range([0, 850]);
  const height = 310;

  function renderLegend() {
    legend.replaceChildren();
    const present = new Set(profiles.map(profile => profile.family));
    const families = [...familyColors.keys()].filter(family => present.has(family));
    families.push(...[...present].filter(family => !familyColors.has(family)).sort());
    for (const family of families) {
      const item = create("li", "", "", legend);
      const swatch = create("span", "parallel-swatch", "", item);
      swatch.style.backgroundColor = familyColor(family);
      swatch.setAttribute("aria-hidden", "true");
      create("span", "", `${family} (${profiles.filter(row => row.family === family).length})`, item);
    }
  }
  function buildScales() {
    scales = {};
    for (const axis of dimensions) {
      let domain = axis.percent ? [0, 1] : d3.extent(profiles, row => row[axis.key]);
      if (domain[0] == null) domain = [0, 1];
      if (domain[0] === domain[1]) { const pad = Math.abs(domain[0]) * 0.05 || 1; domain = [domain[0] - pad, domain[1] + pad]; }
      scales[axis.key] = d3.scaleLinear().domain(domain).range([height, 0]);
    }
  }
  function showJobDetails() {
    details.replaceChildren();
    details.hidden = !selected;
    const profile = profiles.find(row => row.job === selected);
    if (!profile) { create("p", "", selected ? `${selected} : profil exclu par les filtres ou données insuffisantes dans ce mode de salaire.` : "Sélectionnez un métier pour obtenir ses valeurs précises et ses effectifs.", details); return; }
    create("h4", "", profile.job, details);
    const findSimilar = create("button", "", "Trouver des métiers similaires", details);
    findSimilar.type = "button";
    findSimilar.addEventListener("click", () => { mode = mode === "similar" ? "none" : "similar"; updateSelection(); });
    findSimilar.textContent = mode === "similar" ? "Masquer les métiers similaires" : "Voir 3 métiers similaires";
    const familyLabel = create("p", "parallel-family", `Famille : ${profile.family}`, details);
    familyLabel.style.borderLeftColor = familyColor(profile.family);
    create("p", "", `${profile.count} offres après filtres, ${profile.category}, Expérience dominante : ${profile.experience}`, details);
    if (profile.count < ParallelData.minimumCount || dimensions.some(axis => profile.validCounts[axis.key] < ParallelData.minimumCount)) {
      create("p", "parallel-help", "Petits effectifs : certaines mesures reposent sur moins de 10 offres.", details);
    }
    if (currentState?.filters?.experience_level) {
      create("p", "parallel-help", "La part Entry est calculée sur tous les niveaux d'expérience, en conservant les autres filtres actifs.", details);
    }
    if (!ParallelData.matchesBrushes(profile, ranges)) create("p", "", "Ce profil sélectionné est hors des plages actives.", details);
    const list = create("dl", "parallel-metrics", "", details);
    for (const axis of dimensions) {
      const cell = create("div", "", "", list);
      create("dt", "", axis.label, cell);
      create("dd", "", `${profile[axis.key] == null ? "Non disponible" : axis.format(profile[axis.key])} (n = ${profile.validCounts[axis.key]})`, cell);
      const comparison = ParallelData.comparison(profile, axis, stats, profiles);
      create("dd", "parallel-comparison", `${comparison.difference} vs médiane, percentile ${Math.round(comparison.percentile)}`, cell);
    }
    const strong = dimensions.filter(axis => stats[axis.key].min < stats[axis.key].max && profile[axis.key] >= stats[axis.key].q3);
    const weak = dimensions.filter(axis => stats[axis.key].min < stats[axis.key].max && profile[axis.key] <= stats[axis.key].q1);
    create("p", "", `Forces (≥ Q3) : ${strong.map(axis => axis.label).join(", ") || "aucune dimension dans le quart supérieur"}.`, details);
    create("p", "", `Compromis (≤ Q1) : ${weak.map(axis => axis.label).join(", ") || "aucune dimension dans le quart inférieur"}.`, details);
    if (profile.issueCount) create("p", "parallel-help", `${profile.issueCount} offres avec des alertes de qualité. Les valeurs invalides sont exclues indicateur par indicateur.`, details);
  }
  function selectProfile(job) {
    if (compared.includes(job)) {
      compared = compared.filter(value => value !== job);
      selected = compared.at(-1) || null;
    } else {
      if (compared.length === 2) compared.pop();
      compared.push(job);
      selected = job;
    }
    hovered = null;
    mode = "none";
    updateSelection();
  }
  function showComparison() {
    comparisonPanel.replaceChildren();
    comparisonPanel.hidden = !compared.length;
    for (const [index, job] of compared.entries()) {
      const profile = profiles.find(row => row.job === job);
      const line = create("div", "parallel-selected-profile", "", comparisonPanel);
      const swatch = create("span", `parallel-profile-swatch${index ? " parallel-profile-swatch-b" : ""}`, "", line);
      swatch.setAttribute("aria-hidden", "true");
      create("span", "", `${job}${!profile ? " — exclu ou données insuffisantes" : !ParallelData.matchesBrushes(profile, ranges) ? " — hors plages actives" : ""}`, line);
      create("span", "parallel-help", index ? "Tirets violets" : "Trait continu noir", line);
      const remove = create("button", "", "Retirer", line);
      remove.setAttribute("aria-label", `Retirer ${job} de la comparaison`);
      remove.type = "button";
      remove.addEventListener("click", () => selectProfile(job));
    }
  }
  function updateAnalysis() {
    analysisResults.replaceChildren();
    analysisJobs = new Set();
    modeStatus.hidden = true;
    analysisResults.hidden = mode !== "similar";
    if (mode !== "similar") return;
    const reference = profiles.find(row => row.job === selected);
    if (!reference) return;
    create("h4", "", `Métiers proches de ${reference.job}`, analysisResults);
    create("p", "parallel-help", "Distance normalisée sur les axes variables, parmi les profils dans les plages actives.", analysisResults);
    const results = ParallelData.similar(reference, visible, stats);
    if (!results.length) create("p", "", "Aucun autre métier comparable avec ces filtres.", analysisResults);
    for (const result of results) {
      analysisJobs.add(result.profile.job);
      const line = create("p", "", "", analysisResults);
      const button = create("button", "", `${result.profile.job}, distance ${result.distance.toFixed(3)}`, line);
      button.type = "button";
      button.addEventListener("click", () => {
        selected = result.profile.job;
        if (!compared.includes(selected)) {
          if (compared.length === 2) compared.pop();
          compared.push(selected);
        }
        mode = "none";
        updateSelection();
      });
    }
  }
  function updateSelection(panels = true) {
    visible = profiles.filter(row => ParallelData.matchesBrushes(row, ranges));
    if (panels) updateAnalysis();
    const active = hovered || selected;
    lineLayer.selectAll("path")
      .attr("stroke", row => compared.includes(row.job) ? compared.indexOf(row.job) === 0 ? "#172b3a" : "#9226ad" : familyColor(row.family))
      .attr("stroke-width", row => compared.includes(row.job) ? 4 : row.job === hovered ? 3.5 : analysisJobs.has(row.job) ? 3 : 1.6)
      .attr("stroke-dasharray", row => compared.indexOf(row.job) === 1 ? "9 4" : analysisJobs.has(row.job) ? "3 2" : null)
      .attr("opacity", row => !ParallelData.matchesBrushes(row, ranges) ? compared.includes(row.job) ? .22 : .035 : row.job === active || compared.includes(row.job) ? 1 : analysisJobs.has(row.job) ? 1 : active || compared.length || mode !== "none" ? .12 : .75)
      .style("pointer-events", row => ParallelData.matchesBrushes(row, ranges) ? "stroke" : "none");
    lineLayer.selectAll("path").filter(row => analysisJobs.has(row.job) || compared.includes(row.job) || row.job === active).raise();
    const selectedProfile = profiles.find(row => row.job === selected);
    markerLayer.selectAll("text").data(selectedProfile ? dimensions : [], axis => axis.key).join("text")
      .attr("x", axis => x(axis.key)).attr("y", axis => scales[axis.key](selectedProfile[axis.key]))
      .attr("text-anchor", "middle").attr("dy", "0.35em")
      .attr("fill", axis => stats[axis.key].min === stats[axis.key].max ? "#525c65"
        : selectedProfile[axis.key] >= stats[axis.key].q3 ? "#13734b"
        : selectedProfile[axis.key] <= stats[axis.key].q1 ? "#a44716" : "#525c65")
      .text(axis => stats[axis.key].min === stats[axis.key].max ? "●"
        : selectedProfile[axis.key] >= stats[axis.key].q3 ? "▲"
        : selectedProfile[axis.key] <= stats[axis.key].q1 ? "▼" : "●");
    markerLayer.attr("opacity", selectedProfile && !ParallelData.matchesBrushes(selectedProfile, ranges) ? 0.2 : 1);
    if (!panels) return;
    const descriptions = [...ranges].map(([key, range]) => { const axis = dimensions.find(axis => axis.key === key); return `${axis.label} : ${axis.format(range[0])} – ${axis.format(range[1])}`; });
    const smallSamples = profiles.filter(row => row.count < ParallelData.minimumCount || dimensions.some(axis => row.validCounts[axis.key] < ParallelData.minimumCount)).length;
    summary.textContent = `${visible.length} / ${profiles.length} ${unit}${omitted ? `, ${omitted} profils incomplets exclus` : ""}${descriptions.length ? `, ${descriptions.join(" ; ")}` : ""}`;
    if (smallSamples) summary.textContent += ` ⚠ ${smallSamples} profil(s) avec moins de 10 observations sur au moins un indicateur : résultats indicatifs.`;
    summary.textContent += availabilityNote;
    if (!visible.length) summary.textContent += " Aucun profil affichable : élargissez les filtres ou effacez les plages. Certaines métriques peuvent être absentes.";
    funnel.replaceChildren();
    funnel.hidden = !ranges.size;
    let remaining = profiles;
    create("span", "", `${profiles.length} au départ`, funnel);
    for (const [key, range] of ranges) {
      remaining = remaining.filter(row => ParallelData.matchesBrushes(row, new Map([[key, range]])));
      const button = create("button", "", `→ ${dimensions.find(axis => axis.key === key).label} : ${remaining.length} ×`, funnel);
      button.type = "button";
      button.title = "Supprimer cette plage";
      button.addEventListener("click", () => { const { group, brush } = brushes.get(key); group.call(brush.move, null); });
    }
    choice.replaceChildren(new Option("Choisir un profil", ""), ...visible.map(row => new Option(`${row.job} (${row.count} offres)`, row.job)));
    if (selected && !visible.some(row => row.job === selected)) choice.append(new Option(`${selected} (exclu / hors plages)`, selected));
    choice.value = selected || "";
    secondChoice.replaceChildren(new Option("Ajouter un second profil", ""), ...visible.filter(row => row.job !== compared[0]).map(row => new Option(row.job, row.job)));
    if (compared[1] && !visible.some(row => row.job === compared[1])) secondChoice.append(new Option(`${compared[1]} (exclu / hors plages)`, compared[1]));
    secondChoice.value = compared[1] || "";
    showComparison();
    showJobDetails();
  }
  function applyRanges(next) {
    ranges.clear();
    for (const [key, range] of next) ranges.set(key, range);
    movingBrushes = true;
    for (const [key, { group, brush }] of brushes) {
      const range = next.get(key);
      group.call(brush.move, range ? [scales[key](range[1]), scales[key](range[0])] : null);
    }
    movingBrushes = false;
    updateSelection();
  }
  function profilePath(profile) {
    return d3.line()(dimensions.map(axis => [x(axis.key), scales[axis.key](profile[axis.key])]));
  }
  function positionAxes(animate = true) {
    x.domain(dimensions.map(axis => axis.key));
    const groups = axisLayer.selectAll(".parallel-axis").interrupt();
    const lines = lineLayer.selectAll("path").interrupt();
    const median = referenceLayer.selectAll(".parallel-median").interrupt();
    (animate ? groups.transition().duration(180) : groups).attr("transform", axis => `translate(${x(axis.key)},0)`);
    (animate ? lines.transition().duration(180) : lines).attr("d", profilePath);
    (animate ? median.transition().duration(180) : median).attr("d", profilePath(Object.fromEntries(dimensions.map(axis => [axis.key, stats[axis.key].median]))));
    updateSelection(false);
  }
  function reorder(keys) {
    const byKey = new Map(dimensions.map(axis => [axis.key, axis]));
    dimensions.splice(0, dimensions.length, ...keys.map(key => byKey.get(key)));
    positionAxes();
  }
  function renderAxes() {
    brushes.clear();
    axisLayer.selectAll("*").remove();
    referenceLayer.selectAll("*").remove();
    if (profiles.length) {
      referenceLayer.append("path").attr("class", "parallel-median")
        .attr("d", d3.line()(dimensions.map(axis => [x(axis.key), scales[axis.key](stats[axis.key].median)])));
    }
    for (const axis of dimensions) {
      const group = axisLayer.append("g").datum(axis).attr("class", "parallel-axis").attr("transform", `translate(${x(axis.key)},0)`);
      if (profiles.length) {
        group.append("line").attr("class", "parallel-quartiles").attr("pointer-events", "none")
          .attr("y1", scales[axis.key](stats[axis.key].q1)).attr("y2", scales[axis.key](stats[axis.key].q3));
      }
      const tickFormat = axis.percent ? d3.format(".0%") : axis.key === "salaryMedian" ? v => `${Math.round(v / 1000)}k` : d3.format(".1f");
      group.call(d3.axisLeft(scales[axis.key]).ticks(5).tickFormat(tickFormat));
      const handle = group.append("text").attr("class", "parallel-axis-label").attr("y", -40).attr("text-anchor", "middle")
        .attr("tabindex", 0).attr("role", "button").attr("aria-label", `${axis.label} : déplacer avec les flèches gauche ou droite`)
        .text(`↔ ${axis.label}`);
      handle.call(d3.drag().container(() => plot.node())
        .on("start", event => { event.sourceEvent.stopPropagation(); tooltip.hidden = true; })
        .on("drag", event => {
          const keys = dimensions.map(item => item.key).sort((a, b) => (a === axis.key ? Math.max(0, Math.min(850, event.x)) : x(a)) - (b === axis.key ? Math.max(0, Math.min(850, event.x)) : x(b)));
          if (keys.some((key, i) => key !== dimensions[i].key)) reorder(keys);
        }))
        .on("keydown", event => {
          if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const keys = dimensions.map(item => item.key), from = keys.indexOf(axis.key);
          const to = Math.max(0, Math.min(keys.length - 1, from + (event.key === "ArrowLeft" ? -1 : 1)));
          [keys[from], keys[to]] = [keys[to], keys[from]];
          reorder(keys);
        });
      group.append("text").attr("class", "parallel-axis-unit").attr("y", -21).attr("text-anchor", "middle").text(axis.unit);
      const brush = d3.brushY().extent([[-14, 0], [14, height]]).on("brush end", event => {
        if (movingBrushes) return;
        if (event.selection) ranges.set(axis.key, event.selection.map(scales[axis.key].invert).sort((a, b) => a - b));
        else ranges.delete(axis.key);
        tooltip.hidden = true;
        hovered = null;
        updateSelection();
      });
      const brushGroup = group.append("g").attr("class", "parallel-brush").call(brush);
      brushes.set(axis.key, { group: brushGroup, brush });
      brushGroup.on("dblclick", () => brushGroup.call(brush.move, null));
      brushGroup.attr("tabindex", 0).attr("role", "group").attr("aria-label", `${axis.label} : flèches haut et bas pour déplacer la plage, Entrée pour créer une plage centrale, Échap pour l’effacer`)
        .on("keydown", event => {
          if (!["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(event.key)) return;
          event.preventDefault();
          if (event.key === "Escape") { brushGroup.call(brush.move, null); return; }
          const range = ranges.get(axis.key);
          const pixels = range ? [scales[axis.key](range[1]), scales[axis.key](range[0])] : [height * .25, height * .75];
          const offset = event.key === "ArrowUp" ? -10 : event.key === "ArrowDown" ? 10 : 0;
          const shift = Math.max(-pixels[0], Math.min(height - pixels[1], offset));
          brushGroup.call(brush.move, pixels.map(value => value + shift));
        });
    }
  }
  function renderLines() {
    lineLayer.selectAll("path").data(profiles, row => row.job).join("path")
      .attr("fill", "none").attr("d", profilePath)
      .on("mouseenter", (event, row) => {
        hovered = row.job;
        tooltip.textContent = `${row.job}, ${row.count} offres\n${row.family}\n${dimensions.map(axis => `${axis.label} : ${axis.format(row[axis.key])}`).join("\n")}`;
        tooltip.hidden = false;
        updateSelection(false);
      })
      .on("mousemove", event => {
        const bounds = container.getBoundingClientRect();
        tooltip.style.left = `${Math.min(Math.max(0, event.clientX - bounds.left + 12), Math.max(0, bounds.width - 290))}px`;
        tooltip.style.top = `${event.clientY - bounds.top + 18}px`;
      })
      .on("mouseleave", () => { hovered = null; tooltip.hidden = true; updateSelection(false); })
      .on("click", (event, row) => selectProfile(row.job));
  }
  function updateParallelCoordinates(state, preserveRanges = false) {
    const filterSummary = document.querySelector(".parallel-filter-panel > summary");
    const activeFilters = Object.values(state.filters || {}).filter(Boolean).length;
    if (filterSummary) filterSummary.textContent = `Filtres avancés${activeFilters ? ` (${activeFilters} actifs)` : ""}`;
    const previousRanges = preserveRanges ? new Map(ranges) : new Map();
    const newDataset = dataset !== state.jobs;
    currentState = state;
    dataset = state.jobs;
    if (newDataset) {
      selected = null; compared = []; mode = "none";
      dimensions.sort((a, b) => ParallelData.dimensions.findIndex(axis => axis.key === a.key) - ParallelData.dimensions.findIndex(axis => axis.key === b.key));
      x.domain(dimensions.map(axis => axis.key));
    }
    const titleCount = new Set(state.jobs.map(row => row.job_title).filter(Boolean)).size;
    const column = titleCount > 40 && state.jobs.some(row => row.job_family) ? "job_family" : "job_title";
    unit = column === "job_title" ? "métiers" : "familles";
    const salaryMode = salaryChoice.value;
    const salaryAxis = dimensions.find(axis => axis.key === "salaryMedian");
    salaryAxis.label = salaryMode === "entry" ? "Salaire Entry" : "Salaire médian";
    const aggregated = ParallelData.aggregateByJob(state.filteredJobs, column, salaryMode);
    const referenceRows = ParallelData.entryReferenceRows(state.jobs, state.filters);
    const adjusted = ParallelData.applyEntryReference(aggregated, referenceRows, column);
    filteredView = Object.values(state.filters || {}).some(Boolean);
    profiles = adjusted.filter(row => ParallelData.eligibleForDisplay(row, filteredView));
    omitted = aggregated.length - profiles.length;
    const insufficient = aggregated.filter(row => !Number.isFinite(row.salaryMedian));
    availabilityNote = salaryMode === "entry" && insufficient.length
      ? ` Salaire Entry indisponible pour ${insufficient.length} profil(s) sans offre Entry avec salaire valide.` : "";
    stats = ParallelData.statistics(profiles);
    ranges.clear();
    hovered = null;
    tooltip.hidden = true;
    renderLegend();
    buildScales();
    renderLines();
    renderAxes();
    applyRanges(previousRanges);
    svg.style("display", profiles.length ? null : "none");
  }
  clear.addEventListener("click", () => applyRanges(new Map()));
  choice.addEventListener("change", () => {
    selected = choice.value || null;
    compared = selected ? [selected, ...compared.filter(job => job !== selected)].slice(0, 2) : [];
    hovered = null; updateSelection();
  });
  secondChoice.addEventListener("change", () => {
    const job = secondChoice.value;
    compared = [compared[0], job].filter(Boolean);
    selected = job || compared[0] || null;
    updateSelection();
  });
  salaryChoice.addEventListener("change", () => { if (currentState) updateParallelCoordinates(currentState, true); });
  resetOrder.addEventListener("click", () => reorder(ParallelData.dimensions.map(axis => axis.key)));
  reset.addEventListener("click", () => {
    selected = null; compared = []; mode = "none"; salaryChoice.value = "global";
    dimensions.sort((a, b) => ParallelData.dimensions.findIndex(axis => axis.key === a.key) - ParallelData.dimensions.findIndex(axis => axis.key === b.key));
    x.domain(dimensions.map(axis => axis.key));
    ranges.clear(); JobApp.resetFilters();
  });
  JobApp.subscribe(updateParallelCoordinates);
})();
