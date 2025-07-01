import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');

app.use(express.static(distPath));

app.get('*', (_, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(4173, () => {
  console.log('Preview running on http://localhost:4173');
});
