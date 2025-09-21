export class HttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class MissingIdentityError extends HttpError {
  constructor() {
    super("Missing session or clinician identifier", 400);
  }
}

export class UnauthorizedAccessError extends HttpError {
  constructor() {
    super("Clinician not authorized for requested session", 403);
  }
}
