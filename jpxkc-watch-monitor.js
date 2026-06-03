const API_URL = "https://jpxkc.cbex.com/service/jpxkc/prj/wgcsList";
const STORAGE_KEY = "surge:jpxkc:watchlist:wgcs";

const WATCHLIST = [
  {
    id: "582698",
    plate: "京NL1951",
    label: "最少围观",
    detail: "https://jpxkc.cbex.com/jpxkc/prj/detail/582698.html",
  },
  {
    id: "580619",
    plate: "京ACQ693",
    label: "最低价",
    detail: "https://jpxkc.cbex.com/jpxkc/prj/detail/580619.html",
  },
  {
    id: "581435",
    plate: "京FB5713",
    label: "最低价",
    detail: "https://jpxkc.cbex.com/jpxkc/prj/detail/581435.html",
  },
  {
    id: "586809",
    plate: "京P8M279",
    label: "最低价",
    detail: "https://jpxkc.cbex.com/jpxkc/prj/detail/586809.html",
  },
  {
    id: "584583",
    plate: "京Q2Q6W7",
    label: "最低价",
    detail: "https://jpxkc.cbex.com/jpxkc/prj/detail/584583.html",
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
    return `${item.plate} ${item.label}: ${current}`;
  }
  const delta = current - previous;
  const sign = delta > 0 ? `+${delta}` : `${delta}`;
  return `${item.plate} ${item.label}: ${current} (${sign})`;
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
    notify("京牌小客车围观监控已初始化", "已记录 5 辆车当前围观量", lines.join("\n"));
    return;
  }

  if (!changed) {
    return;
  }

  notify("京牌小客车围观量更新", "监控车牌围观数有变化", lines.join("\n"));
}

main()
  .catch((error) => {
    notify("京牌小客车围观监控失败", "", String(error && error.message ? error.message : error));
  })
  .finally(finish);
