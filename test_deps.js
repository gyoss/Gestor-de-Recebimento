import express from 'express';
import multer from 'multer';
import cors from 'cors';

console.log('--- TEST START ---');
try {
  const app = express();
  app.use(cors());
  const upload = multer({ dest: 'uploads/' });
  console.log('Express, Multer, Cors: LOADED OK');
  process.exit(0);
} catch (err) {
  console.error('TEST FAILED:', err);
  process.exit(1);
}
