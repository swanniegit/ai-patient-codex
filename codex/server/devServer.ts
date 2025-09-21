import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, sep } from "node:path";
import { URL } from "node:url";
import { BioAgentInput } from "../agents/BioAgent";
import { createSessionController } from "./sessionRuntime/index.js";
import { extractRequestContext } from "./requestContext";
import { handleError, sendJson, readJsonBody } from "./httpHelpers";

const PORT = Number(process.env.PORT ?? 3000);
const publicDir = join(process.cwd(), "public");
const publicRoot = `${publicDir}${publicDir.endsWith(sep) ? "" : sep}`;

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const serveStatic = async (
  res: import("node:http").ServerResponse,
  filePath: string
) => {
  try {
    await stat(filePath);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  const ext = extname(filePath);
  const type = contentTypes[ext] ?? "text/plain; charset=utf-8";
  res.statusCode = 200;
  res.setHeader("Content-Type", type);
  createReadStream(filePath).pipe(res);
};

const normalizeApiPath = (pathname: string) => {
  if (pathname === "/api" || pathname === "/api/") {
    return "/";
  }
  if (pathname.startsWith("/api/")) {
    return pathname.slice(4) || "/";
  }
  return pathname;
};

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const routePath = normalizeApiPath(requestUrl.pathname);

    if (req.method === "GET" && routePath === "/session") {
      const { caseId, clinicianId } = extractRequestContext(req);
      const controller = await createSessionController({ caseId, clinicianId });
      const snapshot = await controller.getSnapshot();
      sendJson(res, 200, snapshot);
      return;
    }

    if (req.method === "POST" && routePath === "/session/bio") {
      const body = (await readJsonBody<Partial<BioAgentInput>>(req));
      const { caseId, clinicianId } = extractRequestContext(req);
      const controller = await createSessionController({ caseId, clinicianId });
      const snapshot = await controller.updateBio({
        patient: body.patient ?? {},
        consent: body.consent ?? {},
      });
      sendJson(res, 200, snapshot);
      return;
    }

    if (req.method === "POST" && routePath === "/session/bio/confirm") {
      const { caseId, clinicianId } = extractRequestContext(req);
      const controller = await createSessionController({ caseId, clinicianId });
      const outcome = await controller.confirmBio();
      sendJson(res, outcome.ok ? 200 : 409, outcome);
      return;
    }

    if (routePath.startsWith("/session")) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    if (req.method === "GET") {
      const relativePath = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.replace(/^\/+/, "");
      const filePath = join(publicDir, relativePath);
      if (!filePath.startsWith(publicRoot)) {
        res.statusCode = 403;
        res.end("Forbidden");
        return;
      }
      await serveStatic(res, filePath);
      return;
    }

    res.statusCode = 405;
    res.end("Method not allowed");
  } catch (error) {
    if ((error as Error).message === "INVALID_JSON") {
      const invalidJsonError = new Error("Invalid JSON body");
      invalidJsonError.name = "INVALID_JSON";
      handleError(res, invalidJsonError);
      return;
    }

    handleError(res, error);
  }
});

server.listen(PORT, () => {
  console.log(`Dev server listening on http://localhost:${PORT}`);
});
