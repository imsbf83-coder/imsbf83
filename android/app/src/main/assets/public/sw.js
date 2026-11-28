/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "school-logo.png",
    "revision": "d1fdfcf61cee4ced813c4c21e569a61a"
  }, {
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "5c7a0e8e4dd38c184fca44a41a74de16"
  }, {
    "url": "pwa-512x512.png",
    "revision": "2c94bf8cf058498044b828f05b3938a6"
  }, {
    "url": "pwa-192x192.png",
    "revision": "41d5e23d77164ae73c77dc90c0e8358d"
  }, {
    "url": "principal-signature.svg",
    "revision": "c02211d227eb0f0e1580e3f3e2dc0b0d"
  }, {
    "url": "principal-signature.jpeg",
    "revision": "9abc5bdd3b2e6b5916826e780cabb2de"
  }, {
    "url": "index.html",
    "revision": "feb650bdee36c018ff78222035efe28d"
  }, {
    "url": "favicon.ico",
    "revision": "d5cee68eb4a7f2f50f9c1ccc08cce75d"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "c352f23c6e4165918fee5bb19fd18eda"
  }, {
    "url": "assets/web-LwJ6v-Zv.js",
    "revision": null
  }, {
    "url": "assets/index-D9JlDPpn.js",
    "revision": null
  }, {
    "url": "assets/index-C56HcdpO.css",
    "revision": null
  }, {
    "url": "assets/aistudio/image_fa239a24.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_c809c3c0.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_708f6715.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_38acd0cc.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "c352f23c6e4165918fee5bb19fd18eda"
  }, {
    "url": "principal-signature.jpeg",
    "revision": "9abc5bdd3b2e6b5916826e780cabb2de"
  }, {
    "url": "principal-signature.svg",
    "revision": "c02211d227eb0f0e1580e3f3e2dc0b0d"
  }, {
    "url": "pwa-192x192.png",
    "revision": "41d5e23d77164ae73c77dc90c0e8358d"
  }, {
    "url": "pwa-512x512.png",
    "revision": "2c94bf8cf058498044b828f05b3938a6"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "5c7a0e8e4dd38c184fca44a41a74de16"
  }, {
    "url": "school-logo.png",
    "revision": "d1fdfcf61cee4ced813c4c21e569a61a"
  }, {
    "url": "manifest.webmanifest",
    "revision": "490ec06ed9208bf7244b20d41340ae79"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api/, /^\/version\.json/]
  }));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
