const JSON_HEADERS = { "Content-Type": "application/json" };

class SessionApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "SessionApiError";
    this.status = status;
  }
}

const identityHeaders = (identity) => ({
  "X-Session-Id": identity?.sessionId ?? "",
  "X-Clinician-Id": identity?.clinicianId ?? "",
});

export class SessionClient {
  constructor(basePath = "/api", identity) {
    this.basePath = basePath.replace(/\/$/, "");
    this.identity = identity ?? null;
  }

  setIdentity(identity) {
    this.identity = identity;
  }

  async getSnapshot(signal) {
    return this.#request("/session", { method: "GET", signal });
  }

  async updateBio(patch, signal) {
    return this.#request("/session/bio", {
      method: "POST",
      body: JSON.stringify(patch),
      signal,
    });
  }

  async confirmBio(signal) {
    return this.#request("/session/bio/confirm", {
      method: "POST",
      signal,
    });
  }

  async #request(path, options) {
    if (!this.identity?.sessionId || !this.identity?.clinicianId) {
      throw new Error("Missing session identity; call setIdentity first");
    }
    const mergedHeaders = {
      ...JSON_HEADERS,
      ...identityHeaders(this.identity),
      ...(options.headers ?? {}),
    };
    const response = await fetch(`${this.basePath}${path}`, {
      ...options,
      headers: mergedHeaders,
    });

    if (!response.ok) {
      let message = response.statusText || "Request failed";
      try {
        const payload = await response.json();
        if (payload && typeof payload.error === "string") {
          message = payload.error;
        }
      } catch (error) {
        if ((error instanceof Error && error.name === "AbortError") === false) {
          // ignore JSON parse issues, use default message
        }
      }

      throw new SessionApiError(message, response.status);
    }

    if (response.status === 204) {
      return undefined;
    }

    return response.json();
  }
}

export const createSessionClient = (basePath) => new SessionClient(basePath);
