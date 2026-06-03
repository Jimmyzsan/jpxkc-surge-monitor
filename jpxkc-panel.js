const ANNOUNCEMENT_URL = "https://jpxkc.cbex.com/page/jpxkc/info/gg_list";
const CURRENT_BATCH_URL = "https://jpxkc.cbex.com/jpxkc/zc_prjs/2400.html";
const REQUEST_TIMEOUT = 15000;

function finish(payload) {
  $done(payload);
}

function request(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get(
      {
        url,
        timeout: REQUEST_TIMEOUT,
        headers: {
          "User-Agent": "Surge JPXKC Panel/1.0",
          Accept: "*/*",
        },
      },
      (error, response, data) => {
        if (error) {
          reject(new Error(String(error)));
          return;
        }
        if (!response || response.status >= 400) {
          reject(new Error(`HTTP ${response ? response.status : "unknown"}`));
          return;
        }
        resolve(data || "");
      }
    );
  });
}

function normalize(text) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(text) {
  return normalize(
    String(text || "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  );
}

function uniqueByKey(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.title}__${item.date || ""}__${item.category || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parsePipeTable(text, category) {
  const items = [];
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes("|")) continue;
    const cols = line
      .split("|")
      .map((part) => normalize(part))
      .filter(Boolean);
    if (cols.length < 2) continue;
    if (/^(公告名称|结果公示名称|---)$/i.test(cols[0])) continue;
    const title = cols[0];
    const date = cols[cols.length - 1];
    if (!title || !date) continue;
    items.push({ category, title, date });
  }
  return items;
}

function parseInlineTriples(text, category) {
  const items = [];
  const pattern = /([^\r\n|]+?)\s*\|\s*([^\r\n|]+?)\s*\|\s*((?:20\d{2}[-./]\d{1,2}(?:[-./]\d{1,2})?(?:\s+\d{1,2}:\d{2}:\d{2})?)|(?:20\d{2}\.\d{1,2}\.\d{1,2}\s+\d{1,2}:\d{2}))(?=\s|$)/g;
  let match;
  while ((match = pattern.exec(String(text || "")))) {
    items.push({
      category,
      title: normalize(match[1]),
      type: normalize(match[2]),
      date: normalize(match[3]),
    });
  }
  return items;
}

function parseHtmlRows(text, category) {
  const items = [];
  const rowPattern = /<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(String(text || "")))) {
    const row = rowMatch[1];
    const cellMatches = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
    const cells = cellMatches
      .map((cell) => decodeHtml(cell.replace(/<[^>]+>/g, " ")))
      .filter(Boolean);
    if (cells.length < 2) continue;
    if (/^(公告名称|结果公示名称)$/i.test(cells[0])) continue;
    const dateCandidate = cells[cells.length - 1];
    if (!/20\d{2}[-./]\d{1,2}/.test(dateCandidate)) continue;
    items.push({
      category,
      title: cells[0],
      type: cells.length > 2 ? cells[1] : "",
      date: dateCandidate,
    });
  }
  return items;
}

function parseListPayload(text, category) {
  return uniqueByKey([
    ...parseHtmlRows(text, category),
    ...parsePipeTable(text, category),
    ...parseInlineTriples(text, category),
  ]);
}

function extractCurrentBatchInfo(text) {
  const html = String(text || "");
  const titleMatch = html.match(/京牌小客车司法处置第(\d+)期/);
  const signupMatch = html.match(/报名及保证金交纳截止时间[^0-9]*(20\d{2}[.-]\d{1,2}[.-]\d{1,2})/);
  const startMatch = html.match(/竞价开始时间[^0-9]*(20\d{2}[.-]\d{1,2}[.-]\d{1,2})/);
  return {
    batch: titleMatch ? titleMatch[1] : "",
    signupDate: signupMatch ? signupMatch[1].replace(/\./g, "-") : "",
    startDate: startMatch ? startMatch[1].replace(/\./g, "-") : "",
  };
}

function shorten(text, limit) {
  const value = normalize(text);
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function shortDate(value) {
  const text = normalize(value).replace(/\./g, "-");
  const match = text.match(/(20\d{2}-\d{1,2}-\d{1,2})/);
  return match ? match[1] : value || "无日期";
}

function extractBatch(title) {
  const text = normalize(title);
  const batchMatch = text.match(/(20\d{4}期)/);
  if (batchMatch) {
    if (text.includes("竞价结果")) return `${batchMatch[1]}结果`;
    if (text.includes("竞买人相关信息公示")) return `${batchMatch[1]}公示`;
    return batchMatch[1];
  }
  if (text.includes("撤销")) return shorten(text.replace(/^关于/, ""), 16);
  return shorten(text, 16);
}

function lineFor(label, item) {
  if (!item) return `${label}: 暂无数据`;
  return `${label}: ${extractBatch(item.title)} ${shortDate(item.date)}`;
}

async function main() {
  const [announcementRaw, currentBatchRaw] = await Promise.all([
    request(ANNOUNCEMENT_URL),
    request(CURRENT_BATCH_URL),
  ]);

  const latestAnnouncement = parseListPayload(announcementRaw, "公告")[0] || null;
  const currentBatch = extractCurrentBatchInfo(currentBatchRaw);
  const batchLine = currentBatch.batch
    ? `本期: ${currentBatch.batch}期开拍 ${currentBatch.startDate || "--"}`
    : "本期: 日期待确认";

  finish({
    title: "京牌小客车监控",
    content: [
      lineFor("公告", latestAnnouncement),
      batchLine,
    ].join("\n"),
    icon: "car.circle",
    "icon-color": "#4DA3FF",
  });
}

main().catch((error) => {
  finish({
    title: "京牌小客车监控",
    content: `获取失败: ${String(error && error.message ? error.message : error)}`,
    icon: "exclamationmark.triangle",
    "icon-color": "#FF9500",
  });
});
