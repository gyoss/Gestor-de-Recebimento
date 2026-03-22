import express from "express";
import path from "path";
import axios from "axios";
import session from "express-session";
import cookieParser from "cookie-parser";

async function startServer() {
  const app = express();
  const PORT = 3001;

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
