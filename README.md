# 古法纸浆发酵记录

运行：

```bash
npm start
```

访问`http://localhost:3039`。数据保存在`data/paper-pulp-fermentation.json`。

## 换缸交接

- 批次卡片上填新缸、时间、经手人、水温；保存时记录原缸并占用新缸，新缸已有在泡批次、或批次当前缸与表单原缸对不上时拒绝保存。
- 观察与备注会带上当时缸位，批次卡时间线可回看换缸前后。
- 缸位看板按缸显示在泡批次、空置和最近交接。

业务分层：`lib/vat-handovers.js`（交接记录）、`lib/vat-occupancy.js`（占用判定）、`public/vat-handover.js`（界面动作）。
