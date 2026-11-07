// Optional browser integration check: node scripts/check-parallel.cjs
// Uses installed Chrome and Node's built-in CDP/WebSocket support, no extra dependency.
const { spawn } = require("node:child_process");
const { mkdtempSync, readFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const chrome = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const express = require("express");
const app = express();
app.use(express.static(path.resolve(__dirname, "..")));
const server = app.listen(0, "127.0.0.1");
let browser, socket, closeBrowser;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  await new Promise(resolve => server.listening ? resolve() : server.once("listening", resolve));
  const profile = mkdtempSync(path.join(tmpdir(), "parallel-browser-"));
  const url = `http://127.0.0.1:${server.address().port}/visualizations/visualization-2/visualization-2.html`;
  browser = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile}`, url], { windowsHide: true, stdio: "ignore" });
  browser.on("error", error => { console.error(error); process.exitCode = 1; });
  let tabs;
  for (let i = 0; i < 100; i++) {
    try {
      const port = readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0];
      tabs = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter(tab => tab.type === "page");
      if (tabs.length) break;
    } catch { /* Browser startup is asynchronous. */ }
    await delay(100);
  }
  assert.ok(tabs?.length, "Chrome CDP available");
  socket = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map(), errors = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(JSON.stringify(message.params.args));
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    const timer = setTimeout(() => { pending.delete(next); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(next, message => { clearTimeout(timer); message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result); });
    socket.send(JSON.stringify({ id: next, method, params }));
  });
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const check = async (expression, message) => assert.ok(await evaluate(expression), message);
  closeBrowser = () => call("Browser.close").catch(() => {});
  await call("Runtime.enable");
  await call("Page.enable");
  for (let i = 0; i < 100; i++) {
    if (await evaluate('document.querySelectorAll(".parallel-axis").length === 6')) break;
    await delay(100);
  }
  await check('document.querySelectorAll(".parallel-axis").length === 6', `six axes rendered; browser errors: ${JSON.stringify(errors)}; page: ${await evaluate('JSON.stringify({url:location.href,html:document.documentElement.outerHTML.slice(0,1500)})')}`);
  await check('document.querySelector(".parallel-summary").textContent.includes("25 / 25")', "25 initial profiles");
  await evaluate(`globalThis.controls = document.querySelectorAll(".parallel-toolbar select");
    globalThis.change = (element, value) => { element.value = value; element.dispatchEvent(new Event("change", {bubbles:true})); };
    change(controls[0], "AI Engineer"); change(controls[1], "RAG Engineer");`);
  await check('document.querySelectorAll(".parallel-selected-profile").length === 2 && !document.querySelector(".parallel-pair table")', "two compact selected profiles without table");
  await evaluate('document.querySelector(".parallel-details button").click()');
  await check('document.querySelectorAll(".parallel-analysis-results:not([hidden]) button").length === 3', "three similar profiles in the selected job details");
  await evaluate('document.querySelector(".parallel-details button").click()');
  await check('document.querySelector(".parallel-analysis-results").hidden && !document.querySelector(".parallel-insights, .parallel-presets, .parallel-similar")', "similarity panel closes and legacy panels are absent");
  await check('!document.querySelector(".parallel-filter-panel").open && document.querySelectorAll("#global-filters select").length === 7 && document.querySelectorAll(".global-filter-fields select").length === 4', "advanced filters are collapsed and include four advanced controls");
  await check('document.querySelectorAll(".parallel-legend li").length === 5 && !document.querySelector(".parallel-legend button")', "family legend is informative and passive");
  await evaluate(`document.querySelectorAll(".parallel-brush")[0].dispatchEvent(new KeyboardEvent("keydown", {key:"Enter",bubbles:true}))`);
  const brush = await evaluate('document.querySelector(".parallel-brush .selection").getAttribute("y")');
  await evaluate(`document.querySelector(".parallel-axis-label").dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowRight",bubbles:true}))`);
  await delay(250);
  await check(`document.querySelector(".parallel-brush .selection").getAttribute("y") === ${JSON.stringify(brush)}`, "keyboard reorder retains brush");
  await check('document.querySelectorAll(".parallel-selected-profile").length === 2', "reorder retains comparison");
  // Real pointer drag on the title handle; the body brush stays untouched.
  await evaluate('document.querySelector(".parallel-scroll").scrollIntoView({block:"center"})');
  const point = await evaluate(`(() => {const r=document.querySelector(".parallel-axis-label").getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  const axisPosition = await evaluate('document.querySelector(".parallel-axis").getAttribute("transform")');
  await call("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
  for (let dx = 30; dx <= 220; dx += 30) await call("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x + dx, y: point.y, button: "left", buttons: 1 });
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x + 220, y: point.y, button: "left", clickCount: 1 });
  await delay(250);
  await check(`document.querySelector(".parallel-axis").getAttribute("transform") !== ${JSON.stringify(axisPosition)}`, "pointer drag actually changes order");
  await check(`document.querySelector(".parallel-brush .selection").getAttribute("y") === ${JSON.stringify(brush)}`, "pointer drag retains brush");
  const overlay = await evaluate(`(() => {const r=document.querySelectorAll(".parallel-brush .overlay")[2].getBoundingClientRect(); return {x:r.x+r.width/2,top:r.y,height:r.height};})()`);
  await call("Input.dispatchMouseEvent", { type: "mousePressed", x: overlay.x, y: overlay.top + overlay.height * .2, button: "left", clickCount: 1 });
  await call("Input.dispatchMouseEvent", { type: "mouseMoved", x: overlay.x, y: overlay.top + overlay.height * .7, button: "left", buttons: 1 });
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: overlay.x, y: overlay.top + overlay.height * .7, button: "left", clickCount: 1 });
  await check('document.querySelectorAll(".parallel-brush .selection[y]").length === 2', "multiple brushes combine after reordering");
  await evaluate(`change(controls[2], "entry")`);
  await check('[...document.querySelectorAll(".parallel-axis-label")].some(label => label.textContent.includes("Salaire Entry"))', "salary axis switches to Entry mode");
  await check('document.querySelector(".parallel-brush .selection").getAttribute("display") !== "none"', "salary switch retains brushes");
  await evaluate('document.getElementById("parallel-clear-brushes").click()');
  await evaluate('JobApp.setFilters({country:"France",experience_level:"Entry (0-2 yrs)"})');
  await check('document.querySelectorAll(".parallel-axis").length === 6 && document.querySelector(".parallel-filter-panel > summary").textContent.includes("2 actifs")', "global filters update the profiles and active-filter count");
  await evaluate('JobApp.resetFilters()');
  await evaluate(`change(controls[2], "global"); JobApp.setFilters({experience_level:"Entry (0-2 yrs)"});`);
  await check('document.querySelectorAll(".parallel-axis").length === 6', "six dimensions remain available after global filtering");
  await evaluate(`JobApp.resetFilters(); document.getElementById("parallel-reset").click()`);
  await check('document.querySelector(".parallel-summary").textContent.includes("25 / 25")', "reset restores overview");
  await check('!document.getElementById("csv-file")', "manual CSV upload is not present");
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await check('document.documentElement.scrollWidth <= innerWidth + 1', "responsive page avoids horizontal overflow outside chart");
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log("Browser checks passed: selection, comparison, similar jobs, filters, drag, brushes, Entry, reset and responsive layout.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await closeBrowser?.(); socket?.close(); browser?.kill(); server.close(); });
