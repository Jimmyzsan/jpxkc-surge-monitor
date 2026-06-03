const API_URL = "https://jpxkc.cbex.com/service/jpxkc/prj/wgcsList";

const WATCHLIST = [
  {
    id: "582698",
    plate: "京NL1951",
    label: "最少围观",
  },
  {
    id: "580619",
    plate: "京ACQ693",
    label: "最低价",
  },
  {
    id: "581435",
    plate: "京FB5713",
    label: "最低价",
  },
  {
    id: "586809",
    plate: "京P8M279",
    label: "最低价",
  },
  {
    id: "584583",
    plate: "京Q2Q6W7",
    label: "最低价",
  },
];

function finish(payload) {
  $done(payload);
}

function requestWgcs(ids) {
  return new Promise((resolve, reject) => {
    $httpClient.post(
      {
        url: API_URL,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: `t=${Date.now()}&ids=${encodeURIComponent(ids.join(","))}`,
        timeout: 15000,
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
        try {
          const json = JSON.parse(data || "{}");
          if (!json.success || !json.object || !Array.isArray(json.object.wgcsList)) {
            reject(new Error("围观接口返回异常"));
            return;
          }
          resolve(json.object.wgcsList);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

function formatCount(value) {
  if (value === null || typeof value === "undefined") return "--";
  return String(value);
}

async function main() {
  const response = await requestWgcs(WATCHLIST.map((item) => item.id));
  const data = {};
  for (const entry of response) {
    data[String(entry.XMID)] = Number(entry.WGCS);
  }

  const cold = WATCHLIST[0];
  const lowPriceCars = WATCHLIST.slice(1);
  const lowPriceText = lowPriceCars
    .map((item) => `${item.plate.slice(-3)}:${formatCount(data[item.id])}`)
    .join(" ");

  finish({
    title: "京牌围观监控",
    content: [
      `${cold.plate} ${formatCount(data[cold.id])}`,
      `低价组 ${lowPriceText}`,
    ].join("\n"),
    icon: "eye.circle",
    "icon-color": "#34C759",
  });
}

main().catch((error) => {
  finish({
    title: "京牌围观监控",
    content: `获取失败: ${String(error && error.message ? error.message : error)}`,
    icon: "exclamationmark.triangle",
    "icon-color": "#FF9500",
  });
});
