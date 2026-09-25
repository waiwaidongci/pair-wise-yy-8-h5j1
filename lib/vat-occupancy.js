// 浸泡缸占用判定：什么状态算"在泡"、缸被谁占着、按缸汇总看板数据。

// 这些状态的批次仍占着缸；"可抄纸" 视为已出缸抄纸，不再占用。
export const SOAKING_STATUSES = ["入缸", "发酵中", "异常观察"];

export function isSoaking(item) {
  return SOAKING_STATUSES.includes(item.status);
}

// 某口缸当前的在泡批次；exceptId 用于排除批次自身（换缸前查新缸时用）。
export function occupantOf(items, vat, exceptId) {
  if (!vat) return null;
  return items.find(item =>
    item.vat === vat &&
    isSoaking(item) &&
    item.id !== exceptId &&
    item.code !== exceptId
  ) || null;
}

// 所有出现过的缸：批次当前缸 + 交接记录里的原缸/新缸。
export function knownVats(items, handovers = []) {
  const names = new Set();
  for (const item of items) if (item.vat) names.add(item.vat);
  for (const record of handovers) {
    if (record.fromVat) names.add(record.fromVat);
    if (record.toVat) names.add(record.toVat);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

// 看板：每口缸的在泡批次（没有即空置）和最近一条交接。
export function vatBoard(items, handovers = []) {
  return knownVats(items, handovers).map(name => {
    const occupant = occupantOf(items, name, null);
    const lastHandover = handovers
      .filter(record => record.fromVat === name || record.toVat === name)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null;
    return {
      name,
      vacant: !occupant,
      occupant: occupant
        ? { id: occupant.id, code: occupant.code, owner: occupant.owner, status: occupant.status, days: occupant.days }
        : null,
      lastHandover
    };
  });
}
