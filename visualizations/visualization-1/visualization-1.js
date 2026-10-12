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
  const formatNumber = new Intl.NumberFormat("fr-FR");
  const formatSalary = new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  });
  let state;
  let countries = [];
  let currentZoom = d3.zoomIdentity;
  let radius = d3.scaleSqrt();
  let selectedCityKey = null;

  const root = d3.select(container);
  const selects = ["industry", "job_category", "job_title"];
  const salaryInput = root.select("#map-salary");
  const remoteInput = root.select("#map-remote");
  const countrySelect = root.select("#map-country");
  const continentSelect = root.select("#map-continent");
  const cityLabel = root.select(".map-city-label");
  const projection = d3.geoEquirectangular()
    .fitExtent([[10, 10], [width - 10, height - 10]], { type: "Sphere" });
  const path = d3.geoPath(projection);
  const svg = root.select(".map-canvas").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("aria-label", "Carte mondiale des offres d’emploi en IA")
    .attr("aria-describedby", "map-help");
  const map = svg.append("g");
  map.append("path").datum({ type: "Sphere" }).attr("class", "map-ocean").attr("d", path);
  map.append("path").datum(d3.geoGraticule10()).attr("class", "map-graticule").attr("d", path);
  const countryLayer = map.append("g");
  const cityLayer = map.append("g");

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
  svg.on("click", () => {
    selectedCityKey = null;
    updateCityLabel();
  }).on("keydown", event => {
    if (event.key === "Escape") {
      selectedCityKey = null;
      updateCityLabel();
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
    countrySelect.property("value", countryName(feature));
    continentSelect.property("value", "");
    // Focus on the main landmass for countries with distant islands
    const geometry = feature.geometry;
    const mainland = geometry.type === "MultiPolygon"
      ? { type: "Polygon", coordinates: d3.greatest(geometry.coordinates,
        coordinates => d3.geoArea({ type: "Polygon", coordinates })) }
      : geometry;
    zoomToBounds(path.bounds(mainland));
  }

  function resetZoom() {
    countrySelect.property("value", "");
    continentSelect.property("value", "");
    svg.interrupt().call(zoom.transform, d3.zoomIdentity);
  }

  function updateCityPositions() {
    cityLayer.selectAll(".map-city").attr("transform", city => {
      const [x, y] = projection(cityCoordinates[city.key]);
      return `translate(${x},${y}) scale(${1 / currentZoom.k})`;
    });
    cityLayer.selectAll("text").attr("display", currentZoom.k >= 3 ? null : "none");
    updateCityLabel();
  }

  function updateCityLabel() {
    const markers = cityLayer.selectAll(".map-city");
    const city = markers.data().find(city => city.key === selectedCityKey);
    markers.classed("map-city-selected", city => city.key === selectedCityKey)
      .attr("aria-pressed", city => city.key === selectedCityKey);
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
    cityLabel.text(`${city.city}, ${city.country} : ${formatNumber.format(city.count)} offres`)
      .property("hidden", false);
    const box = svg.node().getBoundingClientRect();
    const scale = box.width / width;
    const label = cityLabel.node();
    const left = Math.max(8, Math.min(box.width - label.offsetWidth - 8, (x + Math.max(4, radius(city.count))) * scale + 8));
    const top = Math.max(8, Math.min(box.height - label.offsetHeight - 8, y * scale - label.offsetHeight / 2));
    cityLabel.style("left", `${left}px`).style("top", `${top}px`);
  }

  function selectCity(event, city) {
    event.stopPropagation();
    selectedCityKey = selectedCityKey === city.key ? null : city.key;
    updateCityLabel();
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
    const countryCounts = d3.rollup(localJobs, jobs => jobs.length, job => job.country);

    countryLayer.selectAll("path")
      .classed("map-country-active", feature => (countryCounts.get(countryName(feature)) ?? 0) > 0)
      .select("title").text(feature => `${countryName(feature)} : ${formatNumber.format(countryCounts.get(countryName(feature)) ?? 0)} offres`);

    const markers = cityLayer.selectAll(".map-city")
      .data(cities.sort((a, b) => b.count - a.count), city => city.key)
      .join(enter => {
        const marker = enter.append("g").attr("class", "map-city").attr("tabindex", 0).attr("role", "button");
        marker.append("circle");
        marker.append("text").attr("text-anchor", "middle").attr("dy", "0.35em");
        marker.append("title");
        return marker;
      });
    markers.attr("aria-label", city => `${city.city}, ${city.country} : ${city.count} offres`)
      .on("click", selectCity).on("keydown", (event, city) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectCity(event, city);
        }
      });
    markers.select("circle").attr("r", city => Math.max(4, radius(city.count)));
    markers.select("text").text(city => city.count);
    markers.select("title").text(city => `${city.city}, ${city.country} : ${formatNumber.format(city.count)} offres`);
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
    const feature = countries.find(feature => countryName(feature) === name);
    if (feature) zoomToCountry(feature);
    else {
      const points = Object.entries(cityCoordinates).filter(([key]) => key.split("|")[0] === name)
        .map(([, coordinates]) => projection(coordinates));
      if (!points.length) return resetZoom();
      continentSelect.property("value", "");
      zoomToBounds([[d3.min(points, point => point[0]) - 5, d3.min(points, point => point[1]) - 5],
        [d3.max(points, point => point[0]) + 5, d3.max(points, point => point[1]) + 5]]);
    }
  });
  continentSelect.selectAll("option.continent").data(Object.keys(continentBounds))
    .join("option").attr("class", "continent").attr("value", name => name).text(name => name);
  continentSelect.on("change", () => {
    const bounds = continentBounds[continentSelect.property("value")];
    countrySelect.property("value", "");
    if (bounds) zoomToBounds(bounds.map(projection));
    else resetZoom();
  });

  JobApp.subscribe(nextState => {
    const newDataset = state?.jobs !== nextState.jobs;
    state = nextState;
    if (newDataset) {
      selectedCityKey = null;
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
      .on("click", (event, feature) => zoomToCountry(feature)).append("title");
    render();
    if (!state) root.select(".map-message").text("En attente des données…");
  }).catch(error => {
    console.error("Impossible de charger le fond de carte :", error);
    root.select(".map-message").text("Fond de carte indisponible. Les offres restent consultables dans le tableau.");
  });
})();
