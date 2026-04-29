const ENGINE_PATH = "/engine/";
const DEMO_URL = "https://gmh-code.github.io/qwasm2/q2-314-demo-x86.exe";
const DEMO_ARCHIVE = "q2-314-demo-x86.exe";
const DEMO_PAK_PATH = "Install/Data/baseq2/pak0.pak";
const DEMO_PAK_NAME = "pak0.pak";
const DB_NAME = "radd-data";
const STORE_NAME = "demo-cache";

const launcher = document.getElementById("launcher");
const stage = document.getElementById("stage");
const statusPanel = document.getElementById("statusPanel");
const statusElement = document.getElementById("status");
const progressElement = document.getElementById("progress");
const canvasElement = document.getElementById("canvas");
const outputElement = document.getElementById("output");
const exportElement = document.getElementById("exportFile");
const pakFiles = document.getElementById("pakFiles");
const dropZone = document.getElementById("dropZone");
const fileCount = document.getElementById("fileCount");
const resetButton = document.getElementById("resetButton");
const soloButton = document.getElementById("soloButton");
const multiButton = document.getElementById("multiButton");
const demoButton = document.getElementById("demoButton");
const ageCheckBox = document.getElementById("ageCheckBox");
const touchCheckBox = document.getElementById("touchCheckBox");
const vidSelectBox = document.getElementById("vidSelectBox");
const playerName = document.getElementById("playerName");
const proxyUrl = document.getElementById("proxyUrl");
const serverAddress = document.getElementById("serverAddress");
const fullscreenButton = document.getElementById("fullscreenButton");
const consoleButton = document.getElementById("consoleButton");

let pakDict = {};
let jsZipLoaded = false;
let engineStarted = false;
let bootMode = "solo";

const saved = {
  name: localStorage.getItem("radd.playerName"),
  renderer: localStorage.getItem("radd.renderer"),
  touch: localStorage.getItem("radd.touch"),
  proxy: localStorage.getItem("radd.proxyUrl"),
  server: localStorage.getItem("radd.serverAddress")
};

if (saved.name) playerName.value = saved.name;
if (saved.renderer) vidSelectBox.value = saved.renderer;
if (saved.proxy) proxyUrl.value = saved.proxy;
if (saved.server) serverAddress.value = saved.server;
if (saved.touch === null) {
  touchCheckBox.checked = navigator.maxTouchPoints > 1 && navigator.maxTouchPoints < 256;
} else {
  touchCheckBox.checked = saved.touch === "1";
}

function setButtons() {
  const allowed = ageCheckBox.checked && !engineStarted;
  soloButton.disabled = !allowed;
  demoButton.disabled = !allowed;
  multiButton.disabled = !allowed || !serverAddress.value.trim();
}

function setStatus(text) {
  statusElement.innerHTML = text || "";
}

function saveSettings() {
  localStorage.setItem("radd.playerName", playerName.value.trim() || "RADD Player");
  localStorage.setItem("radd.renderer", vidSelectBox.value);
  localStorage.setItem("radd.touch", touchCheckBox.checked ? "1" : "0");
  localStorage.setItem("radd.proxyUrl", proxyUrl.value.trim());
  localStorage.setItem("radd.serverAddress", serverAddress.value.trim());
}

function updateFileCount() {
  const count = Object.keys(pakDict).length;
  fileCount.textContent = count === 0 ? "No local files selected" : `${count} file${count === 1 ? "" : "s"} ready`;
}

function printText(text) {
  outputElement.value += `${text}\n`;
  if (outputElement.value.length > 2097152) {
    outputElement.value = outputElement.value.slice(-1048576);
  }
  outputElement.scrollTop = outputElement.scrollHeight;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDBData(key, data) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(data, key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadDBData(key) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const req = tx.objectStore(STORE_NAME).get(key);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function showStage(message) {
  launcher.hidden = true;
  stage.hidden = false;
  statusPanel.hidden = false;
  setStatus(message);
  window.scrollTo(0, 0);
}

async function loadFiles(files) {
  for (const file of files) {
    const name = file.name.toLowerCase();
    const data = new Uint8Array(await file.arrayBuffer());
    pakDict[name] = data;
  }
  updateFileCount();
}

async function loadScript(src) {
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureJSZip() {
  if (jsZipLoaded) return;
  setStatus("Loading demo extractor...");
  await loadScript(`${ENGINE_PATH}jszip.min.js`);
  jsZipLoaded = true;
}

async function useDemo() {
  bootMode = "solo";
  saveSettings();
  showStage("Restoring cached demo...");

  try {
    await ensureJSZip();
    let zipBlob = await loadDBData(DEMO_ARCHIVE);
    if (!zipBlob) {
      setStatus(`Downloading original ${DEMO_ARCHIVE}...`);
      const response = await fetch(DEMO_URL);
      if (!response.ok) throw new Error(`Demo download failed with HTTP ${response.status}`);
      zipBlob = await response.blob();
      saveDBData(DEMO_ARCHIVE, zipBlob).catch((error) => console.warn("Demo cache failed:", error));
    }

    setStatus("Extracting demo PAK...");
    const zip = await JSZip.loadAsync(zipBlob);
    if (!zip.files[DEMO_PAK_PATH]) throw new Error("Demo PAK was not found in the archive.");
    pakDict[DEMO_PAK_NAME] = await zip.files[DEMO_PAK_PATH].async("uint8array");
    startGame();
  } catch (error) {
    window.alert(`Please supply PAK file(s) manually. ${error.message}`);
    stage.hidden = true;
    launcher.hidden = false;
    setButtons();
  }
}

function buildArguments() {
  const args = ["+set", "name", playerName.value.trim() || "RADD Player"];
  const renderer = vidSelectBox.value;

  if (renderer) {
    args.push("+set", "vid_renderer", renderer);
  }

  if (touchCheckBox.checked) {
    for (const scaleArg of ["r_consolescale", "r_hudscale", "r_menuscale", "crosshair_scale"]) {
      args.push("+set", scaleArg, "-1");
    }
  }

  if (bootMode === "multiplayer") {
    const server = serverAddress.value.trim();
    if (server) args.push("+connect", server);
  }

  if (window.location.search.length > 1) {
    args.push(...window.location.search.substring(1).split("&").filter(Boolean));
  }

  return args;
}

function configureModule() {
  const proxy = proxyUrl.value.trim();

  window.Module = {
    _canLockPointer: true,
    _depsLastLeft: 0,
    _depsDone: 0,
    _depsTotal: 0,
    locateFile: (path) => `${ENGINE_PATH}${path}`,
    arguments: buildArguments(),
    canvas: (() => {
      canvasElement.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        window.alert("WebGL context lost. Reload the page to restart RADD.");
      }, false);
      return canvasElement;
    })(),
    print: (text) => {
      console.log(text);
      printText(text);
    },
    printErr: (text) => {
      console.error(text);
      printText(`(!) ${text}`);
    },
    setStatus: (text) => {
      if (!text) {
        progressElement.hidden = true;
        return;
      }

      const match = text.match(/([^(]+)\((\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?|\?)\)/);
      if (match) {
        const loaded = Number(match[2]);
        const total = match[3] === "?" ? 0 : Number(match[3]);
        setStatus(`${match[1].trim()}<br>${Math.round(loaded / 1024)} KiB${total ? ` of ${Math.round(total / 1024)} KiB` : ""}`);
        if (total) {
          progressElement.value = loaded;
          progressElement.max = total;
          progressElement.hidden = false;
        }
      } else {
        progressElement.hidden = true;
        setStatus(text);
      }
    },
    monitorRunDependencies: (left) => {
      const diff = window.Module._depsLastLeft - left;
      if (diff !== 0) {
        if (diff > 0) window.Module._depsDone += diff;
        else window.Module._depsTotal -= diff;
        window.Module._depsLastLeft = left;
        setStatus(`Preparing dependencies...<br>${window.Module._depsDone} done, ${window.Module._depsTotal} found`);
      }
    },
    onRuntimeInitialized: () => {
      for (const pakFilename in pakDict) {
        const pakData = pakDict[pakFilename];
        const pakDestFile = FS.open(`/baseq2/${pakFilename}`, "w");
        FS.write(pakDestFile, pakData, 0, pakData.length, 0);
        FS.close(pakDestFile);
      }
      window.Module.showConsole();
      statusPanel.hidden = true;
      outputElement.focus();
    },
    hideConsole: () => {
      if (touchCheckBox.checked && window.olyOn) window.olyOn();
      outputElement.style.display = "none";
      canvasElement.style.display = "block";
      canvasElement.focus();
    },
    showConsole: () => {
      if (touchCheckBox.checked && window.olyOff) window.olyOff();
      canvasElement.style.display = "none";
      outputElement.style.display = "block";
      outputElement.scrollTop = outputElement.scrollHeight;
      outputElement.focus();
    },
    exportFile: (filePath) => {
      try {
        const filePathSplit = filePath.split("/");
        const dataArray = new Uint8Array(FS.readFile(filePath));
        const dataBlob = new Blob([dataArray], { type: "application/octet-stream" });
        const objURL = URL.createObjectURL(dataBlob);
        exportElement.href = objURL;
        exportElement.download = filePathSplit[filePathSplit.length - 1];
        exportElement.click();
        URL.revokeObjectURL(objURL);
      } catch (error) {
        console.error("Error exporting file:", error);
      }
    },
    setGamma: (vidGamma) => {
      const gamma = Number(Number(vidGamma).toFixed(2));
      canvasElement.style.filter = gamma < 0 ? null : `brightness(${gamma * 2})`;
    },
    captureMouse: () => {
      if (!touchCheckBox.checked && window.Module._canLockPointer && !window.Module._attemptPointerLock()) {
        window.Module._canLockPointer = false;
        document.addEventListener("keydown", window.Module._lockPointerOnKey);
      }
    },
    _attemptPointerLock: () => {
      if (document.pointerLockElement === null) canvasElement.requestPointerLock();
      return document.pointerLockElement !== null;
    },
    _lockPointerOnKey: (event) => {
      if (event.key === "Escape" || window.Module._attemptPointerLock()) {
        document.removeEventListener("keydown", window.Module._lockPointerOnKey);
        window.Module._canLockPointer = true;
      }
    },
    winResized: () => {
      const height = window.innerHeight - 64;
      const width = Math.min(window.innerWidth, height * (canvasElement.width / Math.max(canvasElement.height, 1)));
      canvasElement.style.width = `${Math.max(320, width)}px`;
    },
    softExit: (status) => console.info("Program exited with code", status)
  };

  if (proxy) {
    window.Module.websocket = {
      url: proxy,
      subprotocol: "binary"
    };
  }
}

async function maybeLoadTouchControls() {
  if (!touchCheckBox.checked) return;
  setStatus("Preparing touch controls...");
  await loadScript(`${ENGINE_PATH}oly.js`);
  if (window.olySetup) {
    window.olySetup({
      Escape: { lbl: "Menu" },
      Enter: { lbl: "Use", pos: [15, 0] },
      ArrowUp: { lbl: "Up", pos: [0, 15] },
      ArrowDown: { lbl: "Down", pos: [0, 30] },
      ArrowLeft: { lbl: "Left", pos: [15, 15] },
      ArrowRight: { lbl: "Right", pos: [15, 30] },
      KeyW: { lbl: "W", anc: "B", pos: [10, 20], shape: "U" },
      KeyS: { lbl: "S", anc: "B", pos: [10, 0], shape: "D" },
      KeyA: { lbl: "A", anc: "B", pos: [0, 10], shape: "L" },
      KeyD: { lbl: "D", anc: "B", pos: [20, 10], shape: "R" },
      ControlLeft: { lbl: "Aim", anc: "RB", pos: [0, 10], shape: "" },
      Space: { lbl: "Jump", anc: "RB", pos: [25, 20] },
      KeyC: { lbl: "Duck", anc: "RB", pos: [25, 5] }
    }, 1);
  }
}

async function startGame(mode = bootMode) {
  if (engineStarted) return;
  bootMode = mode;
  engineStarted = true;
  saveSettings();
  showStage("Starting RADD...");
  configureModule();
  await maybeLoadTouchControls();
  setStatus("Downloading engine...");
  await loadScript(`${ENGINE_PATH}index.js`);
}

ageCheckBox.addEventListener("change", setButtons);
serverAddress.addEventListener("input", setButtons);
resetButton.addEventListener("click", () => {
  pakFiles.value = "";
  pakDict = {};
  updateFileCount();
});

pakFiles.addEventListener("change", async () => {
  await loadFiles(pakFiles.files);
});

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
}

dropZone.addEventListener("drop", async (event) => {
  await loadFiles(event.dataTransfer.files);
});

soloButton.addEventListener("click", () => startGame("solo"));
multiButton.addEventListener("click", () => startGame("multiplayer"));
demoButton.addEventListener("click", useDemo);

fullscreenButton.addEventListener("click", () => {
  const target = canvasElement.style.display === "block" ? canvasElement : stage;
  if (document.fullscreenElement) document.exitFullscreen();
  else target.requestFullscreen?.();
});

consoleButton.addEventListener("click", () => {
  if (!window.Module) return;
  if (outputElement.style.display === "block") window.Module.hideConsole();
  else window.Module.showConsole();
});

window.onerror = (message) => {
  setStatus("Exception thrown. Check the browser console.");
  console.error(message);
};

updateFileCount();
setButtons();
