console.log('[DEBUG] server.ts sendo carregado...');
import express from "express";
import path from "path";
import axios from "axios";
import session from "express-session";
import cookieParser from "cookie-parser";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import { networkInterfaces } from "os";

async function startServer() {
  console.log('[SERVER] Iniciando processo...');
  const app = express();
  const PORT = 3005;

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: 'divergeflow-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
      secure: true, 
      sameSite: 'none',
      httpOnly: true
    }
  }));

  // Local Storage Configuration
  const uploadDir = path.join(process.cwd(), 'uploads');
  console.log('[UPLOAD] Verificando pasta:', uploadDir);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Startup Test: Tentar escrever um arquivo dummy para testar permissões
  try {
    const testFile = path.join(uploadDir, 'test_write.txt');
    fs.writeFileSync(testFile, 'Teste de permissão: ' + new Date().toISOString());
    console.log('[UPLOAD] Teste de escrita: SUCESSO! (Arquivo criado em:', testFile, ')');
  } catch (err) {
    console.error('[UPLOAD] Teste de escrita: FALHOU!', err);
  }

  const uploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
      cb(null, uniqueSuffix + '-' + cleanName);
    }
  });

  const upload = multer({ 
    storage: uploadStorage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
  });

  // Serve static files from uploads directory
  app.use('/uploads', express.static(uploadDir));

  // Upload Endpoint
  app.post('/api/upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error('Multer Error:', err);
        return res.status(400).json({ error: `Erro de upload: ${err.message}` });
      } else if (err) {
        console.error('Unknown Upload Error:', err);
        return res.status(500).json({ error: `Erro no servidor: ${err.message}` });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      console.log('[UPLOAD] Arquivo salvo em:', req.file.path);
      res.json({ url: fileUrl });
    });
  });

  // Delete Endpoint
  app.delete('/api/upload/:filename', (req, res) => {
    const fileName = req.params.filename;
    // Security: avoid path traversal
    const safeFileName = path.basename(fileName);
    const filePath = path.join(uploadDir, safeFileName);

    console.log('[DELETE] Tentando excluir:', filePath);

    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('[DELETE] Erro ao excluir arquivo:', err);
          return res.status(500).json({ error: 'Erro ao excluir arquivo.' });
        }
        console.log('[DELETE] Arquivo excluído com sucesso:', safeFileName);
        res.json({ message: 'Arquivo excluído com sucesso.' });
      });
    } else {
      console.warn('[DELETE] Arquivo não encontrado:', safeFileName);
      res.status(404).json({ error: 'Arquivo não encontrado.' });
    }
  });

  // Test Endpoint
  app.get('/api/test-upload', (req, res) => {
    res.json({ status: 'ok', uploadDir, time: new Date().toISOString() });
  });

  // GitHub OAuth Routes
  app.get('/api/auth/github/url', (req, res) => {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/github/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID || '',
      redirect_uri: redirectUri,
      scope: 'read:user',
    });
    res.json({ url: `https://github.com/login/oauth/authorize?${params}` });
  });

  app.get('/api/auth/github/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('No code provided');

    try {
      const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }, {
        headers: { Accept: 'application/json' }
      });

      const accessToken = tokenResponse.data.access_token;
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `token ${accessToken}` }
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  user: ${JSON.stringify(userResponse.data)} 
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Conectado com sucesso! Fechando janela...</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      res.status(500).send('Authentication failed');
    }
  });

  // Vite middleware for development
  console.log('[SERVER] Configurando Vite...');
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  console.log('[SERVER] Iniciando listen na porta:', PORT);
  app.listen(PORT, "0.0.0.0", () => {
    console.log('\n' + '='.repeat(40));
    console.log(`[SERVER] Servidor rodando com sucesso!`);
    console.log(`[SERVER] Local:    http://localhost:${PORT}`);
    
    // Mostra links da rede para a Intranet
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]!) {
        // Pula endereços internos e IPv6 para simplificar
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`[SERVER] Network:  http://${net.address}:${PORT}`);
        }
      }
    }
    console.log('='.repeat(40) + '\n');
  });
}

startServer();
