const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (request, response) => response.sendFile(path.join(__dirname, "index.html")));
app.get("/index.html", (request, response) => response.sendFile(path.join(__dirname, "index.html")));
app.get("/vendor/d3.min.js", (request, response) => {
  response.sendFile(path.join(__dirname, "node_modules/d3/dist/d3.min.js"));
});
for (const directory of ["css", "js", "data"]) {
  app.use(`/${directory}`, express.static(path.join(__dirname, directory)));
}

app.listen(port, "127.0.0.1", () => {
  console.log(`Application disponible sur http://localhost:${port}`);
});
