const TITLE = "今日黄历";
const REQUEST_TIMEOUT = 15000;

function finish(payload) {
  $done(payload || {});
}

function shouldNotify() {
  return String(typeof $argument === "undefined" ? "" : $argument).includes("notify=1");
}

function request(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get(
      {
        url,
        timeout: REQUEST_TIMEOUT,
        headers: {
          "User-Agent": "Surge Huangli/1.0",
          Accept: "application/json,text/plain,*/*",
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

function pad2(value) {
  return String(value).padStart(2, "0");
}

function todayParts() {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    day: String(now.getDate()),
    month2: pad2(now.getMonth() + 1),
    dateText: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
  };
}

function dataUrls(parts) {
  const path = `calendar/${parts.year}/${parts.year}${parts.month2}.json`;
  return [
    `https://fastly.jsdelivr.net/gh/zqzess/openApiData@main/${path}`,
    `https://cdn.jsdelivr.net/gh/zqzess/openApiData@main/${path}`,
    `https://gcore.jsdelivr.net/gh/zqzess/openApiData@main/${path}`,
  ];
}

async function requestFirst(urls) {
  let lastError = null;
  for (const url of urls) {
    try {
      return await request(url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("所有日历数据源均不可用");
}

function findTodayEntry(payload, parts) {
  const json = JSON.parse(payload);
  const almanac =
    json &&
    json.data &&
    json.data[0] &&
    Array.isArray(json.data[0].almanac)
      ? json.data[0].almanac
      : [];

  return almanac.find(
    (item) =>
      String(item.year) === parts.year &&
      String(item.month) === parts.month &&
      String(item.day) === parts.day
  );
}

function joinDesc(entry) {
  return [entry.desc, entry.term, entry.value].filter(Boolean).join(" ");
}

function formatContent(entry) {
  const desc = joinDesc(entry) || "无";
  return [
    `干支: ${entry.gzYear || "--"}年 ${entry.gzMonth || "--"}月 ${entry.gzDate || "--"}日`,
    `农历: ${entry.lMonth || "--"}月${entry.lDate || "--"}`,
    `今日: ${desc}`,
    `宜: ${entry.suit || "--"}`,
    `忌: ${entry.avoid || "--"}`,
  ].join("\n");
}

async function main() {
  const parts = todayParts();
  const payload = await requestFirst(dataUrls(parts));
  const entry = findTodayEntry(payload, parts);
  if (!entry) {
    throw new Error(`未找到 ${parts.dateText} 的黄历数据`);
  }

  const subtitle = `${parts.dateText} 农历${entry.lMonth || "--"}月${entry.lDate || "--"}`;
  const content = formatContent(entry);

  if (shouldNotify()) {
    $notification.post(TITLE, subtitle, content);
  }

  finish({
    title: TITLE,
    content,
    icon: "calendar",
    "icon-color": "#5AC8FA",
  });
}

main().catch((error) => {
  const message = String(error && error.message ? error.message : error);
  if (shouldNotify()) {
    $notification.post(`${TITLE}获取失败`, "", message);
  }
  finish({
    title: TITLE,
    content: `获取失败: ${message}`,
    icon: "exclamationmark.triangle",
    "icon-color": "#FF9500",
  });
});
