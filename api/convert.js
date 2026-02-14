// api/convert.js
import ytsr from 'ytsr';

// CORS headers for Flutter app
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tracks } = req.body;

    if (!tracks || !Array.isArray(tracks)) {
      return res.status(400).json({ 
        error: 'Invalid request. Send { tracks: [{title, artists}] }' 
      });
    }

    console.log(`🔍 Converting ${tracks.length} tracks...`);

    // Process all tracks in parallel
    const results = await Promise.all(
      tracks.map(async (track, index) => {
        try {
          const query = `${track.title} ${track.artists.join(' ')} audio`;
          console.log(`[${index + 1}/${tracks.length}] Searching: ${query}`);

          // Search YouTube
          const searchResults = await ytsr(query, { limit: 1 });
          
          if (searchResults.items.length > 0) {
            const video = searchResults.items[0];
            const videoId = video.id;
            
            console.log(`✅ Found: ${video.title} -> ${videoId}`);
            
            return {
              title: track.title,
              artists: track.artists,
              youtubeId: videoId,
              youtubeTitle: video.title,
              duration: video.duration,
              thumbnail: video.bestThumbnail?.url || null,
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
    console.error('❌ Vibeflow Server error:', error);
    return res.status(500).json({ 
      error: 'Vibeflow Internal server error', 
      message: error.message 
    });
  }
}

// Enable CORS
export const config = {
  api: {
    bodyParser: true,
  },
};