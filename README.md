# JPXKC Surge Monitor

用于在 Surge 中定时检查北京产权交易所京牌小客车页面的最新 `公告` 和 `结果公示`。

## 文件

- `jpxkc-monitor.js`: Surge 定时脚本

## 建议仓库名

- `jpxkc-surge-monitor`

## 建议 GitHub 路径

- 仓库地址: `https://github.com/<YOUR_GITHUB_NAME>/jpxkc-surge-monitor`
- Raw 地址: `https://raw.githubusercontent.com/<YOUR_GITHUB_NAME>/jpxkc-surge-monitor/main/jpxkc-monitor.js`

## Surge 配置示例

```ini
京牌小客车监控 = type=cron,cronexp=0 * * * *,wake-system=1,script-path=https://raw.githubusercontent.com/<YOUR_GITHUB_NAME>/jpxkc-surge-monitor/main/jpxkc-monitor.js,script-update-interval=300
```

## 脚本行为

- 每次执行时请求：
  - `https://jpxkc.cbex.com/page/jpxkc/info/gg_list`
  - `https://jpxkc.cbex.com/page/jpxkc/info/jggs_list`
- 解析当前最新一条 `公告` 和 `结果公示`
- 首次运行时写入本地基线并提示“已初始化”
- 后续仅在出现新条目时发送通知
- 如果请求或解析失败，会发送失败通知

## 下一步

1. 在 GitHub 创建一个公开仓库：`jpxkc-surge-monitor`
2. 上传 `jpxkc-monitor.js`
3. 把 Raw 地址填进 Surge

