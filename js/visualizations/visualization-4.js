// Visualisation 4 : ce fichier est chargé après l’analyse du HTML grâce à defer.
(() => {
  const container = document.getElementById("visualization-4");
  if (!container) return;

  JobApp.subscribe(({ filteredJobs, jobs, quality, filters }) => {

  });
})();
