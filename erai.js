export default {
  async test() {
    return true;
  },

  async single(query, options) {
    return this.search(query);
  },

  async batch(query, options) {
    return this.search(query);
  },

  async movie(query, options) {
    return this.search(query);
  },

  async search(query) {
    const results = [];
    const titles = query.titles.join(" ");

    const searchURL =
      "https://nyaa.si/?f=0&c=1_2&q=" +
      encodeURIComponent(titles + " era-raws");

    const res = await query.fetch(searchURL);
    const html = await res.text();

    const rows = html.match(/<tr class="default">([\s\S]*?)<\/tr>/g);

    if (!rows) return [];

    for (const row of rows) {
      const titleMatch = row.match(/title="([^"]+)"/);
      if (!titleMatch) continue;

      const title = titleMatch[1];

      // solo Erai-raws
      if (!title.toLowerCase().includes("erai")) continue;

      // link del torrent
      const magnetMatch = row.match(/href="(magnet:\?xt=urn:btih:[^"]+)"/);
      if (!magnetMatch) continue;

      const magnet = magnetMatch[1];

      // abrir página del torrent para leer descripción
      const pageMatch = row.match(/href="\/view\/([0-9]+)"/);
      if (!pageMatch) continue;

      const pageURL = "https://nyaa.si/view/" + pageMatch[1];

      const page = await query.fetch(pageURL);
      const pageHTML = await page.text();

      const text = pageHTML.toLowerCase();

      // filtro de español
      if (
        text.includes("spanish") ||
        text.includes("español") ||
        text.includes("sub esp") ||
        text.includes("sub español") ||
        text.includes("multi-sub (esp)") ||
        text.includes("latino")
      ) {
        results.push({
          title: title,
          link: magnet,
          seeders: 0,
          leechers: 0,
          downloads: 0,
          accuracy: "high",
          hash: magnet,
          size: 0,
          date: new Date()
        });
      }
    }

    return results;
  }
};