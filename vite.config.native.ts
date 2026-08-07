import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from "fs";
import path from "path";

export default defineConfig({
  nitro: false,
  tanstackStart: {
    client: { entry: "client-native.tsx" },
  },
  vite: {
    build: {
      outDir: "dist-native",
      emptyOutDir: true,
    },
    plugins: [
      {
        name: "capacitor-spa-generator",
        closeBundle() {
          const clientDir = path.resolve("dist-native", "client");
          const serverDir = path.resolve("dist-native", "server");
          
          if (fs.existsSync(clientDir)) {
            const entries = fs.readdirSync(clientDir, { withFileTypes: true });
            for (const entry of entries) {
              const srcPath = path.join(clientDir, entry.name);
              const destPath = path.join("dist-native", entry.name);
              if (fs.existsSync(destPath)) {
                fs.rmSync(destPath, { recursive: true, force: true });
              }
              fs.renameSync(srcPath, destPath);
            }
            fs.rmSync(clientDir, { recursive: true, force: true });
          }
          if (fs.existsSync(serverDir)) {
            fs.rmSync(serverDir, { recursive: true, force: true });
          }

          const assetsDir = path.resolve("dist-native", "assets");
          let jsFile = "index-B9OKeaNq.js";
          let cssFile = "styles-DWVXee4U.css";

          if (fs.existsSync(assetsDir)) {
            const assetFiles = fs.readdirSync(assetsDir);
            const foundJs = assetFiles.find(f => f.startsWith("index-") && f.endsWith(".js"));
            if (foundJs) jsFile = foundJs;
            const foundCss = assetFiles.find(f => f.startsWith("styles-") && f.endsWith(".css"));
            if (foundCss) cssFile = foundCss;
          }

          const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SomaCare — Your AI Health Companion</title>
    <script>
      // Global error-catching handler for mobile debugging
      window.onerror = function(msg, url, line, col, error) {
        showErrorBanner("onerror: " + msg, url, line, col, error);
      };

      window.addEventListener('unhandledrejection', function(event) {
        showErrorBanner("unhandledrejection", "", 0, 0, event.reason);
      });

      function showErrorBanner(title, url, line, col, error) {
        if (document.getElementById('mobile-error-banner')) return;
        const div = document.createElement('div');
        div.id = 'mobile-error-banner';
        div.style.position = 'fixed';
        div.style.top = '0';
        div.style.left = '0';
        div.style.width = '100%';
        div.style.height = '100%';
        div.style.backgroundColor = '#7f1d1d';
        div.style.color = '#fee2e2';
        div.style.zIndex = '999999';
        div.style.padding = '20px';
        div.style.overflow = 'auto';
        div.style.fontFamily = 'monospace';
        div.style.fontSize = '13px';
        
        let stack = '';
        if (error) {
          stack = error.stack || error.message || String(error);
        } else {
          stack = title + ' at ' + url + ':' + line + ':' + col;
        }

        div.innerHTML = '<h2 style="color: #fca5a5; margin-top:0;">SomaCare Mobile Error</h2>' +
          '<p><strong>' + escapeHtml(title) + '</strong></p>' +
          '<pre style="white-space: pre-wrap; word-break: break-all;">' + escapeHtml(stack) + '</pre>';
        
        if (document.body) {
          document.body.appendChild(div);
        } else {
          document.addEventListener('DOMContentLoaded', function() {
            document.body.appendChild(div);
          });
        }
      }

      function escapeHtml(str) {
        return String(str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }
    </script>
    <link rel="stylesheet" href="./assets/${cssFile}">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./assets/${jsFile}"></script>
  </body>
</html>`;

          fs.writeFileSync(path.resolve("dist-native", "index.html"), htmlContent, "utf-8");
          console.log("[capacitor-spa-generator] Generated dist-native/index.html with error catching.");
        },
      },
    ],
  },
});
