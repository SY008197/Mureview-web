import http from "node:http";

const PORT = process.env.PORT || 4000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function cleanText(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'|'/g, "'")
    .trim();
}

/**
 * 멜론(Melon) 단일 기준 음원 검색
 * 모든 트랙의 고유 식별자를 `melon-${SONGID}`로 고정합니다.
 */
async function searchMelon(query) {
  const url = `https://www.melon.com/search/keyword/index.json?query=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://www.melon.com/",
      Accept: "application/json, text/javascript, */*; q=0.01",
    },
  });

  if (!res.ok) {
    throw new Error(`Melon 요청 실패 (${res.status})`);
  }

  const rawText = (await res.text()).trim();
  const jsonText = rawText.startsWith("{")
    ? rawText
    : rawText.replace(/^[^(]+\(/, "").replace(/\);?$/, "");
  const data = JSON.parse(jsonText);
  const songs = data?.SONGCONTENTS || [];

  return songs
    .filter((item) => item && item.SONGID)
    .slice(0, 12)
    .map((item) => {
      const rawImg = item.ALBUMIMG || "";
      const artworkUrl = rawImg
        ? rawImg.replace(/\/melon\/resize\/\d+/, "/melon/resize/500")
        : "/img/featured_item_1.jpg";

      return {
        id: `melon-${item.SONGID}`,
        trackName: cleanText(item.SONGNAME),
        artistName: cleanText(item.ARTISTNAME),
        albumName: cleanText(item.ALBUMNAME),
        artworkUrl,
        musicUrl: `https://www.melon.com/song/detail.htm?songId=${item.SONGID}`,
      };
    });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/search") {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "검색어를 입력해주세요." }));
      return;
    }

    try {
      const tracks = await searchMelon(q);
      console.log(`[search:melon] "${q}" -> ${tracks.length}건`);

      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ results: tracks }));
    } catch (err) {
      console.error("[search:melon error]", err);
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: "멜론 음원 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        })
      );
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Music proxy server running on http://127.0.0.1:${PORT}`);
});