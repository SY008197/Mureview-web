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

async function searchFlo(query) {
  const url = `https://www.music-flo.com/api/search/v2/search?searchType=TRACK&sortType=ACCURACY&keyword=${encodeURIComponent(
    query
  )}&size=12&page=1`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://www.music-flo.com/",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`FLO 요청 실패 (${res.status})`);
  }

  const data = await res.json();
  const sections = data?.data?.list || [];
  const rawItems = sections.flatMap((section) =>
    Array.isArray(section.list) ? section.list : section.name ? [section] : []
  );

  return rawItems.slice(0, 12).map((item) => {
    const artistName =
      Array.isArray(item.artistList) && item.artistList.length > 0
        ? item.artistList.map((a) => a.name).join(", ")
        : item.representationArtist?.name || "";

    const imgList = item.album?.imgList || [];
    const bestImg = imgList.reduce(
      (best, cur) => ((cur.size || 0) > (best.size || 0) ? cur : best),
      { size: 0, url: "" }
    );

    return {
      id: `flo-${item.id}`,
      trackName: cleanText(item.name),
      artistName: cleanText(artistName),
      albumName: cleanText(item.album?.title),
      artworkUrl: bestImg.url || "/img/featured_item_1.jpg",
      musicUrl: item.album?.id
        ? `https://www.music-flo.com/detail/album/${item.album.id}/albumtrack`
        : "",
    };
  });
}

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

  return songs.slice(0, 12).map((item) => {
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
      musicUrl: item.SONGID
        ? `https://www.melon.com/song/detail.htm?songId=${item.SONGID}`
        : "",
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
      let tracks = [];

      try {
        tracks = await searchFlo(q);
        console.log(`[search:flo] "${q}" -> ${tracks.length}건`);
      } catch (floErr) {
        console.warn("[search:flo 실패]", floErr.message);
      }

      if (tracks.length === 0) {
        tracks = await searchMelon(q);
        console.log(`[search:melon] "${q}" -> ${tracks.length}건`);
      }

      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ results: tracks }));
    } catch (err) {
      console.error("[search error]", err);
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Music proxy server running on http://127.0.0.1:${PORT}`);
});