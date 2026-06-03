const LIST_URL = "https://jpxkc.cbex.com/page/jpxkc/search/prj_li";
const REQUEST_TIMEOUT = 15000;

const PRICE_MIN = 30000;
const PRICE_MAX = 50000;
const PAGE_SIZE = 16;
const MAX_PAGES = 12;
const TOP_COUNT = 4;

function finish(payload) {
  $done(payload);
}

function postPage(pageNo, totalCount) {
  const body = [
    "id=null",
    "sortTag=0",
    `pageNo=${pageNo}`,
    `pageSize=${PAGE_SIZE}`,
    totalCount && pageNo !== 1 ? `_totalCount=${encodeURIComponent(totalCount)}` : "",
    "keyWord=",
  ]
    .filter(Boolean)
    .join("&");

  return new Promise((resolve, reject) => {
    $httpClient.post(
      {
        url: LIST_URL,
        timeout: REQUEST_TIMEOUT,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent": "Surge JPXKC Dynamic Panel/1.0",
          Accept: "*/*",
        },
        body,
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

function stripTags(html) {
  return decodeHtml(String(html || "").replace(/<[^>]+>/g, " "));
}

function parseMoney(text) {
  const value = String(text || "").replace(/[¥,\s]/g, "");
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseTotal(html) {
  const match = String(html || "").match(/total:\s*"(\d+)"/);
  return match ? Number(match[1]) : null;
}

function parseCars(html) {
  const cars = [];
  const liPattern = /<li\b[\s\S]*?<\/li>/gi;
  let match;
  while ((match = liPattern.exec(String(html || "")))) {
    const block = match[0];
    const idMatch = block.match(/detail\/(\d+)\.html/);
    const plateMatch = block.match(/车牌号：\s*([^<\s]+)/);
    const titleMatch = block.match(/<a[^>]*class="title"[^>]*>([\s\S]*?)<\/a>/i);
    const startMatch = block.match(/起始价：[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
    const maxMatch = block.match(/最高限价：[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
    const viewsMatch = block.match(/id="wgcs_\d+"\s*>\s*([^<]+)</i);

    const id = idMatch ? idMatch[1] : "";
    const maxPrice = parseMoney(maxMatch ? stripTags(maxMatch[1]) : "");
    if (!id || maxPrice === null) continue;

    cars.push({
      id,
      plate: plateMatch ? normalize(plateMatch[1]) : "",
      title: titleMatch ? stripTags(titleMatch[1]) : "",
      startPrice: parseMoney(startMatch ? stripTags(startMatch[1]) : ""),
      maxPrice,
      views: Number(String(viewsMatch ? viewsMatch[1] : "").replace(/,/g, "")),
    });
  }
  return cars;
}

function uniqueById(cars) {
  const seen = {};
  return cars.filter((car) => {
    if (seen[car.id]) return false;
    seen[car.id] = true;
    return true;
  });
}

function popularityPenalty(car) {
  const text = `${car.title} ${car.plate}`;
  let score = 0;
  if (/丰田|本田|雅阁|奥迪|宝马|奔驰|大众|帕萨特/.test(text)) score += 25;
  if (/别克|现代|起亚|东风|大通|荣威|雪佛兰|福特/.test(text)) score += 5;
  if (car.maxPrice <= 32000) score += 200;
  return score;
}

function rankCars(cars) {
  return cars
    .filter((car) => car.maxPrice >= PRICE_MIN && car.maxPrice <= PRICE_MAX)
    .map((car) => ({
      ...car,
      score: (Number.isFinite(car.views) ? car.views : 999999) + popularityPenalty(car),
    }))
    .sort((a, b) => a.score - b.score || a.views - b.views || b.maxPrice - a.maxPrice);
}

function priceWan(value) {
  if (value === null || typeof value === "undefined") return "--";
  return `${(Number(value) / 10000).toFixed(1)}w`;
}

function shortPlate(plate) {
  return String(plate || "").replace(/^京/, "");
}

function shortModel(car) {
  return normalize(car.title.replace(car.plate, "")).slice(0, 6);
}

async function loadCars() {
  const firstHtml = await postPage(1, null);
  const total = parseTotal(firstHtml) || 0;
  const totalPages = total ? Math.ceil(total / PAGE_SIZE) : MAX_PAGES;
  let all = parseCars(firstHtml);

  for (let pageNo = 2; pageNo <= Math.min(totalPages, MAX_PAGES); pageNo += 1) {
    const html = await postPage(pageNo, total);
    const pageCars = parseCars(html);
    all = all.concat(pageCars);

    if (pageCars.length && pageCars.every((car) => car.maxPrice > PRICE_MAX)) {
      break;
    }
  }

  return { total, cars: uniqueById(all) };
}

async function main() {
  const { total, cars } = await loadCars();
  const candidates = rankCars(cars).slice(0, TOP_COUNT);
  if (!candidates.length) {
    throw new Error("未找到3-5万候选");
  }

  const top = candidates[0];
  const compact = candidates
    .map((car, index) => `${index + 1}.${shortPlate(car.plate)} ${priceWan(car.maxPrice)}/${car.views}`)
    .join(" ");

  finish({
    title: `京牌3-5万: ${top.plate}`,
    content: [
      `${shortModel(top)} ${priceWan(top.maxPrice)} 围观:${top.views}`,
      compact,
      `本期:${total || "--"} | 按低热度动态排序`,
    ].join("\n"),
    icon: "car.circle",
    "icon-color": "#34C759",
  });
}

main().catch((error) => {
  finish({
    title: "京牌3-5万候选",
    content: `获取失败: ${String(error && error.message ? error.message : error)}`,
    icon: "exclamationmark.triangle",
    "icon-color": "#FF9500",
  });
});
