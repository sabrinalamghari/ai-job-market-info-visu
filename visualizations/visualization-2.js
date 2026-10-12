// Visualisation 2 : ce fichier est chargé après l’analyse du HTML grâce à defer.
(() => {
  const container = document.getElementById("visualization-2");
  if (!container) return;

  JobApp.subscribe(({ filteredJobs, jobs, quality, filters }) => {

  });
})();
