// Local browser QA without installing a browser library. Requires Chrome and a running app.
// All catalogue/feed/audio fixtures are isolated to this fresh browser profile.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const base = process.env.PODFIY_URL ?? "http://127.0.0.1:3100";
const chrome =
  process.env.PODFIY_CHROME ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9337;
const profile = path.resolve(".qa", `chrome-${Date.now()}`);
await mkdir(profile, { recursive: true });
const processHandle = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--enable-logging",
    `--log-file=${path.resolve(".qa/chrome.log")}`,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--autoplay-policy=no-user-gesture-required",
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
let id = 0;
const pending = new Map();
const errors = [];
async function until(check, message, timeout = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return;
    await sleep(150);
  }
  throw new Error(message);
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const request = ++id;
    const timer = setTimeout(() => {
      pending.delete(request);
      reject(new Error(`CDP timeout: ${method}`));
    }, 30000);
    pending.set(request, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject,
    });
    socket.send(JSON.stringify({ id: request, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.text +
        ": " +
        result.exceptionDetails.exception?.description,
    );
  return result.result.value;
}
async function waitFor(expression, message) {
  await until(() => evaluate(expression), message);
}
async function screenshot(name) {
  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(`.qa/${name}.png`, Buffer.from(data, "base64"));
}
async function navigate(route) {
  await send("Page.navigate", { url: base + route });
  await waitFor('document.readyState === "complete"', "Página não carregou");
}

const podcast = {
  id: "https://podfiy.test/rss",
  feed: "https://podfiy.test/rss",
  title: "Histórias de teste",
  author: "Podfiy QA",
  image: base + "/icons/icon-512.png",
  description: "Um feed local para conferir o app.",
};
const episodes = Array.from({ length: 45 }, (_, index) => ({
  id: `qa-${index}`,
  podcastId: podcast.id,
  podcastTitle: podcast.title,
  feed: podcast.feed,
  title: `Uma história para ouvir ${index + 1}`,
  description: "Descrição de teste do episódio.",
  date: new Date(Date.now() - index * 86400000).toISOString(),
  duration: 120,
  image: podcast.image,
  audio: base + "/__qa/audio.wav",
}));
const audio = Buffer.alloc(44 + 8000 * 2 * 120);
audio.write("RIFF", 0);
audio.writeUInt32LE(audio.length - 8, 4);
audio.write("WAVEfmt ", 8);
audio.writeUInt32LE(16, 16);
audio.writeUInt16LE(1, 20);
audio.writeUInt16LE(1, 22);
audio.writeUInt32LE(8000, 24);
audio.writeUInt32LE(16000, 28);
audio.writeUInt16LE(2, 32);
audio.writeUInt16LE(16, 34);
audio.write("data", 36);
audio.writeUInt32LE(audio.length - 44, 40);

try {
  await until(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${port}/json/list`)).ok;
    } catch {
      return false;
    }
  }, "Chrome não iniciou");
  const targets = await (
    await fetch(`http://127.0.0.1:${port}/json/list`)
  ).json();
  socket = new WebSocket(
    targets.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const task = pending.get(message.id);
      if (task) {
        pending.delete(message.id);
        message.error
          ? task.reject(new Error(message.error.message))
          : task.resolve(message.result);
      }
      return;
    }
    if (message.method === "Runtime.exceptionThrown")
      errors.push(
        message.params.exceptionDetails.exception?.description ??
          message.params.exceptionDetails.text,
      );
    if (message.method === "Fetch.requestPaused") {
      const { requestId, request } = message.params;
      let body, headers;
      if (request.url.includes("fonts.googleapis.com")) {
        body = Buffer.from("");
        headers = [{ name: "Content-Type", value: "text/css" }];
      } else if (request.url.includes("/api/search")) {
        body = Buffer.from(JSON.stringify({ podcasts: [podcast] }));
        headers = [{ name: "Content-Type", value: "application/json" }];
      } else if (request.url.includes("/api/feed")) {
        body = Buffer.from(JSON.stringify({ podcast, episodes }));
        headers = [{ name: "Content-Type", value: "application/json" }];
      } else {
        body = audio;
        headers = [
          { name: "Content-Type", value: "audio/wav" },
          { name: "Accept-Ranges", value: "bytes" },
        ];
      }
      void send("Fetch.fulfillRequest", {
        requestId,
        responseCode: 200,
        responseHeaders: headers,
        body: body.toString("base64"),
      }).catch((e) => {
        // Chrome invalidates paused requests when navigation or a track switch cancels them.
        if (e.message !== "Invalid InterceptionId.") errors.push(e.message);
      });
    }
  });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Fetch.enable", {
    patterns: [
      { urlPattern: "*/api/search*" },
      { urlPattern: "*/api/feed*" },
      { urlPattern: "*/__qa/audio.wav" },
      { urlPattern: "*fonts.googleapis.com*" },
    ],
  });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await navigate("/");
  await waitFor(
    '!!document.querySelector(".daily-goal")',
    "Biblioteca não ficou pronta",
  );
  const today = new Date().toISOString();
  const seed = {
    subscriptions: [podcast],
    favorites: [],
    queue: [episodes[1], episodes[2]],
    history: [episodes[0]],
    progress: {
      "qa-0": {
        episode: episodes[0],
        position: 25,
        listened: false,
        updatedAt: today,
      },
    },
    sessions: [
      {
        id: "qa-session",
        date: today,
        podcastId: podcast.id,
        title: podcast.title,
        image: podcast.image,
        seconds: 295,
      },
    ],
    settings: { dailyGoal: 300, speed: 1 },
  };
  // Seed before hydration; writing into an active page would be replaced by its pagehide checkpoint.
  const { identifier } = await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `const qaOpen=indexedDB.open('podfiy',1);qaOpen.onsuccess=()=>{const tx=qaOpen.result.transaction('library','readwrite');tx.objectStore('library').put(${JSON.stringify(seed)},'local');tx.oncomplete=()=>{qaOpen.result.close();window.qaSeeded=true;};};`,
  });
  await navigate("/");
  await waitFor(
    'window.qaSeeded && !!document.querySelector(".mini-track")',
    "Mini player não restaurou",
  );
  await send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  console.log("Chrome: início e mini player restaurados.");
  assert.equal(await evaluate('document.querySelectorAll("audio").length'), 1);
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".mobile-nav")).display',
    ),
    "flex",
  );
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".daily-goal")).display',
    ),
    "block",
  );
  await screenshot("inicio-celular");
  await evaluate(
    'window.qaAudio=document.querySelector("audio");document.querySelector(".mini-track").click()',
  );
  await waitFor('!!document.querySelector("dialog[open]")', "Folha não abriu");
  await sleep(350);
  assert.equal(
    await evaluate('document.querySelectorAll(".progress-ring circle").length'),
    3,
  );
  assert.equal(
    await evaluate(
      'document.querySelector("dialog").contains(document.activeElement)',
    ),
    true,
  );
  await screenshot("tocando-agora-celular");
  console.log("Chrome: folha, anel e foco conferidos.");
  await evaluate(
    `document.querySelector('.progress-ring').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`,
  );
  await waitFor(
    'document.querySelector("audio").currentTime>=29.9',
    "Seek pelo teclado não funcionou",
  );
  const ring = await evaluate(
    `(()=>{const r=document.querySelector('.progress-ring').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,r:r.width*154/320};})()`,
  );
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: ring.x + ring.r,
    y: ring.y,
    button: "left",
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: ring.x,
    y: ring.y + ring.r,
    button: "left",
    buttons: 1,
  });
  assert.ok(
    Math.abs(
      (await evaluate('document.querySelector("audio").currentTime')) - 30,
    ) < 1,
    "Arrastar deve ser uma prévia até soltar",
  );
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: ring.x,
    y: ring.y + ring.r,
    button: "left",
    clickCount: 1,
  });
  await waitFor(
    'Math.abs(document.querySelector("audio").currentTime-60)<1',
    "Seek por arraste não funcionou",
  );
  await evaluate('document.querySelector("dialog .play-button.large").click()');
  await waitFor('!document.querySelector("audio").paused', "Áudio não iniciou");
  await waitFor(
    'document.querySelector(".goal-milestone")?.classList.contains("visible")',
    "Meta não foi anunciada",
  );
  await evaluate('document.querySelector("dialog .play-button.large").click()');
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".vinyl")).animationPlayState',
    ),
    "paused",
  );
  await send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await waitFor(
    '!document.querySelector("dialog")',
    "Escape não fechou a folha",
  );
  assert.equal(
    await evaluate('document.activeElement.classList.contains("mini-track")'),
    true,
  );
  await evaluate(`document.querySelector('a[href="/biblioteca"]').click()`);
  await waitFor('!!document.querySelector(".tabs")', "Biblioteca não abriu");
  assert.equal(
    await evaluate('window.qaAudio===document.querySelector("audio")'),
    true,
  );
  await evaluate(
    `[...document.querySelectorAll('.tabs button')].find(b=>b.textContent.includes('Fila')).click()`,
  );
  await waitFor(
    'document.querySelectorAll(".queue-row").length===2',
    "Fila não apareceu",
  );
  await evaluate(
    'document.querySelector(".queue-actions button:nth-child(2)").click()',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".queue-row .episode-title").textContent',
    ),
    episodes[2].title,
  );
  await evaluate('document.querySelector(".sidebar-library a").click()');
  await waitFor(
    'document.querySelectorAll(".podcast-episodes .episode-row").length===20',
    "Primeira página não tem 20 episódios",
  );
  await evaluate('document.querySelector(".load-more button").click()');
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".podcast-episodes .episode-row").length',
    ),
    40,
  );
  await evaluate(
    'document.querySelector(".podcast-buttons .outlined").click()',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".podcast-buttons .outlined").getAttribute("aria-pressed")',
    ),
    "true",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await screenshot("podcast-desktop");
  await evaluate(`document.querySelector('.sidebar nav a[href="/estatisticas"]').click()`);
  await waitFor(
    '!!document.querySelector(".heatmap")',
    "Estatísticas não abriram",
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".heatmap > div").length'),
    112,
  );
  await screenshot("estatisticas-desktop");
  assert.equal(await evaluate('window.qaAudio===document.querySelector("audio")'),true,'O áudio deve permanecer o mesmo ao navegar pelo podcast e pelas estatísticas');
  for (const width of [320, 390, 768, 1440]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 640,
    });
    assert.equal(
      await evaluate("document.documentElement.scrollWidth<=innerWidth"),
      true,
      `Overflow em ${width}px`,
    );
  }
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await evaluate('document.querySelector(".mini-track").click()');
  await waitFor(
    '!!document.querySelector("dialog[open]")',
    "Player não reabriu",
  );
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".vinyl")).animationName',
    ),
    "none",
  );
  await evaluate(
    'document.querySelector("dialog .play-button.large").click();document.querySelector("audio").currentTime=119.6',
  );
  await waitFor(
    'document.querySelector("dialog h1")?.textContent.includes("ouvir 3")',
    "Próximo automático não respeitou a fila reordenada",
  );
  await evaluate(
    'document.querySelector("dialog .play-button.large").click();document.querySelector("dialog button[aria-label=Anterior]").click()',
  );
  await waitFor(
    'document.querySelector("dialog h1")?.textContent.includes("ouvir 1")',
    "Anterior não retomou o episódio",
  );
  await evaluate(
    'document.querySelector("dialog button[aria-label=Anterior]").click()',
  );
  assert.ok(
    await evaluate(
      'document.querySelector("dialog h1").textContent.includes("ouvir 1")',
    ),
    "Anterior não deve alternar indefinidamente entre dois episódios",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser QA: navegação persistente, modal/foco, áudio/meta diária, fila, favoritos, paginação, estatísticas e responsividade passaram. Capturas em .qa/.",
  );
} catch (error) {
  try {
    await screenshot("falha");
    console.error(await evaluate("document.body.innerText.slice(0,1200)"));
  } catch {}
  throw error;
} finally {
  try {
    if (socket?.readyState === WebSocket.OPEN) await send("Browser.close");
  } catch {}
  socket?.close();
  processHandle.kill();
}
