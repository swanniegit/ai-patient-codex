const JSON_HEADERS = { "Content-Type": "application/json" };

class SessionApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "SessionApiError";
    this.status = status;
  }
}

export class SessionClient {
  constructor(basePath = "/api") {
    this.basePath = basePath.replace(/\/$/, "");
  }

  async getSnapshot(signal) {
    return this.#request("/session", { method: "GET", signal });
  }

  async updateBio(patch, signal) {
    return this.#request("/session/bio", {
      method: "POST",
      body: JSON.stringify(patch),
      headers: JSON_HEADERS,
      signal,
    });
  }

  async confirmBio(signal) {
    return this.#request("/session/bio/confirm", {
      method: "POST",
      headers: JSON_HEADERS,
      signal,
    });
  }

  async #request(path, options) {
    const response = await fetch(`${this.basePath}${path}`, options);

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
