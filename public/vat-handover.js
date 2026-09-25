// 换缸交接的界面动作：缸位看板渲染、批次卡换缸表单、提交保存与失败提示。
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 记录里统一存 UTC ISO，展示时转成浏览器本地时间。
function fmtAt(at) {
  const s = String(at || "");
  if (s.length <= 10) return s;
  const d = new Date(s);
  if (isNaN(d)) return s;
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

let onChanged = () => {};

export function initVatHandover(reload) {
  onChanged = reload;
  document.addEventListener("submit", event => {
    const form = event.target.closest("form[data-vat-change]");
    if (!form) return;
    event.preventDefault();
    submitVatChange(form);
  });
}

// 拉取并按缸渲染：在泡批次 / 空置 / 最近交接；同时刷新新缸输入的候选列表。
export async function refreshVatBoard() {
  const res = await fetch("/api/vats");
  const data = await res.json();
  const board = document.querySelector("#vatBoard");
  if (board) {
    board.innerHTML = data.vats.map(vatHtml).join("") || '<div class="meta">暂无缸位</div>';
  }
  const datalist = document.querySelector("#vatNames");
  if (datalist) {
    datalist.innerHTML = data.vats.map(v => `<option value="${esc(v.name)}"></option>`).join("");
  }
}

function vatHtml(vat) {
  const state = vat.occupant
    ? `<span class="pill">在泡</span> <b>${esc(vat.occupant.code || vat.occupant.id)}</b> · ${esc(vat.occupant.owner || "")} · ${esc(vat.occupant.status)}`
    : '<span class="pill vacant">空置</span>';
  const handover = vat.lastHandover
    ? `<div class="meta">最近交接：${fmtAt(vat.lastHandover.at)} ${esc(vat.lastHandover.fromVat)} → ${esc(vat.lastHandover.toVat)} · ${esc(vat.lastHandover.operator)} · 水温${esc(vat.lastHandover.temperature)}</div>`
    : '<div class="meta">暂无交接</div>';
  return `<div class="vat"><div><b>${esc(vat.name)}</b> ${state}</div>${handover}</div>`;
}

// 批次卡上的换缸表单：原缸由卡片以隐藏域带回，填新缸、时间、经手人、水温。
export function handoverFormHtml(item) {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return `<form class="vat-change" data-vat-change="${esc(item.id || item.code)}">
    <b>换缸交接</b>
    <input type="hidden" name="fromVat" value="${esc(item.vat || "")}">
    <label>新缸</label><input name="toVat" list="vatNames" required>
    <label>时间</label><input name="at" type="datetime-local" value="${now.toISOString().slice(0, 16)}" required>
    <label>经手人</label><input name="operator" required>
    <label>水温</label><input name="temperature" placeholder="如 22℃" required>
    <button type="submit">保存换缸</button>
  </form>`;
}

// 保存：新缸被占或当前缸对不上时后端会拒绝，这里提示原因且不刷新，保住已填内容。
async function submitVatChange(form) {
  const id = form.dataset.vatChange;
  const payload = Object.fromEntries(new FormData(form).entries());
  const at = new Date(payload.at); // datetime-local 是本地时间，转成 ISO 再存，时间线才排得对
  if (isNaN(at)) {
    alert("时间格式不对");
    return;
  }
  payload.at = at.toISOString();
  const res = await fetch("/api/items/" + encodeURIComponent(id) + "/vat-change", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "换缸保存失败");
    return;
  }
  await onChanged();
}
