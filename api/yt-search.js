// Vercel serverless function: GET /api/yt-search?q=...
// Searches YouTube for embeddable music videos. The API key stays on the server
// (set YT_API_KEY in Vercel > Settings > Environment Variables).
// Results are cached at Vercel's edge for a day, so repeat searches cost no quota.
module.exports = async function handler(req, res) {
  const q = String((req.query && req.query.q) || '').trim().slice(0, 80);
  if (!q) { res.status(400).json({ error: 'Missing search' }); return; }

  const key = process.env.YT_API_KEY;
  if (!key) { res.status(503).json({ error: 'Search is not set up' }); return; }

  const url = 'https://www.googleapis.com/youtube/v3/search?' + new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',      // only videos that are allowed to play on other sites
    videoCategoryId: '10',        // Music
    safeSearch: 'moderate',
    maxResults: '8',
    q,
    key
  });

  try {
    const r = await fetch(url);
    if (!r.ok) { res.status(502).json({ error: 'YouTube search failed' }); return; }
    const data = await r.json();
    const items = (data.items || [])
      .filter(it => it.id && it.id.videoId)
      .map(it => ({
        id: it.id.videoId,
        title: it.snippet.title,
        channel: it.snippet.channelTitle,
        thumb: ((it.snippet.thumbnails || {}).medium || (it.snippet.thumbnails || {}).default || {}).url || ''
      }));
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({ items });
  } catch (err) {
    res.status(502).json({ error: 'YouTube search failed' });
  }
};
