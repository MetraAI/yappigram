const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { createProxyServer } = require("http-proxy");
const path = require("path");

const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const backendUrl = process.env.CRM_BACKEND_URL || "http://crm-backend:8000";

// Load Next.js config from standalone build
const nextConfig = require(path.join(__dirname, ".next", "required-server-files.json")).config;

const app = next({ dev: false, hostname, port, conf: nextConfig });
const handle = app.getRequestHandler();
const basePath = nextConfig.basePath || "";

const proxy = createProxyServer({ target: backendUrl, ws: true, changeOrigin: true });
proxy.on("error", (err) => console.error("[ws-proxy]", err.message));

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url, true);
    const wsPath = basePath ? `${basePath}/ws` : "/ws";
    if (pathname === "/ws" || pathname === "/ws/" || pathname === wsPath || pathname === wsPath + "/") {
      proxy.ws(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
