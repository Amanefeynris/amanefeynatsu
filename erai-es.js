export default new class EraiRaws {
  base = 'https://torrent-search-api-livid.vercel.app/api/nyaasi/'

  /** @type {import('./').SearchFunction} */
  async single({ titles, episode, exclusions = [] }) {
    if (!titles?.length) return []

    // Búsqueda específica para Erai-raws
    const query = this.buildEraiQuery(titles[0], episode)
    const url = `${this.base}${encodeURIComponent(query)}`

    const res = await fetch(url)
    const data = await res.json()

    if (!Array.isArray(data)) return []

    // Filtrar SOLO resultados de Erai-raws
    return this.filterEraiResults(data, exclusions)
  }

  /** @type {import('./').SearchFunction} */
  batch({ titles, exclusions = [] }) {
    // Para batches, buscar sin número de episodio
    return this.single({ titles, episode: undefined, exclusions })
  }

  /** @type {import('./').SearchFunction} */
  movie({ titles, exclusions = [] }) {
    // Para películas, buscar sin número de episodio
    return this.single({ titles, episode: undefined, exclusions })
  }

  buildEraiQuery(title, episode) {
    // Limpiar el título para buscar
    let cleanTitle = title.replace(/[^\w\s-]/g, ' ').trim()
    
    // Construir query específico para Erai-raws
    let query = `[Erai-raws] ${cleanTitle}`
    
    if (episode) {
      // Erai-raws típicamente pone el episodio como " - XX"
      query += ` - ${episode.toString().padStart(2, '0')}`
    }
    
    // Añadir MultiSub que es característico de Erai-raws
    query += ' MultiSub'
    
    return query
  }

  filterEraiResults(data, exclusions) {
    return data
      .filter(item => {
        const title = item.Name || ''
        
        // 1. SOLO resultados de Erai-raws
        if (!title.includes('[Erai-raws]')) return false
        
        // 2. Debe tener MultiSub (todos los de Erai-raws lo tienen, pero por si acaso)
        if (!title.includes('MultiSub')) return false
        
        // 3. Aplicar exclusions de la app
        const shouldExclude = exclusions.some(exclude => 
          title.toLowerCase().includes(exclude.toLowerCase())
        )
        if (shouldExclude) return false
        
        return true
      })
      .map(item => {
        const title = item.Name || ''
        const hash = item.Magnet?.match(/btih:([a-fA-F0-9]+)/)?.[1] || ''
        
        // Extraer resolución del título (siempre está en el formato [1080p], [720p], etc)
        const resolutionMatch = title.match(/\[(\d{3,4}p)\]/)
        const resolution = resolutionMatch ? resolutionMatch[1] : 'unknown'
        
        // Extraer código de calidad (NF, AMZN, CR, etc)
        const sourceMatch = title.match(/\]\s*([A-Z]+)\s+WEB-DL/)
        const source = sourceMatch ? sourceMatch[1] : 'unknown'
        
        // Determinar tipo basado en el título
        let type = 'alt'
        if (resolution === '1080p') {
          // Si es 1080p y de buena fuente, podría ser best
          if (source === 'NF' || source === 'AMZN' || source === 'CR') {
            type = 'best'
          }
        }
        
        // Como todos son MultiSub, asumimos que pueden tener español
        // Pero podemos dar más accuracy si el título indica español específicamente
        const hasSpanish = title.toLowerCase().includes('spanish') || 
                          title.toLowerCase().includes('español') ||
                          title.toLowerCase().includes('castellano')
        
        return {
          title,
          link: item.Magnet || '',
          hash,
          seeders: parseInt(item.Seeders || '0'),
          leechers: parseInt(item.Leechers || '0'),
          downloads: parseInt(item.Downloads || '0'),
          size: this.parseSize(item.Size),
          date: new Date(item.DateUploaded),
          // Accuracy: high si tiene indicadores de español, medium si no
          accuracy: hasSpanish ? 'high' : 'medium',
          type,
          // Metadata adicional que podría ser útil (no parte de la interfaz oficial)
          _resolution: resolution,
          _source: source
        }
      })
      .sort((a, b) => {
        // Orden personalizado:
        // 1. Primero los que tienen español
        if (a.accuracy === 'high' && b.accuracy !== 'high') return -1
        if (a.accuracy !== 'high' && b.accuracy === 'high') return 1
        
        // 2. Luego por resolución (1080p > 720p > 480p)
        const resOrder = { '1080p': 0, '720p': 1, '540p': 2, '480p': 3 }
        const aRes = resOrder[a._resolution] || 999
        const bRes = resOrder[b._resolution] || 999
        if (aRes !== bRes) return aRes - bRes
        
        // 3. Finalmente por seeders
        return (b.seeders || 0) - (a.seeders || 0)
      })
      .map(({ _resolution, _source, ...rest }) => rest) // Quitar metadata extra
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
      // Test con un anime específico para Erai-raws
      const res = await fetch(this.base + '[Erai-raws]%20MultiSub')
      return res.ok
    } catch {
      return false
    }
  }
}()
