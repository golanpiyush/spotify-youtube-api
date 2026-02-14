// api/convert.js
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GET (for testing)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'API is running!',
      message: 'Send POST request with tracks array',
      example: {
        tracks: [
          { title: 'Honeythief', artists: ['Halou'] }
        ]
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tracks } = req.body;

    if (!tracks || !Array.isArray(tracks)) {
      return res.status(400).json({ 
        error: 'Invalid request. Expected { tracks: [{title, artists}] }' 
      });
    }

    console.log(`🔍 Converting ${tracks.length} tracks...`);

    // Process all tracks in parallel
    const results = await Promise.all(
      tracks.map(async (track, index) => {
        try {
          const query = encodeURIComponent(
            `${track.title} ${track.artists.join(' ')} official audio`
          );
          
          console.log(`[${index + 1}/${tracks.length}] Searching: ${track.title}`);
          
          // Use Invidious API (no authentication needed)
          const searchUrl = `https://inv.nadeko.net/api/v1/search?q=${query}&type=video`;
          const response = await fetch(searchUrl);
          
          if (!response.ok) {
            throw new Error(`Search failed with status ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data && data.length > 0) {
            const video = data[0];
            const videoId = video.videoId;
            
            console.log(`✅ Found: ${video.title} -> ${videoId}`);
            
            return {
              title: track.title,
              artists: track.artists,
              youtubeId: videoId,
              youtubeTitle: video.title,
              duration: video.lengthSeconds,
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              success: true,
            };
          } else {
            console.log(`❌ No results for: ${track.title}`);
            return {
              title: track.title,
              artists: track.artists,
              youtubeId: null,
              success: false,
              error: 'No results found',
            };
          }
        } catch (error) {
          console.error(`❌ Error searching ${track.title}:`, error.message);
          return {
            title: track.title,
            artists: track.artists,
            youtubeId: null,
            success: false,
            error: error.message,
          };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    console.log(`🎉 Conversion complete: ${successCount}/${tracks.length} successful`);

    return res.status(200).json({
      results,
      summary: {
        total: tracks.length,
        successful: successCount,
        failed: tracks.length - successCount,
      },
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}