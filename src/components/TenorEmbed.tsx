'use client'

import { useEffect, useRef } from 'react'

interface TenorEmbedProps {
  postId?: string
  width?: string
  aspectRatio?: string
}

export default function TenorEmbed({ 
  postId = '7518968101190163651',
  width = '100%',
  aspectRatio = '1.76596'
}: TenorEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load Tenor script
    const existingScript = document.querySelector('script[src="https://tenor.com/embed.js"]')
    
    if (!existingScript) {
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.async = true
      script.src = 'https://tenor.com/embed.js'
      document.body.appendChild(script)
    }

    // Cleanup function
    return () => {
      // Script remains loaded for performance
    }
  }, [])

  return (
    <div ref={containerRef} className="tenor-embed-container">
      <div 
        className="tenor-gif-embed" 
        data-postid={postId}
        data-share-method="host" 
        data-aspect-ratio={aspectRatio}
        data-width={width}
      >
        <a href={`https://tenor.com/view/chiikawa-chikabu-dance-shake-beetle-gif-${postId}`}>
          Chiikawa Chikabu GIF
        </a>
      </div>
    </div>
  )
}
