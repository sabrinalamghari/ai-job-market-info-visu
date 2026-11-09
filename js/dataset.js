const JobDataset = (() => {
  const defaultUrl = new URL("../data/ai_jobs_market_2025_2026.csv", document.currentScript.src);
  const maxBytes = 5 * 1024 * 1024;
  const limits = { offers: 20000, titles: 200, skills: 300 };
  window.addEventListener("pageshow", event => {
    if (event.persisted) window.location.reload();
  });

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("Le stockage local est indisponible dans ce navigateur."));
      let abandoned = false;
      const request = indexedDB.open("ai-job-market", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("datasets");
      request.onerror = () => reject(new Error("Impossible d’accéder au stockage local du navigateur."));
      request.onblocked = () => {
        abandoned = true;
        reject(new Error("Fermez les autres onglets du site puis réessayez."));
      };
      request.onsuccess = () => {
        if (abandoned) request.result.close();
        else resolve(request.result);
      };
    });
  }

  async function storedDataset(mode, operation) {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction("datasets", mode);
        const request = operation(transaction.objectStore("datasets"));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = transaction.onabort = () => reject(new Error("Impossible de conserver le fichier dans ce navigateur. Le choix précédent reste inchangé."));
      });
    } finally {
      database.close();
    }
  }

  function prepareImport(text) {
    const content = text.replace(/^\uFEFF/, "");
    let parsed;
    for (const separator of [",", ";", "\t"]) {
      const rows = d3.dsvFormat(separator).parseRows(content);
      if (JobData.requiredColumns.every(column => rows[0]?.includes(column))) {
        parsed = rows;
        break;
      }
    }
    if (!parsed) throw new Error("Colonnes attendues absentes. Utilisez le même schéma que le CSV du projet (séparateur virgule, point-virgule ou tabulation).");
    const [columns, ...values] = parsed;
    if (new Set(columns).size !== columns.length || columns.some(column => !column.trim())) {
      throw new Error("Les noms de colonnes doivent être renseignés et uniques.");
    }
    if (!values.length) throw new Error("Le fichier doit contenir au moins une offre.");
    if (values.length > limits.offers) throw new Error("Le fichier dépasse la limite de 20 000 offres.");
    const malformed = values.findIndex(row => row.length !== columns.length);
    if (malformed !== -1) throw new Error(`La ligne de données ${malformed + 1} ne contient pas le bon nombre de champs.`);
    const rows = values.map(row => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
    const prepared = JobData.prepareData(rows, columns);
    if (prepared.jobs.some(job => !job.job_title || !job.job_category)) {
      throw new Error("Chaque offre doit renseigner job_title et job_category.");
    }
    const titles = new Set(prepared.jobs.map(job => job.job_title)).size;
    const skills = new Set(prepared.jobs.flatMap(job => job.required_skills)).size;
    if (titles > limits.titles || skills > limits.skills) {
      throw new Error("Ce fichier dépasse les capacités d’affichage : 200 métiers et 300 compétences au maximum.");
    }
    return prepared;
  }

  async function loadDefault(warning = "") {
    const rows = await d3.csv(defaultUrl);
    return { ...JobData.prepareData(rows), source: { name: "ai_jobs_market_2025_2026.csv", imported: false }, warning };
  }

  async function load() {
    let record;
    try {
      record = await storedDataset("readonly", store => store.get("active"));
    } catch (error) {
      return loadDefault(`${error.message} Le fichier du projet est utilisé.`);
    }
    if (!record) return loadDefault();
    try {
      if (typeof record.text !== "string" || typeof record.name !== "string") throw new Error();
      return { ...prepareImport(record.text), source: { name: record.name, imported: true }, warning: "" };
    } catch {
      return loadDefault("Le fichier conservé n’est plus compatible. Le fichier du projet est utilisé ; choisissez un autre CSV depuis l’accueil.");
    }
  }

  async function importFile(file) {
    if (!file || !/\.csv$/i.test(file.name)) throw new Error("Choisissez un fichier avec l’extension .csv.");
    if (file.size > maxBytes) throw new Error("Le fichier dépasse la taille maximale de 5 Mo.");
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    } catch {
      throw new Error("Impossible de lire ce fichier. Enregistrez le CSV avec l’encodage UTF-8 puis réessayez.");
    }
    const prepared = prepareImport(text);
    await storedDataset("readwrite", store => store.put({ name: file.name, text }, "active"));
    return { ...prepared, source: { name: file.name, imported: true }, warning: "" };
  }

  async function reset() {
    // Check the default source before discarding the imported file.
    const dataset = await loadDefault();
    await storedDataset("readwrite", store => store.delete("active"));
    return dataset;
  }

  return { load, importFile, reset };
})();
