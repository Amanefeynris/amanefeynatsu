import AbstractSource from './abstract.js'

const QUALITIES = ['2160', '1080', '720', '540', '480']

export default new class EraiSpanishOnly extends AbstractSource {

  url = 'https://nyaa.si'

  parseSize(sizeStr) {
    const match = sizeStr.match(/^([\d.]+)\s*([KMGT]?i?B)$/i)
    if (!match) return 0
    
    const size = parseFloat(match[1])
    const unit = match[2].toUpperCase()
    
    const multipliers = {
      'B': 1,
      'KB': 1000,
      'KIB': 1024,
      'MB': 1000000,
      'MIB': 1048576,
      'GB': 1000000000,
      'GIB': 1073741824,
      'TB': 1000000000000,
      'TIB': 1099511627776
    }
    
    return Math.floor(size * (multipliers[unit] || 1))
  }

  parseResults(html) {
    const results = []
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    
    const rows = doc.querySelectorAll('tbody tr')
    
    for (const row of rows) {
      const cells = row.querySelectorAll('td')
      if (cells.length < 7) continue
      
      try {

        const titleLink = cells[1].querySelector('a[title]')
        if (!titleLink) continue
        
        const title = titleLink.getAttribute('title') || titleLink.textContent.trim()

        // SOLO ERAI-RAWS
        if (!title.toLowerCase().includes("erai")) continue

        // SOLO SI TIENE ESPAÑOL
        if (
          !title.toLowerCase().includes("spanish") &&
          !title.toLowerCase().includes("español") &&
          !title.toLowerCase().includes("sub esp") &&
          !title.toLowerCase().includes("latino") &&
          !title.toLowerCase().includes("multi-sub")
        ) continue

        const downloadLinks = cells[2].querySelectorAll('a')
        let downloadUrl = null
        
        for (const link of downloadLinks) {
          const href = link.getAttribute('href')
          if (href?.startsWith('magnet:')) {
            downloadUrl = href
            break
          } else if (href?.endsWith('.torrent')) {
            downloadUrl = href.startsWith('http') ? href : this.url + href
          }
        }

        if (!downloadUrl) continue

        const sizeText = cells[3].textContent.trim()
        const size = this.parseSize(sizeText)

        const seeders = parseInt(cells[5].textContent.trim()) || 0
        const leechers = parseInt(cells[6].textContent.trim()) || 0

        let hash = ''
        if (downloadUrl.startsWith('magnet:')) {
          const hashMatch = downloadUrl.match(/btih:([a-fA-F0-9]{40})/i)
          if (hashMatch) hash = hashMatch[1].toLowerCase()
        }

        results.push({
          title,
          link: downloadUrl,
          seeders,
          leechers,
          downloads: 0,
          hash,
          size,
          accuracy: 'high',
          date: new Date()
        })

      } catch (error) {
        continue
      }
    }

    return results
  }

  async performSearch(query, category = '1_2') {
    const url = `${this.url}/?f=0&c=${category}&q=${query}&s=seeders&o=desc`
    
    const response = await fetch(url)
    const html = await response.text()
    
    return this.parseResults(html)
  }

  async single({ titles, episode, resolution }) {

    if (!titles?.length) throw new Error('No titles provided')

    let searchTitle = titles[0]

    if (episode) {
      searchTitle += " " + episode.toString().padStart(2, '0')
    }

    const query = encodeURIComponent(searchTitle + " era-raws")
    return this.performSearch(query)
  }

  async batch({ titles }) {
    if (!titles?.length) throw new Error('No titles provided')

    const query = encodeURIComponent(titles[0] + " era-raws batch")
    return this.performSearch(query)
  }

  async movie({ titles }) {
    if (!titles?.length) throw new Error('No titles provided')

    const query = encodeURIComponent(titles[0] + " era-raws movie")
    return this.performSearch(query)
  }

  async test() {
    const res = await fetch(this.url)
    return res.ok
  }

}()
