export default new class Nyaa {
  base = 'https://torrent-search-api-livid.vercel.app/api/nyaasi/'

  /** @type {import('./').SearchFunction} */
  async single({ titles, episode, exclusions = [], type = 'sub' }) {
    if (!titles?.length) return []

    // Si el tipo es 'sub', asumimos que quieren subs en español
    // (asumiendo que la app está configurada para español)
    const query = this.buildQuery(titles[0], episode)
    const url = `${this.base}${encodeURIComponent(query)}`

    // Usar el fetch proporcionado por la app
    const res = await fetch(url)
    const data = await res.json()

    if (!Array.isArray(data)) return []

    // Filtrar resultados basado en exclusions y tipo
    return this.filterResults(data, exclusions, type)
  }

  /** @type {import('./').SearchFunction} */
  batch = this.single
  movie = this.single

  buildQuery(title, episode) {
    let query = title.replace(/[^\w\s-]/g, ' ').trim()
    
    // Para episodios, añadir padding
    if (episode) {
      query += ` ${episode.toString().padStart(2, '0')}`
    }
    
    // Nota: NO añadimos "spanish" al query porque queremos mantener
    // la búsqueda amplia y luego filtrar/priorizar
    return query
  }

  filterResults(data, exclusions, type) {
    // Definir patrones para español (lo que QUEREMOS)
    const spanishPatterns = [
      /spanish/i, /español/i, /castellano/i, 
      /subesp/i, /\[es\]/i, /\(es\)/i, /-es\b/i,
      /sub español/i, /sub es/i, /latino/i, /spa/i
    ]

    // Definir patrones para inglés (lo que NO QUEREMOS prioritariamente)
    const englishPatterns = [
      /english/i, /inglés/i, /\[en\]/i, /\(en\)/i, /-en\b/i,
      /sub eng/i, /sub en/i, /multi audio/i, /dual audio/i,
      /multi sub/i
    ]

    // Procesar y categorizar resultados
    const results = data.map(item => {
      const title = item.Name || ''
      
      // Determinar si es español
      const isSpanish = spanishPatterns.some(pattern => pattern.test(title))
      
      // Determinar si es inglés (para priorización negativa)
      const isEnglish = !isSpanish && englishPatterns.some(pattern => pattern.test(title))
      
      // Calcular accuracy basado en qué tan "español" es
      let accuracy = 'low'
      if (isSpanish) {
        // Si tiene múltiples indicadores de español, alta precisión
        const spanishMatches = spanishPatterns.filter(p => p.test(title)).length
        accuracy = spanishMatches >= 2 ? 'high' : 'medium'
      } else if (!isEnglish) {
        // Si no es ni español ni inglés, precisión media (podría ser español sin marcadores)
        accuracy = 'medium'
      }

      // Aplicar exclusions de la app
      const shouldExclude = exclusions.some(exclude => 
        title.toLowerCase().includes(exclude.toLowerCase())
      )

      if (shouldExclude) return null

      const hash = item.Magnet?.match(/btih:([a-fA-F0-9]+)/)?.[1] || ''

      return {
        title,
        link: item.Magnet || '',
        hash,
        seeders: parseInt(item.Seeders || '0'),
        leechers: parseInt(item.Leechers || '0'),
        downloads: parseInt(item.Downloads || '0'),
        size: this.parseSize(item.Size),
        date: new Date(item.DateUploaded),
        accuracy,
        type: this.determineType(title, isSpanish),
        // Un peso para ordenar (menor = mejor)
        _sortWeight: this.calculateWeight(isSpanish, isEnglish, item.Seeders)
      }
    }).filter(r => r !== null)

    // Ordenar: primero por peso (español mejor), luego por seeders
    return results
      .sort((a, b) => {
        if (a._sortWeight !== b._sortWeight) {
          return a._sortWeight - b._sortWeight
        }
        return (b.seeders || 0) - (a.seeders || 0)
      })
      .map(({ _sortWeight, ...rest }) => rest) // Quitar el peso temporal
  }

  calculateWeight(isSpanish, isEnglish, seeders) {
    // Pesos más bajos = mejor posición
    if (isSpanish) return 0 // Español siempre primero
    if (!isEnglish) return 1 // Idioma neutral segundo
    return 2 // Inglés último
  }

  determineType(title, isSpanish) {
    const lowerTitle = title.toLowerCase()
    
    // Detectar si es batch
    if (lowerTitle.includes('batch') || lowerTitle.includes('complete')) {
      return 'batch'
    }
    
    // Si es español y tiene buena calidad, podría ser 'best'
    if (isSpanish) {
      if (lowerTitle.includes('bluray') || lowerTitle.includes('bd') || 
          lowerTitle.includes('remux') || lowerTitle.includes('2160p')) {
        return 'best'
      }
      if (lowerTitle.includes('web') || lowerTitle.includes('1080p')) {
        return 'alt'
      }
    }
    
    return undefined
  }

  parseSize(sizeStr) {
    const match = sizeStr.match(/([\d.]+)\s*(KiB|MiB|GiB|KB|MB|GB)/i)
    if (!match) return 0

    const value = parseFloat(match[1])
    const unit = match[2].toUpperCase()

    switch (unit) {
      case 'KIB':
      case 'KB': return value * 1024
      case 'MIB':
      case 'MB': return value * 1024 * 1024
      case 'GIB':
      case 'GB': return value * 1024 * 1024 * 1024
      default: return 0
    }
  }

  async test() {
    try {
      const res = await fetch(this.base + 'one piece')
      return res.ok
    } catch {
      return false
    }
  }
}()
