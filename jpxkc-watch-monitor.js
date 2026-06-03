const API_URL = "https://jpxkc.cbex.com/service/jpxkc/prj/wgcsList";
const STORAGE_KEY = "surge:jpxkc:plate-value-watchlist:wgcs";

const WATCHLIST = [
  {
    id: "580674",
    plate: "京NA9707",
    label: "Top1",
    price: "¥26,980",
    detail: "https://jpxkc.cbex.com/jpxkc/prj/detail/580674.html",
  },
  {
    id: "586470",
    plate: "京PJ8600",
    label: "Top2",
    price: "¥49,800",
    detail: "https://jpxkc.cbex.com/jpxkc/prj/detail/586470.html",
  },
  {
    id: "580854",
    plate: "京KK8128",
    label: "Top3",
    price: "¥50,000",
    detail: "https://jpxkc.cbex.com/jpxkc/prj/detail/580854.html",
  },
  {
    id: "582631",
    plate: "京QG6V13",
    label: "Top4",
    price: "¥50,940",
    detail: "https://jpxkc.cbex.com/jpxkc/prj/detail/582631.html",
  },
  {
    id: "586476",
    plate: "京MLM763",
    label: "Top5",
    price: "¥54,167",
    detail: "https://jpxkc.cbex.com/jpxkc/prj/detail/586476.html",
  },
];

function finish() {
  $done({});
}

function notify(title, subtitle, body) {
  $notification.post(title, subtitle || "", body || "");
}

function readState() {
  const raw = $persistentStore.read(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch (_) {
    return {};
  }
}

function writeState(state) {
  $persistentStore.write(JSON.stringify(state), STORAGE_KEY);
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

function diffLine(item, previous, current) {
  if (previous === null || typeof previous === "undefined") {
    return `${item.label} ${item.plate} ${item.price} 围观:${current}`;
  }
  const delta = current - previous;
  const sign = delta > 0 ? `+${delta}` : `${delta}`;
  return `${item.label} ${item.plate} ${item.price} 围观:${current} (${sign})`;
}

async function main() {
  const previousState = readState();
  const response = await requestWgcs(WATCHLIST.map((item) => item.id));
  const currentState = {};
  const lines = [];
  let changed = false;

  for (const item of WATCHLIST) {
    const found = response.find((entry) => String(entry.XMID) === item.id);
    const current = found ? Number(found.WGCS) : null;
    currentState[item.id] = current;
    const previous = previousState[item.id];
    if (current !== previous) {
      changed = true;
    }
    lines.push(diffLine(item, previous, current));
  }

  writeState(currentState);

  if (!Object.keys(previousState).length) {
    notify("京牌拿牌候选监控已初始化", "已记录 Top 5 候选当前围观量", lines.join("\n"));
    return;
  }

  if (!changed) {
    return;
  }

  notify("京牌拿牌候选围观量更新", "Top 5 候选围观数有变化", lines.join("\n"));
}

main()
  .catch((error) => {
    notify("京牌拿牌候选监控失败", "", String(error && error.message ? error.message : error));
  })
  .finally(finish);
