# JPXKC Surge Monitor

用于在 Surge 中定时检查北京产权交易所京牌小客车页面，并监控京牌小客车司法处置候选车。

## 文件

- `jpxkc-monitor.js`: 公告和结果公示更新监控
- `jpxkc-watch-monitor.js`: 3-5 万价位动态候选车监控
- `jpxkc-panel.js`: Surge 面板脚本
- `jpxkc-watch-panel.js`: 候选车面板脚本
- `wnCalendar.js`: 自托管黄历播报和面板脚本

## GitHub 路径

- 仓库地址: `https://github.com/Jimmyzsan/jpxkc-surge-monitor`
- 公告监控 Raw 地址: `https://raw.githubusercontent.com/Jimmyzsan/jpxkc-surge-monitor/main/jpxkc-monitor.js`
- 候选车监控 Raw 地址: `https://raw.githubusercontent.com/Jimmyzsan/jpxkc-surge-monitor/main/jpxkc-watch-monitor.js`
- 候选车面板 Raw 地址: `https://raw.githubusercontent.com/Jimmyzsan/jpxkc-surge-monitor/main/jpxkc-watch-panel.js`
- 黄历 Raw 地址: `https://raw.githubusercontent.com/Jimmyzsan/jpxkc-surge-monitor/main/wnCalendar.js`

## Surge 配置示例

```ini
京牌公告监控 = type=cron,cronexp=0 * * * *,wake-system=1,script-path=https://raw.githubusercontent.com/Jimmyzsan/jpxkc-surge-monitor/main/jpxkc-monitor.js,script-update-interval=300

京牌3-5万候选监控 = type=cron,cronexp=0 */3 * * *,wake-system=1,script-path=https://raw.githubusercontent.com/Jimmyzsan/jpxkc-surge-monitor/main/jpxkc-watch-monitor.js,script-update-interval=300

黄历播报 = type=cron,timeout=30,cronexp=8 10 * * *,wake-system=1,argument=notify=1,script-path=https://raw.githubusercontent.com/Jimmyzsan/jpxkc-surge-monitor/main/wnCalendar.js,script-update-interval=300
```

## Surge 面板配置示例

```ini
京牌3-5万候选 = type=generic,script-path=https://raw.githubusercontent.com/Jimmyzsan/jpxkc-surge-monitor/main/jpxkc-watch-panel.js,script-update-interval=300

今日黄历 = type=generic,timeout=30,script-path=https://raw.githubusercontent.com/Jimmyzsan/jpxkc-surge-monitor/main/wnCalendar.js,script-update-interval=300
```

## 公告监控行为

- 每次执行时请求：
  - `https://jpxkc.cbex.com/page/jpxkc/info/gg_list`
  - `https://jpxkc.cbex.com/page/jpxkc/info/jggs_list`
- 解析当前最新一条 `公告` 和 `结果公示`
- 首次运行时写入本地基线并提示“已初始化”
- 后续仅在出现新条目时发送通知
- 如果请求或解析失败，会发送失败通知

## 候选车监控行为

- 请求官方动态列表接口：`https://jpxkc.cbex.com/page/jpxkc/search/prj_li`
- 默认按 `最高限价 3 万-5 万` 筛选
- 按低围观优先，并对明显热门车型和 3 万边缘低价车做轻微降权
- 每次输出当前最可能中拍的 1 辆车和 Top 5 备选
- 首次运行会初始化基线
- 后续当 Top 候选或围观数据变化时推送手机通知
- 面板脚本会显示当前 Top 1 和 Top 4 简表
- 多人报最高限价时，最终仍按累计摇号次数和指标系统注册时间排序

## 黄历脚本行为

- 脚本托管在本仓库，避免依赖别人的 Raw 链接
- 内部日历数据走 jsDelivr 镜像，避开 `raw.githubusercontent.com`
- Cron 配置使用 `argument=notify=1` 时才发送手机通知
- Panel 配置不带 `argument=notify=1`，只显示面板内容
