// 换缸交接记录：校验交接单、记录原缸并占用新缸、查询最近交接
import { findSoakingConflict } from "./vat-occupancy.js";

export class VatChangeError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function parseAt(input) {
  if (!input) return new Date().toISOString();
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

// 保存一次换缸交接：校验 → 记录原缸 → 占用新缸 → 写入时间线
export function applyVatChange(db, item, input) {
  const fromVat = String(input.fromVat ?? "").trim();
  const toVat = String(input.toVat ?? "").trim();
  const handler = String(input.handler ?? "").trim();
  const temperature = String(input.temperature ?? "").trim();
  if (!toVat) throw new VatChangeError(400, "missing_to_vat", "请填写新缸");
  if (!handler) throw new VatChangeError(400, "missing_handler", "请填写经手人");
  if (!temperature) throw new VatChangeError(400, "missing_temperature", "请填写交接水温");
  if (toVat === item.vat) throw new VatChangeError(400, "same_vat", "新缸与当前缸相同，无需换缸");
  // 批次当前缸对不上（页面过期或他人已改动），不允许越过
  if (fromVat !== item.vat) {
    throw new VatChangeError(409, "vat_mismatch", `批次当前缸是${item.vat || "空"}，与交接单不符，请刷新后重填`);
  }
  // 新缸已有在泡批次，拒绝保存
  const conflict = findSoakingConflict(db.items, toVat, item.id || item.code);
  if (conflict) {
    throw new VatChangeError(409, "vat_occupied", `${toVat}已有在泡批次${conflict.code || conflict.id}，不能换入`);
  }
  const at = parseAt(input.at);
  const record = { at, batchId: item.id || item.code, code: item.code || item.id, from: item.vat, to: toVat, handler, temperature };
  item.vatChanges ||= [];
  item.vatChanges.push({ at, from: record.from, to: toVat, handler, temperature });
  db.vatChanges ||= [];
  db.vatChanges.push(record);
  item.vat = toVat; // 占用新缸
  if (!db.vats.includes(toVat)) db.vats.push(toVat);
  item.logs ||= [];
  item.logs.push({ at, step: "换缸", vat: toVat, note: `${record.from}→${toVat}，经手人${handler}，水温${temperature}` });
  return record;
}

// 某口缸最近的交接（换入或换出都算），新的在前
export function recentHandovers(db, vat, limit = 3) {
  return (db.vatChanges || [])
    .filter(change => change.from === vat || change.to === vat)
    .slice()
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, limit);
}
