const API_URL =
  "https://dict.youdao.com/infoline/style/cardList?mode=publish&client=mobile&style=daily&size=2";

function finish(payload) {
  $done(payload);
}

function request(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url, timeout: 15000 }, (error, response, data) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }
      if (!response || response.status >= 400) {
        reject(new Error(`HTTP ${response ? response.status : "unknown"}`));
        return;
      }
      resolve(data || "");
    });
  });
}

function normalize(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function shorten(text, limit) {
  const value = normalize(text);
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1))}…`;
}

async function main() {
  const raw = await request(API_URL);
  const list = JSON.parse(raw);
  const item = Array.isArray(list) && list.length > 1 ? list[1] : null;

  if (!item) {
    throw new Error("未获取到每日一句");
  }

  finish({
    title: "每日一句",
    content: `${shorten(item.title, 26)}\n${shorten(item.summary, 28)}`,
    icon: "book.closed.circle",
    "icon-color": "#FF9F0A",
  });
}

main().catch((error) => {
  finish({
    title: "每日一句",
    content: `获取失败: ${String(error && error.message ? error.message : error)}`,
    icon: "exclamationmark.triangle",
    "icon-color": "#FF9500",
  });
});
