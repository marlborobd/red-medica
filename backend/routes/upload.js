const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { authenticate } = require('../middleware/auth');

// Configurare Cloudinary din variabilele de mediu
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer: stocare în memorie, fișiere max 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Doar fișiere imagine sunt acceptate'));
    }
    cb(null, true);
  }
});

// POST /api/upload — urcă o poză pe Cloudinary și returnează URL-ul
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Niciun fișier trimis' });
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return res.status(500).json({ error: 'Cloudinary nu este configurat (lipsesc variabilele de mediu)' });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'red-medica/retete',
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }]
        },
        (error, result) => (error ? reject(error) : resolve(result))
      ).end(req.file.buffer);
    });

    res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error('[Upload Cloudinary]', err.message);
    res.status(500).json({ error: 'Eroare la upload fotografie. Verificați configurarea Cloudinary.' });
  }
});

module.exports = router;
