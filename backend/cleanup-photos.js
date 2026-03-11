const cron = require('node-cron');
const cloudinary = require('cloudinary').v2;
const { getDb } = require('./database');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Extrage public_id din URL Cloudinary
// Ex: https://res.cloudinary.com/demo/image/upload/v123/red-medica/retete/abc.jpg
//  -> red-medica/retete/abc
function extractPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
  return match ? match[1] : null;
}

async function deleteOldPhotos() {
  const db = getDb();

  // Vizite mai vechi de 90 de zile cu poze ne-goale
  const visits = db.prepare(`
    SELECT id, poze, data, created_at
    FROM visits
    WHERE poze IS NOT NULL
      AND poze != ''
      AND poze != '[]'
      AND (
        (data IS NOT NULL AND date(data) < date('now', '-90 days'))
        OR (data IS NULL AND date(created_at) < date('now', '-90 days'))
      )
  `).all();

  if (visits.length === 0) {
    console.log('[Cleanup] Nicio poză mai veche de 90 de zile găsită.');
    return;
  }

  let totalSterse = 0;
  let totalErori = 0;

  for (const visit of visits) {
    let poze;
    try {
      poze = JSON.parse(visit.poze);
      if (!Array.isArray(poze) || poze.length === 0) continue;
    } catch (_) {
      continue;
    }

    const pozeRamase = [];

    for (const url of poze) {
      const publicId = extractPublicId(url);
      if (!publicId) {
        pozeRamase.push(url); // păstrăm URL-uri pe care nu le putem procesa
        continue;
      }

      try {
        const result = await cloudinary.uploader.destroy(publicId, { invalidate: true });
        if (result.result === 'ok' || result.result === 'not found') {
          totalSterse++;
          // nu adăugăm în pozeRamase — fotografia e ștearsă
        } else {
          console.error(`[Cleanup] Eroare la ștergere ${publicId}:`, result.result);
          totalErori++;
          pozeRamase.push(url); // păstrăm dacă ștergerea a eșuat
        }
      } catch (err) {
        console.error(`[Cleanup] Excepție la ștergere ${publicId}:`, err.message);
        totalErori++;
        pozeRamase.push(url);
      }
    }

    // Actualizează DB cu pozele rămase (sau array gol)
    db.prepare('UPDATE visits SET poze = ? WHERE id = ?')
      .run(JSON.stringify(pozeRamase), visit.id);
  }

  console.log(`[Cleanup] Ștergere automată finalizată: ${totalSterse} poze șterse, ${totalErori} erori.`);
}

function schedulePhotoCleanup() {
  // Rulează zilnic la ora 01:00
  cron.schedule('0 1 * * *', () => {
    console.log('[Cleanup] Pornire ștergere automată poze > 90 zile...');
    deleteOldPhotos().catch(err => console.error('[Cleanup] Eroare:', err.message));
  });
  console.log('✓ [Cleanup] Job programat zilnic la 01:00');
}

module.exports = { schedulePhotoCleanup };
