const ANNOUNCEMENT_URL = "https://jpxkc.cbex.com/page/jpxkc/info/gg_list";
const RESULT_URL = "https://jpxkc.cbex.com/page/jpxkc/info/jggs_list";
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

function shorten(text, limit) {
  const value = normalize(text);
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function lineFor(label, item, titleLimit) {
  if (!item) return `${label}: 暂无数据`;
  return `${label}: ${shorten(item.title, titleLimit)} | ${item.date || "无日期"}`;
}

async function main() {
  const [announcementRaw, resultRaw] = await Promise.all([
    request(ANNOUNCEMENT_URL),
    request(RESULT_URL),
  ]);

  const latestAnnouncement = parseListPayload(announcementRaw, "公告")[0] || null;
  const latestResult = parseListPayload(resultRaw, "结果公示")[0] || null;

  finish({
    title: "京牌小客车监控",
    content: [
      lineFor("公告", latestAnnouncement, 18),
      lineFor("结果", latestResult, 18),
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
