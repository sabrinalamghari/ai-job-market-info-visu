// Visualisation 3 : ce fichier est chargé après l’analyse du HTML grâce à defer.
(() => {
  const container = document.getElementById("visualization-3");
  if (!container) return;

  JobApp.subscribe(({ filteredJobs, jobs, quality, filters }) => {

  });
})();
