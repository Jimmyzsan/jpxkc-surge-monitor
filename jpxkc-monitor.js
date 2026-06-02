const ANNOUNCEMENT_URL = "https://jpxkc.cbex.com/page/jpxkc/info/gg_list";
const RESULT_URL = "https://jpxkc.cbex.com/page/jpxkc/info/jggs_list";
const STORAGE_KEY = "surge:jpxkc:latest";
const REQUEST_TIMEOUT = 15000;

function finish() {
  $done({});
}

function notify(title, subtitle, body) {
  $notification.post(title, subtitle || "", body || "");
}

function readState() {
  const raw = $persistentStore.read(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function writeState(state) {
  $persistentStore.write(JSON.stringify(state), STORAGE_KEY);
}

function request(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get(
      {
        url,
        timeout: REQUEST_TIMEOUT,
        headers: {
          "User-Agent": "Surge JPXKC Monitor/1.0",
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
  const input = String(text || "");
  const items = uniqueByKey([
    ...parseHtmlRows(input, category),
    ...parsePipeTable(input, category),
    ...parseInlineTriples(input, category),
  ]);
  return items;
}

function getLatest(items) {
  return items[0] || null;
}

function isDifferent(current, previous) {
  if (!current) return false;
  if (!previous) return true;
  return (
    current.title !== previous.title ||
    (current.date || "") !== (previous.date || "") ||
    (current.type || "") !== (previous.type || "")
  );
}

function formatItem(item) {
  if (!item) return "无数据";
  const prefix = item.type ? `${item.type} | ` : "";
  return `${prefix}${item.title} | ${item.date || "无日期"}`;
}

async function main() {
  const [announcementRaw, resultRaw] = await Promise.all([
    request(ANNOUNCEMENT_URL),
    request(RESULT_URL),
  ]);

  const current = {
    announcement: getLatest(parseListPayload(announcementRaw, "公告")),
    result: getLatest(parseListPayload(resultRaw, "结果公示")),
    checkedAt: new Date().toISOString(),
  };

  if (!current.announcement && !current.result) {
    throw new Error("未解析到公告或结果公示内容");
  }

  const previous = readState();
  const announcementChanged = isDifferent(
    current.announcement,
    previous && previous.announcement
  );
  const resultChanged = isDifferent(current.result, previous && previous.result);

  if (!previous) {
    writeState(current);
    notify(
      "京牌小客车监控已初始化",
      "已记录当前基线",
      `公告: ${formatItem(current.announcement)}\n结果: ${formatItem(current.result)}`
    );
    return;
  }

  if (!announcementChanged && !resultChanged) {
    return;
  }

  writeState(current);

  const parts = [];
  if (announcementChanged && current.announcement) {
    parts.push(`公告更新: ${formatItem(current.announcement)}`);
  }
  if (resultChanged && current.result) {
    parts.push(`结果公示更新: ${formatItem(current.result)}`);
  }

  notify("京牌小客车有新更新", "发现新的公告或结果公示", parts.join("\n"));
}

main()
  .catch((error) => {
    notify("京牌小客车监控检查失败", "", String(error && error.message ? error.message : error));
  })
  .finally(finish);
