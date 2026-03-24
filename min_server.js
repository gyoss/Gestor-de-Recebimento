import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3005;

app.use(cors());

app.get('/api/test', (req, res) => {
  res.json({ message: 'MINIMAL SERVER IS WORKING!' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`--- MINIMAL SERVER STARTED ON http://127.0.0.1:${PORT} ---`);
});
