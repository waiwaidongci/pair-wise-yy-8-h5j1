// 界面动作：缸位看板渲染、批次卡片上的换缸交接表单
window.VatUI = (() => {
  let vats = [];

  function esc(value) {
    return String(value ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  }
  function fmt(at) {
    return at ? String(at).slice(5, 16).replace("T", " ") : "";
  }
  async function fetchBoard() {
    const res = await fetch("/api/vats");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "缸位加载失败");
    vats = data.vats || [];
    return vats;
  }
  function vatCardHtml(vat) {
    const batches = vat.batches.length
      ? vat.batches.map(b => '<span class="pill">' + esc(b.code) + " · " + esc(b.status) + (b.soaking ? " · 在泡" : "") + "</span>").join(" ")
      : '<span class="pill">空置</span>';
    const handovers = (vat.handovers || []).map(h =>
      "<div>" + fmt(h.at) + " · " + esc(h.code) + " " + esc(h.from) + "→" + esc(h.to) + " · " + esc(h.handler) + " · 水温" + esc(h.temperature) + "</div>"
    ).join("");
    return '<article class="card"><h3>' + esc(vat.name) + "</h3><div>" + batches + '</div><div class="logs meta">' + (handovers || "暂无交接记录") + "</div></article>";
  }
  // 缸位看板：按缸显示在泡批次、空置和最近交接
  async function mountBoard(el) {
    if (!el) return;
    try {
      await fetchBoard();
      el.innerHTML = "<h2>缸位看板 · 在泡批次 / 空置 / 最近交接</h2>" + '<div class="grid">' + vats.map(vatCardHtml).join("") + "</div>";
    } catch (error) {
      el.innerHTML = "<h2>缸位看板</h2><div class='meta'>" + esc(error.message) + "</div>";
    }
  }
  // 批次卡片内的换缸交接表单：填新缸、时间、经手人、水温
  function enhanceCards(root, reload) {
    root.querySelectorAll("[data-vat-change]").forEach(form => {
      const current = form.dataset.currentVat;
      const select = form.querySelector('select[name="toVat"]');
      select.innerHTML = vats.filter(v => v.name !== current).map(v => "<option>" + esc(v.name) + "</option>").join("");
      const atInput = form.querySelector('input[name="at"]');
      if (atInput && !atInput.value) {
        const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
        atInput.value = local.toISOString().slice(0, 16);
      }
      form.onsubmit = async event => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        data.fromVat = current; // 带上卡片所示的当前缸，供服务端核对
        const res = await fetch("/api/items/" + encodeURIComponent(form.dataset.vatChange) + "/vat-change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) {
          alert(result.message || "换缸被拒绝：" + (result.error || res.status));
          return;
        }
        form.reset();
        await reload();
      };
    });
  }
  return { mountBoard, enhanceCards };
})();
