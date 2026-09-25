// 换缸交接记录：校验当前缸、判定新缸占用，落一条交接记录并让批次占用新缸。
import { occupantOf } from "./vat-occupancy.js";

export class VatChangeError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let seq = 0;
function handoverId() {
  return "VH-" + Date.now() + "-" + (seq += 1);
}

// 必填新缸、时间、经手人、水温；原缸以表单带回的为准，必须与批次当前缸一致。
export function applyVatChange(db, item, input) {
  const fromVat = String(input.fromVat || "").trim();
  const toVat = String(input.toVat || "").trim();
  const at = String(input.at || "").trim();
  const operator = String(input.operator || "").trim();
  const temperature = String(input.temperature || "").trim();

  if (!toVat || !at || !operator || !temperature) {
    throw new VatChangeError(400, "missing_fields", "新缸、时间、经手人和水温都要填写");
  }
  if (isNaN(Date.parse(at))) {
    throw new VatChangeError(400, "bad_time", "时间格式不对");
  }
  if (toVat === item.vat) {
    throw new VatChangeError(400, "same_vat", "新缸与当前缸相同，无需换缸");
  }
  if (fromVat !== (item.vat || "")) {
    // 批次当前缸和表单对不上：可能别人已换过缸，拒绝越过，避免覆盖他人交接。
    throw new VatChangeError(409, "vat_mismatch", `批次当前缸已是「${item.vat || "未填"}」，与表单原缸「${fromVat || "空"}」对不上，请刷新后再试`);
  }
  const occupant = occupantOf(db.items, toVat, item.id || item.code);
  if (occupant) {
    throw new VatChangeError(409, "vat_occupied", `「${toVat}」已有在泡批次 ${occupant.code || occupant.id}，不能换入`);
  }

  const record = {
    id: handoverId(),
    itemId: item.id || item.code,
    code: item.code,
    fromVat: item.vat,
    toVat,
    at,
    operator,
    temperature,
    savedAt: new Date().toISOString()
  };
  db.handovers ||= [];
  db.handovers.push(record);

  item.vat = toVat; // 占用新缸
  item.logs ||= [];
  item.logs.push({
    at,
    step: "换缸",
    vat: toVat,
    note: `${fromVat} → ${toVat}，水温${temperature}，经手人${operator}`
  });
  return record;
}
