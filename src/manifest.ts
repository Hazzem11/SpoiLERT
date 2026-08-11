const manifest = {
  manifest_version: 3,
  name: "SpoilERT",
  version: "0.1.2",
  description: "Reduce accidental spoilers on Google search.",
  icons: {
    16: "icons/icon16.png",
    32: "icons/icon32.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png"
  },
  action: {
    default_title: "SpoilERT",
    default_popup: "src/popup/index.html",
    default_icon: {
      16: "icons/icon16.png",
      32: "icons/icon32.png"
    }
  },
  background: {
    service_worker: "src/background/serviceWorker.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["https://www.google.com/*"],
      js: ["src/content/index.ts"]
    }
  ],
  permissions: ["storage", "activeTab", "offscreen"],
  host_permissions: ["https://www.google.com/*"],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  web_accessible_resources: [
    {
      resources: [
        "models/spoiler-classifier/*",
        "models/spoiler-classifier/**/*",
        "wasm/*"
      ],
      matches: ["https://www.google.com/*"]
    }
  ]
} satisfies chrome.runtime.ManifestV3;

export default manifest;
