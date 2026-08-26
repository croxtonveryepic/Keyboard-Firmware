import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { watch } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseKeymap } from "./src/keymap-parser.mjs";

const visualizerRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(visualizerRoot, "..");
const defaultPublicDirectory = resolve(visualizerRoot, "public");
const defaultKeymapPath = resolve(repositoryRoot, "config", "adv360.keymap");
const defaultLayoutPath = resolve(repositoryRoot, "config", "info.json");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function displayPath(filePath) {
  const repositoryRelativePath = relative(repositoryRoot, filePath);
  return repositoryRelativePath.startsWith("..") ? filePath : repositoryRelativePath.replaceAll("\\", "/");
}

async function loadLayout(layoutPath) {
  const info = JSON.parse(await readFile(layoutPath, "utf8"));
  const [layoutName, layoutDefinition] = Object.entries(info.layouts ?? {})[0] ?? [];
  if (!layoutName || !Array.isArray(layoutDefinition?.layout)) {
    throw new Error(`No keyboard layout geometry was found in ${layoutPath}.`);
  }

  return {
    id: info.id ?? "keyboard",
    name: info.name ?? info.id ?? "Keyboard",
    layoutName,
    keys: layoutDefinition.layout.map((key, position) => ({
      position,
      label: String(key.label ?? position),
      x: Number(key.x ?? 0),
      y: Number(key.y ?? 0),
      width: Number(key.w ?? 1),
      height: Number(key.h ?? 1),
      rotation: Number(key.r ?? 0),
      rotationX: Number(key.rx ?? key.x ?? 0),
      rotationY: Number(key.ry ?? key.y ?? 0),
    })),
  };
}

async function buildSnapshot({ keymapPath, layout, revision }) {
  const [source, fileStats] = await Promise.all([readFile(keymapPath, "utf8"), stat(keymapPath)]);
  return {
    ...parseKeymap(source, { expectedKeyCount: layout.keys.length, sourcePath: displayPath(keymapPath) }),
    keyboard: layout,
    revision,
    updatedAt: fileStats.mtime.toISOString(),
  };
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

async function sendStaticFile(response, pathname, publicDirectory) {
  let requestPath;
  try {
    requestPath = decodeURIComponent(pathname === "/" ? "index.html" : pathname.slice(1));
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const filePath = resolve(publicDirectory, requestPath);
  const relativePath = relative(publicDirectory, filePath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      throw new Error("Not a file");
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

export async function createVisualizerServer({
  host = "127.0.0.1",
  port = 3036,
  keymapPath = defaultKeymapPath,
  layoutPath = defaultLayoutPath,
  publicDirectory = defaultPublicDirectory,
} = {}) {
  const resolvedKeymapPath = resolve(keymapPath);
  const resolvedLayoutPath = resolve(layoutPath);
  const resolvedPublicDirectory = resolve(publicDirectory);
  const layout = await loadLayout(resolvedLayoutPath);
  let revision = 1;
  let snapshot = await buildSnapshot({ keymapPath: resolvedKeymapPath, layout, revision });
  const eventClients = new Set();

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);

    if (request.method === "GET" && requestUrl.pathname === "/api/keymap") {
      sendJson(response, 200, snapshot);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/events") {
      response.writeHead(200, {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
      });
      response.write(`event: connected\ndata: ${JSON.stringify({ revision: snapshot.revision })}\n\n`);
      eventClients.add(response);
      request.on("close", () => eventClients.delete(response));
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end("Method not allowed");
      return;
    }

    await sendStaticFile(response, requestUrl.pathname, resolvedPublicDirectory);
  });

  let reloadTimer;
  const broadcast = (eventName, value) => {
    const message = `event: ${eventName}\ndata: ${JSON.stringify(value)}\n\n`;
    for (const client of eventClients) {
      client.write(message);
    }
  };

  const reload = async () => {
    try {
      revision += 1;
      snapshot = await buildSnapshot({ keymapPath: resolvedKeymapPath, layout, revision });
      broadcast("keymap", snapshot);
    } catch (error) {
      broadcast("reload-error", { message: error instanceof Error ? error.message : String(error) });
    }
  };

  const keymapWatcher = watch(dirname(resolvedKeymapPath), { persistent: false }, (_eventType, filename) => {
    if (filename && filename.toString() !== resolvedKeymapPath.slice(dirname(resolvedKeymapPath).length + 1)) {
      return;
    }
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(reload, 80);
  });

  await new Promise((resolveListening, rejectListening) => {
    server.once("error", rejectListening);
    server.listen(port, host, () => {
      server.off("error", rejectListening);
      resolveListening();
    });
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;

  return {
    host,
    port: actualPort,
    url: `http://${host}:${actualPort}`,
    getSnapshot: () => snapshot,
    close: async () => {
      clearTimeout(reloadTimer);
      keymapWatcher.close();
      for (const client of eventClients) {
        client.end();
      }
      await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
    },
  };
}

function parseArguments(argumentsList) {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--keymap") {
      options.keymapPath = argumentsList[++index];
    } else if (argument === "--layout") {
      options.layoutPath = argumentsList[++index];
    } else if (argument === "--host") {
      options.host = argumentsList[++index];
    } else if (argument === "--port") {
      options.port = Number(argumentsList[++index]);
    } else if (argument === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log("Usage: node server.mjs [--keymap PATH] [--layout PATH] [--host HOST] [--port PORT]");
    } else {
      const visualizer = await createVisualizerServer(options);
      console.log(`Advantage360 keymap visualizer: ${visualizer.url}`);
      console.log(`Watching ${visualizer.getSnapshot().sourcePath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
