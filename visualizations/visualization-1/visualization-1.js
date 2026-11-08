(() => {
  const container = document.getElementById("visualization-1");
  if (!container) return;
  const worldUrl = new URL("../../data/world-countries.geojson", document.currentScript.src);

  // Coordinates are longitude then latitude
  const cityCoordinates = {
    "Australia|Sydney": [151.21, -33.87],
    "Canada|Toronto": [-79.38, 43.65],
    "China|Beijing": [116.41, 39.90],
    "France|Paris": [2.35, 48.86],
    "Germany|Berlin": [13.40, 52.52],
    "India|Bangalore": [77.59, 12.97],
    "Japan|Tokyo": [139.69, 35.68],
    "Netherlands|Amsterdam": [4.90, 52.37],
    "Singapore|Singapore": [103.82, 1.35],
    "Switzerland|Zurich": [8.54, 47.38],
    "UAE|Dubai": [55.27, 25.20],
    "UK|London": [-0.13, 51.51],
    "USA|Austin": [-97.74, 30.27],
    "USA|Boston": [-71.06, 42.36],
    "USA|Chicago": [-87.63, 41.88],
    "USA|Los Angeles": [-118.24, 34.05],
    "USA|New York": [-74.01, 40.71],
    "USA|San Francisco": [-122.42, 37.77],
    "USA|Seattle": [-122.33, 47.61],
  };

  const cityNamesFr = {
    "UK|London": "Londres",
    "France|Paris": "Paris",
    "Germany|Berlin": "Berlin",
    "Netherlands|Amsterdam": "Amsterdam",
    "Switzerland|Zurich": "Zurich",
    "USA|San Francisco": "San Francisco",
    "USA|New York": "New York",
    "USA|Chicago": "Chicago",
    "USA|Austin": "Austin",
    "USA|Seattle": "Seattle",
    "USA|Boston": "Boston",
    "USA|Los Angeles": "Los Angeles",
    "Canada|Toronto": "Toronto",
    "China|Beijing": "Pékin",
    "Japan|Tokyo": "Tokyo",
    "Singapore|Singapore": "Singapour",
    "Australia|Sydney": "Sydney",
    "India|Bangalore": "Bangalore",
    "UAE|Dubai": "Dubaï",
  };

  // Radial label offsets for crowded regions in the semantic lens
  const lensLabelOffsets = {
    // Europe
    "UK|London": { dx: -6, dy: -1 },
    "France|Paris": { dx: -4, dy: 1 },
    "Netherlands|Amsterdam": { dx: 4, dy: -1 },
    "Switzerland|Zurich": { dx: 6, dy: 1 },
    "Germany|Berlin": { dx: 0, dy: -1 },
    // US East & Great Lakes
    "USA|Boston": { dx: 6, dy: -1 },
    "USA|New York": { dx: -6, dy: 1 },
    "Canada|Toronto": { dx: -4, dy: -1 },
    "USA|Chicago": { dx: 0, dy: -1 },
    // US West
    "USA|San Francisco": { dx: -6, dy: -1 },
    "USA|Los Angeles": { dx: 6, dy: 1 },
    "USA|Seattle": { dx: 0, dy: -1 },
    "USA|Austin": { dx: 0, dy: 1 },
  };

  const countryAliases = {
    "United States of America": "USA",
    "United Kingdom": "UK",
    "United Arab Emirates": "UAE",
  };
  const continentBounds = {
    "Afrique": [[-20, 38], [52, -35]],
    "Amérique du Nord": [[-170, 84], [-50, 7]],
    "Amérique du Sud": [[-82, 13], [-34, -56]],
    "Asie": [[25, 80], [180, -11]],
    "Europe": [[-25, 72], [45, 34]],
    "Océanie": [[110, 0], [180, -48]],
  };

  const width = 960;
  const height = 500;
  const lensRadius = 88;
  const lensMagnification = 2.6;

  const formatNumber = new Intl.NumberFormat("fr-FR");
  const formatSalary = new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  });

  let state;
  let countries = [];
  let currentCities = [];
  let currentZoom = d3.zoomIdentity;
  let radius = d3.scaleSqrt();
  let selectedCityKey = null;
  let selectedCountryName = null;
  let lensMode = "auto"; // "auto" | "always" | "off"
  let mousePos = null;

  const root = d3.select(container);
  const selects = ["industry", "job_category", "job_title"];
  const salaryInput = root.select("#map-salary");
  const remoteInput = root.select("#map-remote");
  const countrySelect = root.select("#map-country");
  const continentSelect = root.select("#map-continent");
  const lensToggleBtn = root.select("#map-toggle-lens");
  const cityLabel = root.select(".map-city-label");

  // Selection detail panel elements (Level 2: Details-on-Demand)
  const selectionPanel = root.select("#map-selection-panel");
  const selectionType = root.select("#map-selection-type");
  const selectionTitle = root.select("#map-selection-title");
  const selectionNote = root.select("#map-selection-note");
  const selectionCloseBtn = root.select("#map-selection-close");
  const kpiCount = root.select("#map-kpi-count");
  const kpiShare = root.select("#map-kpi-share");
  const kpiSalaryAvg = root.select("#map-kpi-salary-avg");
  const kpiSalaryMed = root.select("#map-kpi-salary-med");
  const kpiRemote = root.select("#map-kpi-remote");
  const kpiRemoteCount = root.select("#map-kpi-remote-count");
  const kpiSenior = root.select("#map-kpi-senior");
  const kpiExperience = root.select("#map-kpi-experience");
  const jobsBarsContainer = root.select("#map-jobs-bars");
  const expBarsContainer = root.select("#map-exp-bars");

  const projection = d3.geoEquirectangular()
    .fitExtent([[10, 10], [width - 10, height - 10]], { type: "Sphere" });
  const path = d3.geoPath(projection);

  const svg = root.select(".map-canvas").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("aria-label", "Carte mondiale des offres d’emploi en IA")
    .attr("aria-describedby", "map-help");

  // Defs for filter and clipPath
  const defs = svg.append("defs");
  const filter = defs.append("filter")
    .attr("id", "lens-shadow")
    .attr("x", "-40%")
    .attr("y", "-40%")
    .attr("width", "180%")
    .attr("height", "180%");
  filter.append("feDropShadow")
    .attr("dx", 0)
    .attr("dy", 4)
    .attr("stdDeviation", 8)
    .attr("flood-color", "#102822")
    .attr("flood-opacity", 0.35);

  defs.append("clipPath")
    .attr("id", "lens-clip")
    .append("circle")
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", lensRadius);

  // Main map layer
  const map = svg.append("g").attr("class", "map-root");
  map.append("path").datum({ type: "Sphere" }).attr("class", "map-ocean").attr("d", path);
  map.append("path").datum(d3.geoGraticule10()).attr("class", "map-graticule").attr("d", path);
  const countryLayer = map.append("g").attr("class", "map-countries");
  const cityLayer = map.append("g").attr("class", "map-cities");

  // Semantic magnifying lens layer (Focus + Context)
  const lens = svg.append("g").attr("class", "map-lens").attr("display", "none");
  const lensClipped = lens.append("g").attr("clip-path", "url(#lens-clip)");
  lensClipped.append("circle").attr("cx", 0).attr("cy", 0).attr("r", lensRadius).attr("class", "map-ocean");
  const lensContent = lensClipped.append("g").attr("class", "map-lens-content");
  lensContent.append("path").datum(d3.geoGraticule10()).attr("class", "map-graticule").attr("d", path);
  const lensCountryLayer = lensContent.append("g").attr("class", "map-lens-countries");
  const lensCityLayer = lensContent.append("g").attr("class", "map-lens-cities");

  // Outer bezel ring
  lens.append("circle")
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", lensRadius)
    .attr("class", "map-lens-ring")
    .attr("pointer-events", "none");

  const zoom = d3.zoom().scaleExtent([1, 20])
    .extent([[0, 0], [width, height]])
    .translateExtent([[0, 0], [width, height]])
    .on("zoom", event => {
      currentZoom = event.transform;
      map.attr("transform", currentZoom);
      updateCityPositions();
      if (event.sourceEvent) {
        countrySelect.property("value", "");
        continentSelect.property("value", "");
      }
    });

  svg.call(zoom).on("dblclick.zoom", null);

  function clearSelection() {
    selectedCityKey = null;
    selectedCountryName = null;
    countrySelect.property("value", "");
    cityLayer.selectAll(".map-city").classed("map-city-selected", false).attr("aria-pressed", false);
    lensCityLayer.selectAll(".map-lens-city").classed("map-lens-city-selected", false);
    countryLayer.selectAll(".map-country").classed("map-country-selected", false);
    lensCountryLayer.selectAll(".map-country").classed("map-country-selected", false);
    renderSelectionPanel();
    updateCityLabel();
  }

  selectionCloseBtn.on("click", clearSelection);

  // Right-click to reset zoom instantly to world view
  svg.on("contextmenu", event => {
    event.preventDefault();
    resetZoom();
  });

  svg.on("click", () => {
    clearSelection();
  }).on("keydown", event => {
    if (event.key === "Escape") {
      clearSelection();
    }
  });

  // Pointer tracking for interactive loupe
  svg.on("pointerenter pointermove", event => {
    mousePos = d3.pointer(event, svg.node());
    if (lensMode !== "off" && currentZoom.k < 2.0) updateLensPosition(mousePos);
  }).on("pointerleave", () => {
    mousePos = null;
    lens.attr("display", "none");
  });

  // Mode management for the loupe: 'auto' (cluster only) | 'always' | 'off'
  const lensModeLabels = {
    auto: "🔍 Loupe : Auto (zones denses)",
    always: "🔍 Loupe : Toujours active",
    off: "🔍 Loupe : Désactivée",
  };

  function setLensMode(mode) {
    lensMode = mode;
    lensToggleBtn
      .attr("aria-pressed", lensMode !== "off")
      .attr("data-mode", lensMode)
      .text(lensModeLabels[lensMode]);
    if (lensMode === "off" || currentZoom.k >= 2.0) {
      lens.attr("display", "none");
    } else if (mousePos) {
      updateLensPosition(mousePos);
    }
  }

  function cycleLensMode() {
    if (lensMode === "auto") setLensMode("always");
    else if (lensMode === "always") setLensMode("off");
    else setLensMode("auto");
  }

  lensToggleBtn.on("click", cycleLensMode);

  // Keyboard shortcut L to cycle lens mode
  window.addEventListener("keydown", event => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (event.key === "l" || event.key === "L") {
      event.preventDefault();
      cycleLensMode();
    }
  });

  window.addEventListener("resize", updateCityLabel);

  function countryName(feature) {
    return countryAliases[feature.properties.name] ?? feature.properties.name;
  }

  function zoomToBounds([[x0, y0], [x1, y1]]) {
    const scale = Math.max(1, Math.min(20, 0.85 / Math.max((x1 - x0) / width, (y1 - y0) / height)));
    const transform = d3.zoomIdentity.translate(width / 2, height / 2)
      .scale(scale).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    svg.interrupt().call(zoom.transform, transform);
  }

  function zoomToCountry(feature) {
    const name = countryName(feature);
    countrySelect.property("value", name);
    continentSelect.property("value", "");
    setLensMode("off");
    selectedCountryName = name;
    selectedCityKey = null;
    countryLayer.selectAll(".map-country").classed("map-country-selected", f => countryName(f) === name);
    lensCountryLayer.selectAll(".map-country").classed("map-country-selected", f => countryName(f) === name);
    const geometry = feature.geometry;
    const mainland = geometry.type === "MultiPolygon"
      ? { type: "Polygon", coordinates: d3.greatest(geometry.coordinates,
        coordinates => d3.geoArea({ type: "Polygon", coordinates })) }
      : geometry;
    zoomToBounds(path.bounds(mainland));
    renderSelectionPanel();
    updateCityLabel();
  }

  function resetZoom() {
    countrySelect.property("value", "");
    continentSelect.property("value", "");
    clearSelection();
    svg.interrupt().call(zoom.transform, d3.zoomIdentity);
    setLensMode("auto");
  }

  // Detection: is mouse within proximity of a dense cluster of points?
  function isNearCluster(pos) {
    if (!pos || !currentCities.length) return false;
    const [mx, my] = pos;
    const proxRadius = 92;
    const clusterDistMax = 48;

    const nearby = [];
    for (const city of currentCities) {
      const coords = cityCoordinates[city.key];
      if (!coords) continue;
      const [cx, cy] = currentZoom.apply(projection(coords));
      if (Math.hypot(cx - mx, cy - my) <= proxRadius) {
        nearby.push({ key: city.key, x: cx, y: cy });
      }
    }

    if (nearby.length >= 2) {
      for (let i = 0; i < nearby.length; i++) {
        for (let j = i + 1; j < nearby.length; j++) {
          if (Math.hypot(nearby[i].x - nearby[j].x, nearby[i].y - nearby[j].y) <= clusterDistMax) {
            return true;
          }
        }
      }
    }

    for (const near of nearby) {
      for (const city of currentCities) {
        if (city.key === near.key) continue;
        const coords = cityCoordinates[city.key];
        if (!coords) continue;
        const [cx, cy] = currentZoom.apply(projection(coords));
        if (Math.hypot(near.x - cx, near.y - cy) <= clusterDistMax) {
          if (Math.hypot(cx - mx, cy - my) <= proxRadius + 30) {
            return true;
          }
        }
      }
    }

    return false;
  }

  function updateLensPosition(pos) {
    if (!pos || lensMode === "off" || currentZoom.k >= 2.0) {
      lens.attr("display", "none");
      return;
    }

    // In auto mode, only activate if near a cluster of close points
    if (lensMode === "auto" && !isNearCluster(pos)) {
      lens.attr("display", "none");
      return;
    }

    const [mx, my] = pos;
    if (mx < 0 || mx > width || my < 0 || my > height) {
      lens.attr("display", "none");
      return;
    }

    lens.attr("display", null).attr("transform", `translate(${mx},${my})`);
    const M = Math.min(lensMagnification, Math.max(1.3, 16 / currentZoom.k));
    lensContent.attr("transform", `scale(${M}) translate(${-mx},${-my}) ${currentZoom.toString()}`);

    lensCityLayer.selectAll(".map-lens-city")
      .classed("map-lens-city-selected", city => city.key === selectedCityKey)
      .attr("transform", city => {
        const [x, y] = projection(cityCoordinates[city.key]);
        return `translate(${x},${y}) scale(${1 / (M * currentZoom.k)})`;
      });
  }

  function updateCityPositions() {
    cityLayer.selectAll(".map-city")
      .classed("map-city-selected", city => city.key === selectedCityKey)
      .attr("transform", city => {
        const [x, y] = projection(cityCoordinates[city.key]);
        return `translate(${x},${y}) scale(${1 / currentZoom.k})`;
      });

    // Display rules for numbers on base map:
    // When zoomed (k >= 2.0), display all city numbers.
    // At global scale (k < 2.0), display numbers for non-clustered cities;
    // clustered European cities are kept visually uncluttered on the overview
    // and inspected via the interactive semantic loupe.
    cityLayer.selectAll(".map-city text").attr("display", function(city) {
      if (currentZoom.k >= 2.0) return null;
      if (city.key === selectedCityKey) return null;
      if (["UK|London", "France|Paris", "Netherlands|Amsterdam", "Germany|Berlin", "Switzerland|Zurich"].includes(city.key)) {
        return "none";
      }
      return null;
    });

    updateCityLabel();
    if (mousePos && lensMode !== "off" && currentZoom.k < 2.0) {
      updateLensPosition(mousePos);
    } else {
      lens.attr("display", "none");
    }
  }

  function updateCityLabel() {
    const markers = cityLayer.selectAll(".map-city");
    const city = markers.data().find(city => city.key === selectedCityKey);
    markers.classed("map-city-selected", c => c.key === selectedCityKey)
      .attr("aria-pressed", c => c.key === selectedCityKey);
    lensCityLayer.selectAll(".map-lens-city")
      .classed("map-lens-city-selected", c => c.key === selectedCityKey);

    if (!city) {
      selectedCityKey = null;
      cityLabel.property("hidden", true);
      return;
    }
    const [x, y] = currentZoom.apply(projection(cityCoordinates[city.key]));
    if (x < 0 || x > width || y < 0 || y > height) {
      cityLabel.property("hidden", true);
      return;
    }
    const labelCityName = cityNamesFr[city.key] ?? city.city;
    cityLabel.text(`${labelCityName}, ${city.country} : ${formatNumber.format(city.count)} offres`)
      .property("hidden", false);
    const box = svg.node().getBoundingClientRect();
    const scale = box.width / width;
    const label = cityLabel.node();
    const left = Math.max(8, Math.min(box.width - label.offsetWidth - 8, (x + Math.max(5, radius(city.count))) * scale + 8));
    const top = Math.max(8, Math.min(box.height - label.offsetHeight - 8, y * scale - label.offsetHeight / 2));
    cityLabel.style("left", `${left}px`).style("top", `${top}px`);
  }

  function selectCity(event, city) {
    event.stopPropagation();
    if (selectedCityKey === city.key) {
      clearSelection();
    } else {
      selectedCityKey = city.key;
      selectedCountryName = null;
      countryLayer.selectAll(".map-country").classed("map-country-selected", false);
      lensCountryLayer.selectAll(".map-country").classed("map-country-selected", false);
      renderSelectionPanel();
      updateCityLabel();
    }
    if (mousePos && lensMode !== "off") {
      updateLensPosition(mousePos);
    }
  }

  function getFilteredJobs() {
    if (!state) return [];
    const minimumSalary = Number(salaryInput.property("value"));
    const values = Object.fromEntries(selects.map(column => [column, root.select(`#map-${column}`).property("value")]));
    return state.filteredJobs.filter(job =>
      (minimumSalary <= Number(salaryInput.attr("min")) ||
        (job.annual_salary_usd !== null && job.annual_salary_usd >= minimumSalary)) &&
      (!remoteInput.property("checked") || job.is_remote_friendly === true) &&
      selects.every(column => !values[column] || job[column] === values[column])
    );
  }

  function renderSelectionPanel(currentFilteredJobs) {
    if (!state) {
      selectionPanel.property("hidden", true);
      return;
    }

    const filtered = currentFilteredJobs || getFilteredJobs();
    let targetJobs = [];
    let badgeText = "";
    let badgeClass = "";
    let title = "";
    const isUnlocated = !selectedCityKey && !selectedCountryName;

    selectionPanel.classed("is-selected", !isUnlocated);

    if (selectedCityKey) {
      const [country, city] = selectedCityKey.split("|");
      targetJobs = filtered.filter(j => j.country === country && j.city === city);
      badgeText = "📍 Ville";
      badgeClass = "badge-city";
      const cityName = cityNamesFr[selectedCityKey] ?? city;
      title = `${cityName}, ${country}`;
      selectionCloseBtn.style("display", null).text("✕ Offres non localisées");
      selectionNote.text("Cliquez sur [✕ Offres non localisées] ou sur le fond de carte pour revenir aux offres sans localisation.");
    } else if (selectedCountryName) {
      targetJobs = filtered.filter(j => j.country === selectedCountryName);
      badgeText = "🌍 Pays";
      badgeClass = "badge-country";
      title = selectedCountryName;
      selectionCloseBtn.style("display", null).text("✕ Offres non localisées");
      selectionNote.text("Cliquez sur [✕ Offres non localisées] ou sur le fond de carte pour revenir aux offres sans localisation.");
    } else {
      targetJobs = filtered.filter(j => j.country === "Global" || j.city === "Remote" || !j.has_geographic_location);
      badgeText = "🌐 Non localisées";
      badgeClass = "badge-unlocated";
      title = "Offres sans localisation géographique (Global / Télétravail)";
      selectionCloseBtn.style("display", "none");
      selectionNote.text("Ces offres sont ouvertes mondialement en télétravail sans ville ni pays associé (invisibles sur la carte). Cliquez sur une ville ou un pays pour afficher ses offres locales.");
    }

    selectionType
      .text(badgeText)
      .attr("class", `map-selection-badge ${badgeClass}`);
    selectionTitle.text(title);

    if (targetJobs.length === 0) {
      kpiCount.text("0");
      kpiShare.text(isUnlocated ? "Aucune offre non localisée avec ces filtres" : "Aucune offre avec les critères sélectionnés");
      kpiSalaryAvg.text("—");
      kpiSalaryMed.text("—");
      kpiRemote.text("—");
      kpiRemoteCount.text("0 offre");
      kpiSenior.text("—");
      kpiExperience.text("—");
      jobsBarsContainer.html("<p class='map-empty-stat'>Aucune offre correspondante aux filtres actuels.</p>");
      expBarsContainer.html("<p class='map-empty-stat'>Aucune offre correspondante aux filtres actuels.</p>");
      selectionPanel.property("hidden", false);
      return;
    }

    const totalJobsCount = filtered.length || 1;
    kpiCount.text(formatNumber.format(targetJobs.length));
    if (isUnlocated) {
      const sharePct = ((targetJobs.length / totalJobsCount) * 100).toFixed(1);
      kpiShare.text(`${sharePct}% des offres actives (hors carte)`);
    } else {
      const sharePct = ((targetJobs.length / totalJobsCount) * 100).toFixed(1);
      kpiShare.text(`${sharePct}% des offres actives`);
    }

    const salaries = targetJobs.map(j => j.annual_salary_usd).filter(v => v !== null && v > 0);
    if (salaries.length) {
      kpiSalaryAvg.text(formatSalary.format(d3.mean(salaries)));
      kpiSalaryMed.text(`Médian : ${formatSalary.format(d3.median(salaries))}`);
    } else {
      kpiSalaryAvg.text("N/D");
      kpiSalaryMed.text("Salaire non renseigné");
    }

    const remoteCount = targetJobs.filter(j => j.is_remote_friendly === true).length;
    const remotePct = targetJobs.length ? Math.round((remoteCount / targetJobs.length) * 100) : 0;
    kpiRemote.text(`${remotePct}%`);
    kpiRemoteCount.text(isUnlocated
      ? `${formatNumber.format(remoteCount)} offres 100% à distance`
      : `${formatNumber.format(remoteCount)} offre${remoteCount > 1 ? "s" : ""} flexibles`);

    const seniorCount = targetJobs.filter(j => j.is_senior === true).length;
    const seniorPct = Math.round((seniorCount / targetJobs.length) * 100);
    kpiSenior.text(`${seniorPct}%`);
    const experiences = targetJobs.map(j => j.years_of_experience).filter(v => v !== null);
    if (experiences.length) {
      kpiExperience.text(`Moyenne : ${d3.mean(experiences).toFixed(1)} ans d’exp.`);
    } else {
      kpiExperience.text("Expérience non renseignée");
    }

    // Top 4 Job Titles
    const jobCounts = Array.from(d3.rollup(targetJobs, v => v.length, j => j.job_title), ([title, count]) => ({
      title, count,
    })).sort((a, b) => b.count - a.count).slice(0, 4);

    const maxJobCount = jobCounts[0]?.count || 1;
    jobsBarsContainer.html(jobCounts.map(item => {
      const pct = Math.round((item.count / targetJobs.length) * 100);
      const widthPct = Math.max(8, Math.round((item.count / maxJobCount) * 100));
      return `
        <div class="map-bar-item">
          <div class="map-bar-header">
            <span class="map-bar-name" title="${item.title}">${item.title}</span>
            <span class="map-bar-stat">${item.count} (${pct}%)</span>
          </div>
          <div class="map-bar-track">
            <div class="map-bar-fill" style="width: ${widthPct}%"></div>
          </div>
        </div>
      `;
    }).join(""));

    // Experience distribution
    const expOrder = ["Entry (0-2 yrs)", "Mid (3-5 yrs)", "Senior (6-9 yrs)", "Lead (10+ yrs)"];
    const expLabels = {
      "Entry (0-2 yrs)": "Débutant (0-2 ans)",
      "Mid (3-5 yrs)": "Confirmé (3-5 ans)",
      "Senior (6-9 yrs)": "Senior (6-9 ans)",
      "Lead (10+ yrs)": "Lead (10+ ans)",
    };
    const expMap = d3.rollup(targetJobs, v => v.length, j => j.experience_level);
    const expData = expOrder.map(level => ({
      level,
      label: expLabels[level] ?? level,
      count: expMap.get(level) || 0,
    })).filter(d => d.count > 0);

    const maxExpCount = d3.max(expData, d => d.count) || 1;
    expBarsContainer.html(expData.map(item => {
      const pct = Math.round((item.count / targetJobs.length) * 100);
      const widthPct = Math.max(8, Math.round((item.count / maxExpCount) * 100));
      return `
        <div class="map-bar-item">
          <div class="map-bar-header">
            <span class="map-bar-name">${item.label}</span>
            <span class="map-bar-stat">${item.count} (${pct}%)</span>
          </div>
          <div class="map-bar-track">
            <div class="map-bar-fill accent-gold" style="width: ${widthPct}%"></div>
          </div>
        </div>
      `;
    }).join(""));

    selectionPanel.property("hidden", false);
  }

  function render() {
    if (!state) return;
    const minimumSalary = Number(salaryInput.property("value"));
    const values = Object.fromEntries(selects.map(column => [column, root.select(`#map-${column}`).property("value")]));
    const selectedJobs = state.filteredJobs.filter(job =>
      (minimumSalary <= Number(salaryInput.attr("min")) ||
        (job.annual_salary_usd !== null && job.annual_salary_usd >= minimumSalary)) &&
      (!remoteInput.property("checked") || job.is_remote_friendly === true) &&
      selects.every(column => !values[column] || job[column] === values[column])
    );
    root.select("#map-salary-value").text(minimumSalary <= Number(salaryInput.attr("min"))
      ? "Tous les salaires" : `Au moins ${formatSalary.format(minimumSalary)}`);

    const globalJobs = selectedJobs.filter(job => job.country === "Global");
    const localJobs = selectedJobs.filter(job => job.country !== "Global");
    const locatedJobs = localJobs.filter(job => job.has_geographic_location && cityCoordinates[`${job.country}|${job.city}`]);
    const cities = Array.from(d3.group(locatedJobs, job => `${job.country}|${job.city}`), ([key, jobs]) => ({
      key, city: jobs[0].city, country: jobs[0].country, count: jobs.length,
    }));
    currentCities = cities;
    const countryCounts = d3.rollup(localJobs, jobs => jobs.length, job => job.country);

    // Update countries on base map
    countryLayer.selectAll("path")
      .classed("map-country-active", feature => (countryCounts.get(countryName(feature)) ?? 0) > 0)
      .select("title").text(feature => `${countryName(feature)} : ${formatNumber.format(countryCounts.get(countryName(feature)) ?? 0)} offres`);

    // Update countries inside the magnifying lens
    lensCountryLayer.selectAll("path")
      .classed("map-country-active", feature => (countryCounts.get(countryName(feature)) ?? 0) > 0)
      .select("title").text(feature => `${countryName(feature)} : ${formatNumber.format(countryCounts.get(countryName(feature)) ?? 0)} offres`);

    // Base map city markers
    const markers = cityLayer.selectAll(".map-city")
      .data(cities.sort((a, b) => b.count - a.count), city => city.key)
      .join(enter => {
        const marker = enter.append("g").attr("class", "map-city").attr("tabindex", 0).attr("role", "button");
        marker.append("circle").attr("class", "map-city-hit");
        marker.append("circle").attr("class", "map-city-bubble");
        marker.append("text").attr("class", "map-city-count");
        marker.append("title");
        return marker;
      });

    markers.attr("aria-label", city => `${cityNamesFr[city.key] ?? city.city}, ${city.country} : ${city.count} offres`)
      .on("click", selectCity)
      .on("keydown", (event, city) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectCity(event, city);
        }
      });

    // Adaptive styling for base map city markers:
    // Large circles display numbers inside with high contrast;
    // Small circles (<10px radius) place numbers cleanly above with a 3px white halo.
    markers.each(function(city) {
      const g = d3.select(this);
      const r = Math.max(5, radius(city.count));
      const isSmall = r < 10;

      const hitR = isSmall ? 11 : r;
      g.select(".map-city-hit").attr("r", hitR);
      g.select(".map-city-bubble").attr("r", r);

      const text = g.select(".map-city-count")
        .text(city.count)
        .classed("map-city-count-inside", !isSmall)
        .classed("map-city-count-above", isSmall);

      if (isSmall) {
        text.attr("y", -r - 4).attr("dy", "0");
      } else {
        text.attr("y", 0).attr("dy", "0.35em");
      }
      g.select("title").text(`${cityNamesFr[city.key] ?? city.city}, ${city.country} : ${formatNumber.format(city.count)} offres`);
    });

    // Lens semantic markers
    const lensMarkers = lensCityLayer.selectAll(".map-lens-city")
      .data(cities.sort((a, b) => b.count - a.count), city => city.key)
      .join(enter => {
        const marker = enter.append("g").attr("class", "map-lens-city").attr("tabindex", 0).attr("role", "button");
        marker.append("circle").attr("class", "map-lens-city-hit");
        marker.append("circle").attr("class", "map-lens-city-bubble");
        marker.append("text").attr("class", "map-lens-city-count");
        marker.append("text").attr("class", "map-lens-city-label");
        marker.append("title");
        return marker;
      });

    lensMarkers.attr("aria-label", city => `${cityNamesFr[city.key] ?? city.city}, ${city.country} : ${city.count} offres`)
      .on("click", selectCity)
      .on("keydown", (event, city) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectCity(event, city);
        }
      });

    lensMarkers.each(function(city) {
      const g = d3.select(this);
      const r = Math.max(6, radius(city.count));
      const isSmall = r < 10;
      const offset = lensLabelOffsets[city.key] ?? { dx: 0, dy: -1 };

      const hitR = isSmall ? 12 : (r + 1);
      g.select(".map-lens-city-hit").attr("r", hitR);
      g.select(".map-lens-city-bubble").attr("r", r);

      const countText = g.select(".map-lens-city-count")
        .text(city.count)
        .classed("inside", !isSmall)
        .classed("above", isSmall);

      if (isSmall) {
        const countY = offset.dy < 0 ? (r + 11) : (-r - 4);
        countText.attr("y", countY).attr("dy", "0");
      } else {
        countText.attr("y", 0).attr("dy", "0.35em");
      }

      const labelY = offset.dy < 0 ? (-r - (isSmall ? 15 : 5)) : (r + (isSmall ? 22 : 13));
      g.select(".map-lens-city-label")
        .attr("x", offset.dx)
        .attr("y", labelY)
        .attr("text-anchor", "middle")
        .text(cityNamesFr[city.key] ?? city.city);

      g.select("title").text(`${cityNamesFr[city.key] ?? city.city}, ${city.country} : ${formatNumber.format(city.count)} offres`);
    });

    updateCityPositions();

    root.select(".map-total").text(`${formatNumber.format(selectedJobs.length)} offres retenues, dont ${formatNumber.format(locatedJobs.length)} sur la carte (${cities.length} villes).`);
    root.select(".map-global").text(`Global : ${formatNumber.format(globalJobs.length)} offres sans pays précis, accessibles mondialement.`);
    const unlocatedCount = localJobs.length - locatedJobs.length;
    root.select(".map-unlocated").text(unlocatedCount
      ? `${formatNumber.format(unlocatedCount)} autres offres sans coordonnées connues, conservées dans le tableau.` : "");

    const tableRows = Array.from(d3.group(selectedJobs, job => `${job.country}|${job.city}`), ([key, jobs]) => ({
      key, country: jobs[0].country, city: jobs[0].city, count: jobs.length,
    })).sort((a, b) => b.count - a.count);
    const rows = root.select("tbody").selectAll("tr").data(tableRows, row => row.key).join("tr");
    rows.selectAll("td").data(row => [row.country, row.city, formatNumber.format(row.count)])
      .join("td").text(value => value);
    if (countries.length) {
      root.select(".map-message").text(selectedJobs.length ? "" : "Aucune offre ne correspond à ces filtres.");
    }
    renderSelectionPanel(selectedJobs);
  }

  for (const column of selects) root.select(`#map-${column}`).on("change", render);
  salaryInput.on("input", render);
  remoteInput.on("change", render);
  root.select("#map-reset-filters").on("click", () => {
    for (const column of selects) root.select(`#map-${column}`).property("value", "");
    salaryInput.property("value", salaryInput.attr("min"));
    remoteInput.property("checked", false);
    render();
  });
  root.select("#map-reset-zoom").on("click", resetZoom);
  countrySelect.on("change", () => {
    const name = countrySelect.property("value");
    if (!name) {
      clearSelection();
      return resetZoom();
    }
    const feature = countries.find(feature => countryName(feature) === name);
    if (feature) {
      zoomToCountry(feature);
    } else {
      const points = Object.entries(cityCoordinates).filter(([key]) => key.split("|")[0] === name)
        .map(([, coordinates]) => projection(coordinates));
      if (!points.length) {
        clearSelection();
        return resetZoom();
      }
      continentSelect.property("value", "");
      setLensMode("off");
      selectedCountryName = name;
      selectedCityKey = null;
      zoomToBounds([[d3.min(points, point => point[0]) - 5, d3.min(points, point => point[1]) - 5],
        [d3.max(points, point => point[0]) + 5, d3.max(points, point => point[1]) + 5]]);
      renderSelectionPanel();
      updateCityLabel();
    }
  });
  continentSelect.selectAll("option.continent").data(Object.keys(continentBounds))
    .join("option").attr("class", "continent").attr("value", name => name).text(name => name);
  continentSelect.on("change", () => {
    const bounds = continentBounds[continentSelect.property("value")];
    countrySelect.property("value", "");
    clearSelection();
    if (bounds) zoomToBounds(bounds.map(projection));
    else resetZoom();
  });

  JobApp.subscribe(nextState => {
    const newDataset = state?.jobs !== nextState.jobs;
    state = nextState;
    if (newDataset) {
      clearSelection();
      const names = [...new Set(state.jobs.map(job => job.country).filter(name => name && name !== "Global"))].sort();
      countrySelect.selectAll("option.country").data(names, name => name)
        .join("option").attr("class", "country").attr("value", name => name).text(name => name);
      for (const column of selects) {
        const values = [...new Set(state.jobs.map(job => job[column]).filter(Boolean))].sort();
        root.select(`#map-${column}`).selectAll("option.filter-value").data(values)
          .join("option").attr("class", "filter-value").attr("value", value => value).text(value => value);
        root.select(`#map-${column}`).property("value", "");
      }
      const salaries = state.jobs.map(job => job.annual_salary_usd).filter(value => value !== null && value >= 0);
      const minimum = Math.floor((d3.min(salaries) ?? 0) / 1000) * 1000;
      const maximum = Math.ceil((d3.max(salaries) ?? 0) / 1000) * 1000;
      salaryInput.attr("min", minimum).attr("max", maximum)
        .property("value", minimum).property("disabled", minimum === maximum);
      remoteInput.property("checked", false);
      const counts = d3.rollup(state.jobs.filter(job => job.has_geographic_location), jobs => jobs.length,
        job => `${job.country}|${job.city}`);
      radius = d3.scaleSqrt().domain([0, d3.max(counts.values()) || 1]).range([0, 18]);
      resetZoom();
    }
    render();
  });

  d3.json(worldUrl).then(world => {
    countries = world.features.filter(feature => feature.properties.name !== "Antarctica");
    
    countryLayer.selectAll("path").data(countries).join("path")
      .attr("class", "map-country").attr("d", path)
      .on("click", (event, feature) => {
        event.stopPropagation();
        zoomToCountry(feature);
      }).append("title");

    lensCountryLayer.selectAll("path").data(countries).join("path")
      .attr("class", "map-country").attr("d", path)
      .on("click", (event, feature) => {
        event.stopPropagation();
        zoomToCountry(feature);
      }).append("title");

    render();
    if (!state) root.select(".map-message").text("En attente des données…");
  }).catch(error => {
    console.error("Impossible de charger le fond de carte :", error);
    root.select(".map-message").text("Fond de carte indisponible. Les offres restent consultables dans le tableau.");
  });
})();
