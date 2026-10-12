(() => {
  const container = document.getElementById("visualization-4");
  if (!container) return;

  const filterColumns = ["experience_level", "country", "remote_work", "company_size"];
  // Natural order of ordered values; other values are sorted alphabetically
  const valueOrder = {
    experience_level: ["Entry (0-2 yrs)", "Mid (3-5 yrs)", "Senior (6-9 yrs)", "Lead (10+ yrs)"],
    remote_work: ["On-site", "Hybrid", "Fully Remote"],
    company_size: ["Startup (1-50)", "SME (51-500)", "Mid-size (501-5000)", "Enterprise (5000+)", "Big Tech (FAANG+)"],
  };
  const formatNumber = new Intl.NumberFormat("fr-FR");
  const formatPercent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
  const formatSalary = new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  });
  const formatDecimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
  const colorMeasures = {
    salary: {
      label: "Salaire annuel médian", column: "annual_salary_usd",
      format: value => formatSalary.format(value),
    },
    growth: {
      label: "Croissance médiane de la demande", column: "demand_growth_yoy_pct",
      format: value => `${value > 0 ? "+" : ""}${formatDecimal.format(value)} %`,
    },
  };
  // Single-hue sequential ramp, light to dark
  const ramp = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
  const uniformFill = "#bce2d6";
  const missingFill = "#e1e5e8";
  const darkInk = "#202e38";
  const headerHeight = 22;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const measureContext = document.createElement("canvas").getContext("2d");
  let state;
  let colorScales = {};
  let view = { total: 0, categoryTotals: new Map(), grouped: true };
  let width = 0;

  const root = d3.select(container);
  const canvas = root.select(".treemap-canvas");
  const tooltip = root.select(".treemap-tooltip");
  const categorySelect = root.select("#treemap-category");
  const colorSelect = root.select("#treemap-color");
  const groupInput = root.select("#treemap-group");
  const upButton = root.select("#treemap-up");
  const svg = canvas.insert("svg", ".treemap-tooltip")
    .attr("role", "group")
    .attr("aria-label", "Treemap des métiers IA et data selon le nombre d’offres")
    .attr("aria-describedby", "treemap-help");
  const categoryLayer = svg.append("g");
  const tileLayer = svg.append("g");

  function sortedValues(column) {
    const order = valueOrder[column] ?? [];
    const rank = value => (order.includes(value) ? order.indexOf(value) : order.length);
    return [...new Set(state.jobs.map(job => job[column]).filter(Boolean))]
      .sort((a, b) => rank(a) - rank(b) || d3.ascending(a, b));
  }

  function median(jobs, column) {
    return d3.median(jobs, job => job[column] ?? undefined);
  }

  // Keep the label whole, shorten it with an ellipsis, or drop it when it cannot fit
  function fitText(text, maxWidth, font) {
    measureContext.font = `${font} ${getComputedStyle(container).fontFamily}`;
    if (measureContext.measureText(text).width <= maxWidth) return text;
    for (let end = text.length - 1; end >= 4; end--) {
      const shortened = `${text.slice(0, end).trimEnd()}…`;
      if (measureContext.measureText(shortened).width <= maxWidth) return shortened;
    }
    return "";
  }

  function luminance(color) {
    const channel = value => {
      const ratio = value / 255;
      return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
    };
    const { r, g, b } = d3.rgb(color);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  function tileFill(node) {
    const measure = colorMeasures[colorSelect.property("value")];
    if (!measure) return uniformFill;
    const value = median(node.data.jobs, measure.column);
    return value === undefined ? missingFill : colorScales[colorSelect.property("value")](value);
  }

  function selectedJobs() {
    const values = Object.fromEntries(filterColumns.map(column =>
      [column, root.select(`#treemap-${column}`).property("value")]));
    return state.filteredJobs.filter(job =>
      filterColumns.every(column => !values[column] || job[column] === values[column]));
  }

  function buildHierarchy(jobs, grouped) {
    const byCategory = d3.group(jobs, job => job.job_category, job => job.job_title);
    const titles = (category, jobsByTitle) => Array.from(jobsByTitle, ([title, titleJobs]) => ({
      key: `${category}|${title}`, name: title, category, jobs: titleJobs,
    }));
    const children = grouped
      ? Array.from(byCategory, ([category, jobsByTitle]) => ({
        key: category, name: category, children: titles(category, jobsByTitle),
      }))
      : Array.from(byCategory, ([category, jobsByTitle]) => titles(category, jobsByTitle)).flat();
    return d3.hierarchy({ key: "root", children })
      .sum(item => item.jobs?.length ?? 0)
      .sort((a, b) => b.value - a.value || d3.ascending(a.data.name, b.data.name));
  }

  function drillTo(category, fromKeyboard = false) {
    categorySelect.property("value", category);
    render(true);
    if (fromKeyboard) tileLayer.select(".treemap-tile").node()?.focus();
  }

  function showTooltip(node, event) {
    const { name, category, jobs } = node.data;
    const categoryTotal = view.categoryTotals.get(category) ?? jobs.length;
    const lines = [
      [name, "treemap-tooltip-title"],
      [category],
      [`${formatNumber.format(jobs.length)} offres · ${formatPercent.format(jobs.length / view.total)} des offres affichées`],
    ];
    if (view.grouped && categoryTotal !== jobs.length) {
      lines.push([`${formatPercent.format(jobs.length / categoryTotal)} de la catégorie`]);
    }
    for (const measure of Object.values(colorMeasures)) {
      const value = median(jobs, measure.column);
      if (value !== undefined) lines.push([`${measure.label} : ${measure.format(value)}`]);
    }
    if (view.grouped) lines.push(["Cliquer pour ouvrir la catégorie", "treemap-tooltip-hint"]);
    tooltip.selectAll("p").data(lines).join("p")
      .attr("class", ([, className]) => className ?? null)
      .text(([text]) => text);
    tooltip.property("hidden", false);

    const box = canvas.node().getBoundingClientRect();
    const label = tooltip.node();
    const [x, y] = event?.clientX !== undefined
      ? [event.clientX - box.left + 14, event.clientY - box.top + 14]
      : [(node.x0 + node.x1) / 2, (node.y0 + node.y1) / 2];
    const left = x + label.offsetWidth + 8 > box.width ? x - label.offsetWidth - 28 : x;
    const top = y + label.offsetHeight + 8 > box.height ? y - label.offsetHeight - 28 : y;
    tooltip.style("left", `${Math.max(8, left)}px`).style("top", `${Math.max(8, top)}px`);
  }

  function hideTooltip() {
    tooltip.property("hidden", true);
  }

  function renderLegend() {
    const mode = colorSelect.property("value");
    const measure = colorMeasures[mode];
    const legend = root.select(".treemap-legend");
    legend.selectAll("*").remove();
    legend.append("p").style("margin", 0).text(
      "La surface de chaque rectangle est proportionnelle au nombre d’offres." +
      (measure ? ` La couleur indique le ${measure.label.toLowerCase()} du métier ; gris : valeur absente.` : ""));
    if (!measure) return;
    const [minimum, maximum] = colorScales[mode].domain();
    const scale = legend.append("div").attr("class", "treemap-scale");
    scale.append("span").text(measure.format(minimum));
    scale.append("span").attr("class", "treemap-scale-bar").attr("aria-hidden", "true")
      .style("background", `linear-gradient(to right, ${ramp.join(", ")})`);
    scale.append("span").text(measure.format(maximum));
  }

  function render(animate = false) {
    if (!state) return;
    hideTooltip();
    width = canvas.node().clientWidth;
    const height = Math.max(360, Math.round(width * 0.6));
    svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const jobs = selectedJobs();
    const category = categorySelect.property("value");
    const grouped = groupInput.property("checked") && !category;
    const scope = category ? jobs.filter(job => job.job_category === category) : jobs;
    view = {
      total: scope.length,
      categoryTotals: d3.rollup(scope, categoryJobs => categoryJobs.length, job => job.job_category),
      grouped,
    };

    const hierarchy = buildHierarchy(scope, grouped);
    if (scope.length) {
      d3.treemap()
        .tile(d3.treemapSquarify)
        .size([width, height])
        .paddingInner(node => (node.depth === 0 && grouped ? 6 : 2))
        .paddingTop(node => (node.depth === 1 && node.children ? headerHeight : 0))
        .round(true)(hierarchy);
    }
    const leaves = scope.length ? hierarchy.leaves() : [];
    const categories = grouped && scope.length ? hierarchy.children : [];
    const transition = svg.transition().duration(animate && !reducedMotion.matches ? 450 : 0);
    svg.classed("treemap-uniform", !colorMeasures[colorSelect.property("value")])
      .classed("treemap-drillable", grouped);

    const headers = categoryLayer.selectAll(".treemap-category")
      .data(categories, node => node.data.key)
      .join(enter => {
        const header = enter.append("g").attr("class", "treemap-category").attr("aria-hidden", "true")
          .attr("transform", node => `translate(${node.x0},${node.y0})`);
        header.append("rect").attr("class", "treemap-category-band").attr("rx", 3);
        header.append("text").attr("class", "treemap-category-label").attr("x", 6).attr("y", 15);
        return header;
      });
    headers.on("click", (event, node) => drillTo(node.data.name));
    headers.transition(transition).attr("transform", node => `translate(${node.x0},${node.y0})`);
    headers.select("rect").transition(transition)
      .attr("width", node => node.x1 - node.x0).attr("height", headerHeight - 2);
    headers.select("text").text(node => fitText(
      `${node.data.name} · ${formatNumber.format(node.value)}`, node.x1 - node.x0 - 12, "700 12px"));

    const tiles = tileLayer.selectAll(".treemap-tile")
      .data(leaves, node => node.data.key)
      .join(enter => {
        const tile = enter.append("g").attr("class", "treemap-tile").attr("tabindex", 0)
          .attr("transform", node => `translate(${node.x0},${node.y0})`).style("opacity", 0);
        tile.append("rect").attr("rx", 3)
          .attr("width", node => node.x1 - node.x0).attr("height", node => node.y1 - node.y0);
        tile.append("text").attr("class", "treemap-name").attr("x", 6).attr("y", 17);
        tile.append("text").attr("class", "treemap-count").attr("x", 6).attr("y", 32);
        return tile;
      }, update => update, exit => exit.transition(transition).style("opacity", 0).remove());

    tiles.attr("role", grouped ? "button" : "img")
      .attr("aria-label", node => `${node.data.name}, ${node.data.category} : ${formatNumber.format(node.value)} offres, ${formatPercent.format(node.value / view.total)} des offres affichées`)
      .on("click", (event, node) => { if (grouped) drillTo(node.data.category); })
      .on("keydown", (event, node) => {
        if (grouped && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          drillTo(node.data.category, true);
        }
      })
      .on("pointerenter pointermove", (event, node) => showTooltip(node, event))
      .on("pointerleave blur", hideTooltip)
      .on("focus", (event, node) => showTooltip(node));
    tiles.transition(transition).style("opacity", 1)
      .attr("transform", node => `translate(${node.x0},${node.y0})`);
    tiles.select("rect").transition(transition)
      .attr("width", node => Math.max(0, node.x1 - node.x0))
      .attr("height", node => Math.max(0, node.y1 - node.y0))
      .attr("fill", tileFill);
    tiles.each(function (node) {
      const tileWidth = node.x1 - node.x0 - 12;
      const tileHeight = node.y1 - node.y0;
      const ink = luminance(tileFill(node)) > 0.23 ? darkInk : "white";
      const tile = d3.select(this);
      tile.select(".treemap-name").attr("fill", ink)
        .text(tileHeight >= 24 ? fitText(node.data.name, tileWidth, "600 12px") : "");
      tile.select(".treemap-count").attr("fill", ink)
        .text(tileHeight >= 40 ? fitText(`${formatNumber.format(node.value)} offres · ${formatPercent.format(node.value / view.total)}`, tileWidth, "11px") : "");
    });

    categorySelect.property("value", category);
    upButton.property("hidden", !category);
    root.select(".treemap-current").text(category
      ? `Catégorie : ${category}` : (grouped ? "Toutes les catégories" : "Tous les métiers"));
    root.select(".treemap-message").text(scope.length ? "" : "Aucune offre ne correspond à ces filtres.");
    renderLegend();

    const categoryCount = new Set(scope.map(job => job.job_category)).size;
    root.select(".treemap-total").text(`${formatNumber.format(scope.length)} offres affichées, ${formatNumber.format(leaves.length)} métiers dans ${formatNumber.format(categoryCount)} catégorie${categoryCount > 1 ? "s" : ""}.`);
    const topTitle = d3.greatest(leaves, node => node.value);
    const topCategory = d3.greatest(categories, node => node.value);
    root.select(".treemap-top").text([
      topCategory && `Catégorie la plus représentée : ${topCategory.data.name} (${formatNumber.format(topCategory.value)} offres, ${formatPercent.format(topCategory.value / scope.length)}).`,
      topTitle && `Métier le plus représenté : ${topTitle.data.name} (${formatNumber.format(topTitle.value)} offres, ${formatPercent.format(topTitle.value / scope.length)}).`,
    ].filter(Boolean).join(" "));

    const tableRows = leaves.slice().sort((a, b) => b.value - a.value || d3.ascending(a.data.name, b.data.name));
    const rows = root.select("tbody").selectAll("tr").data(tableRows, node => node.data.key).join("tr");
    rows.selectAll("td").data(node => {
      const salary = median(node.data.jobs, "annual_salary_usd");
      return [node.data.category, node.data.name, formatNumber.format(node.value),
        formatPercent.format(node.value / scope.length), salary === undefined ? "—" : formatSalary.format(salary)];
    }).join("td").text(value => value);
    rows.order();
  }

  for (const column of filterColumns) root.select(`#treemap-${column}`).on("change", () => render(true));
  categorySelect.on("change", () => render(true));
  colorSelect.on("change", () => render(true));
  groupInput.on("change", () => render(true));
  upButton.on("click", () => drillTo(""));
  root.select("#treemap-reset-filters").on("click", () => {
    for (const column of filterColumns) root.select(`#treemap-${column}`).property("value", "");
    render(true);
  });
  svg.on("keydown", event => {
    if (event.key === "Escape") {
      hideTooltip();
      if (categorySelect.property("value")) drillTo("", true);
    }
  });
  new ResizeObserver(() => {
    if (canvas.node().clientWidth !== width) render();
  }).observe(canvas.node());

  JobApp.subscribe(nextState => {
    const newDataset = state?.jobs !== nextState.jobs;
    state = nextState;
    if (newDataset) {
      for (const column of filterColumns) {
        root.select(`#treemap-${column}`).selectAll("option.filter-value").data(sortedValues(column))
          .join("option").attr("class", "filter-value").attr("value", value => value).text(value => value);
        root.select(`#treemap-${column}`).property("value", "");
      }
      categorySelect.selectAll("option.filter-value").data(sortedValues("job_category"))
        .join("option").attr("class", "filter-value").attr("value", value => value).text(value => value);
      categorySelect.property("value", "");
      // Scales use the full dataset and stay fixed while filtering, so colors remain comparable
      for (const [mode, measure] of Object.entries(colorMeasures)) {
        const medians = Array.from(d3.rollup(state.jobs, jobs => median(jobs, measure.column),
          job => `${job.job_category}|${job.job_title}`).values()).filter(value => value !== undefined);
        const [minimum = 0, maximum = 0] = d3.extent(medians);
        colorScales[mode] = d3.scaleSequential(d3.interpolateRgbBasis(ramp))
          .domain([minimum, maximum > minimum ? maximum : minimum + 1]).clamp(true);
      }
    }
    render(!newDataset);
  });
})();
