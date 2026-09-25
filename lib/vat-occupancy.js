// 缸位占用判定：哪些批次算"在泡"、缸是否空置、占用冲突、缸位看板
export const SOAKING_STATUSES = ["入缸", "发酵中", "异常观察"];
export const DEFAULT_VATS = ["一号缸", "二号缸", "三号缸", "四号缸", "五号缸", "六号缸"];

export function isSoaking(item) {
  return SOAKING_STATUSES.includes(item.status);
}

// 保证缸口名册完整：默认缸 + 批次在用的缸 + 交接记录里出现过的缸
export function ensureVatRegistry(db) {
  const names = new Set(db.vats && db.vats.length ? db.vats : DEFAULT_VATS);
  for (const item of db.items || []) if (item.vat) names.add(item.vat);
  for (const change of db.vatChanges || []) {
    if (change.from) names.add(change.from);
    if (change.to) names.add(change.to);
  }
  db.vats = [...names];
  db.vatChanges ||= [];
  return db;
}

export function vatBatches(items, vat) {
  return (items || []).filter(item => item.vat === vat);
}

// 新缸是否已被别的在泡批次占用（excludeId 用于排除批次自身）
export function findSoakingConflict(items, vat, excludeId) {
  return (items || []).find(item =>
    item.vat === vat && isSoaking(item) && item.id !== excludeId && item.code !== excludeId
  ) || null;
}

// 按缸汇总：在泡/关联批次与空置状态，最近交接由 vat-changes 模块补充
export function buildVatBoard(db) {
  ensureVatRegistry(db);
  return db.vats.map(name => {
    const batches = vatBatches(db.items, name).map(item => ({
      id: item.id || item.code,
      code: item.code || item.id,
      status: item.status,
      owner: item.owner,
      soaking: isSoaking(item)
    }));
    return { name, batches, vacant: batches.length === 0 };
  });
}
