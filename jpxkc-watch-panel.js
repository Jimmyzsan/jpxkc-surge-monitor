const API_URL = "https://jpxkc.cbex.com/service/jpxkc/prj/wgcsList";

const VALUE_LIST = [
  {
    id: "580674",
    plate: "京NA9707",
    label: "Top1",
    price: "2.7w",
  },
  {
    id: "586470",
    plate: "京PJ8600",
    label: "Top2",
    price: "5.0w",
  },
  {
    id: "580854",
    plate: "京KK8128",
    label: "Top3",
    price: "5.0w",
  },
  {
    id: "582631",
    plate: "京QG6V13",
    label: "Top4",
    price: "5.1w",
  },
  {
    id: "586476",
    plate: "京MLM763",
    label: "Top5",
    price: "5.4w",
  },
];

const CHEAP_LIST = [
  {
    id: "580619",
    plate: "京ACQ693",
    price: "2.0w",
  },
  {
    id: "581435",
    plate: "京FB5713",
    price: "2.0w",
  },
  {
    id: "586809",
    plate: "京P8M279",
    price: "2.0w",
  },
  {
    id: "584583",
    plate: "京Q2Q6W7",
    price: "2.0w",
  },
];

const WATCHLIST = [...VALUE_LIST, ...CHEAP_LIST];

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

  const valueText = VALUE_LIST.slice(0, 2)
    .map((item) => `${item.plate.slice(-4)} ${item.price}/${formatCount(data[item.id])}`)
    .join(" ");
  const cheapText = CHEAP_LIST
    .map((item) => `${item.plate.slice(-3)} ${item.price}/${formatCount(data[item.id])}`)
    .join(" ");

  finish({
    title: "京牌分组监控",
    content: [
      `候选 ${valueText}`,
      `低价 ${cheapText}`,
    ].join("\n"),
    icon: "eye.circle",
    "icon-color": "#34C759",
  });
}

main().catch((error) => {
  finish({
    title: "京牌分组监控",
    content: `获取失败: ${String(error && error.message ? error.message : error)}`,
    icon: "exclamationmark.triangle",
    "icon-color": "#FF9500",
  });
});
