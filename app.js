// TC Part Explorer - Trimble Connect 3D Viewer extension (prototype)
//
// Web port of the WPF app's TrimbleConnectService:
//   1. read Name / Profile / Material of every object in the loaded models
//   2. live search
//   3. click a row -> select + zoom in the 3D viewer
//
// Runs inside Trimble Connect (iframe) and talks to it via the Workspace API.

"use strict";

// Same matching rule as the C# version: case-insensitive "contains".
// Exact matches are preferred over partial ones (e.g. "Profile" beats "Profile type").
const KEYS = { name: "name", profile: "profile", material: "material" };

// getObjectProperties is called in batches to stay responsive on big Tekla models.
const BATCH_SIZE = 500;

const el = {
  refreshBtn: document.getElementById("refreshBtn"),
  connStatus: document.getElementById("connStatus"),
  searchBox: document.getElementById("searchBox"),
  partsBody: document.getElementById("partsBody"),
  status: document.getElementById("status"),
};

let api = null;
let allParts = [];   // { name, profile, material, modelId, id }
let selectedRow = null;

// ---------------------------------------------------------------- connect

async function connect() {
  if (window.parent === window) {
    setConn("Trimble Connect の中で開いてください（拡張機能として登録が必要）", "err");
    return;
  }

  try {
    api = await TrimbleConnectWorkspace.connect(window.parent, onEvent, 30000);
    const project = await api.project.getProject();
    setConn(`接続済み - ${project.name}`, "ok");
    el.refreshBtn.disabled = false;
    el.searchBox.disabled = false;
    await loadParts();
  } catch (e) {
    console.error(e);
    setConn("接続に失敗しました: " + (e.message || e), "err");
  }
}

function onEvent(event, args) {
  // Reload automatically when models are loaded/unloaded.
  if (event === "viewer.onModelStateChanged") {
    console.log("model state changed", args);
  }
}

// ---------------------------------------------------------------- load

async function loadParts() {
  el.refreshBtn.disabled = true;
  setStatus("モデルを読み込み中...");

  try {
    const result = [];
    // [{ modelId, objects: [{ id }, ...] }, ...] for all loaded models
    const modelObjects = await api.viewer.getObjects();

    for (const mo of modelObjects) {
      const ids = mo.objects.map(o => o.id);

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        setStatus(`読み込み中... ${Math.min(i + BATCH_SIZE, ids.length)} / ${ids.length}`);

        const propsList = await api.viewer.getObjectProperties(mo.modelId, batch);
        for (const props of propsList) {
          const part = buildPart(mo.modelId, props);
          if (part) result.push(part);
        }
      }
    }

    allParts = result;
    render();
  } catch (e) {
    console.error(e);
    setStatus("部材の読み込みに失敗しました: " + (e.message || e));
  } finally {
    el.refreshBtn.disabled = false;
  }
}

// props = { id, product: { name, ... }, properties: [{ name: setName, properties: [{ name, value }] }] }
function buildPart(modelId, props) {
  const found = { name: null, profile: null, material: null };
  const exact = { name: false, profile: false, material: false };

  for (const set of props.properties || []) {
    for (const p of set.properties || []) {
      const attr = String(p.name || "").toLowerCase();
      for (const k of Object.keys(KEYS)) {
        if (exact[k] || !attr.includes(KEYS[k])) continue;
        const isExact = attr === KEYS[k];
        if (found[k] === null || isExact) {
          found[k] = p.value == null ? "" : String(p.value);
          exact[k] = isExact;
        }
      }
    }
  }

  if (found.name === null && props.product && props.product.name) {
    found.name = props.product.name;
  }

  // Skip organizational nodes that carry none of the three attributes.
  if (found.name === null && found.profile === null && found.material === null) return null;

  return {
    name: found.name || "",
    profile: found.profile || "",
    material: found.material || "",
    modelId,
    id: props.id,
  };
}

// ---------------------------------------------------------------- render / filter

function render() {
  const q = el.searchBox.value.trim().toLowerCase();
  const rows = q
    ? allParts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.profile.toLowerCase().includes(q) ||
        p.material.toLowerCase().includes(q))
    : allParts;

  // Rendering tens of thousands of rows in the DOM is slow; cap it in the prototype.
  const MAX_ROWS = 2000;
  const frag = document.createDocumentFragment();
  for (const p of rows.slice(0, MAX_ROWS)) {
    const tr = document.createElement("tr");
    for (const v of [p.name, p.profile, p.material]) {
      const td = document.createElement("td");
      td.textContent = v;
      tr.appendChild(td);
    }
    tr.addEventListener("click", () => selectAndZoom(p, tr));
    frag.appendChild(tr);
  }
  el.partsBody.replaceChildren(frag);
  selectedRow = null;

  const capped = rows.length > MAX_ROWS ? `（先頭 ${MAX_ROWS} 件を表示）` : "";
  setStatus(`${rows.length} / ${allParts.length} 件${capped}`);
}

// ---------------------------------------------------------------- select + zoom

async function selectAndZoom(part, tr) {
  if (selectedRow) selectedRow.classList.remove("selected");
  tr.classList.add("selected");
  selectedRow = tr;

  const selector = {
    modelObjectIds: [{ modelId: part.modelId, objectRuntimeIds: [part.id] }],
  };
  try {
    await api.viewer.setSelection(selector, "set");
    await api.viewer.setCamera(selector, { animationTime: 500 });
  } catch (e) {
    console.error(e);
    setStatus("選択に失敗しました: " + (e.message || e));
  }
}

// ---------------------------------------------------------------- helpers

function setConn(text, cls) {
  el.connStatus.textContent = text;
  el.connStatus.className = cls || "muted";
}

function setStatus(text) {
  el.status.textContent = text;
}

let searchTimer = 0;
el.searchBox.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, 150);
});
el.refreshBtn.addEventListener("click", loadParts);

connect();
