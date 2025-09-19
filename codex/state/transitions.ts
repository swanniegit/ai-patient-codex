export type SessionState =
  | "START"
  | "BIO_INTAKE"
  | "WOUND_IMAGING"
  | "VITALS"
  | "TIME"
  | "FOLLOW_UP"
  | "REVIEW"
  | "ASSEMBLE_JSON"
  | "LINK_TO_CLINICIAN"
  | "STORE_SYNC"
  | "DONE";

export type SessionEvent =
  | "BEGIN"
  | "BIO_CONFIRMED"
  | "IMAGING_CONFIRMED"
  | "VITALS_CAPTURED"
  | "TIME_CAPTURED"
  | "FOLLOW_UP_RESOLVED"
  | "REVIEW_COMPLETED"
  | "JSON_ASSEMBLED"
  | "CLINICIAN_LINKED"
  | "STORED"
  | "RESET"
  | "ROLLBACK";

export const stateTransitions: Record<SessionState, Partial<Record<SessionEvent, SessionState>>> = {
  START: {
    BEGIN: "BIO_INTAKE",
  },
  BIO_INTAKE: {
    BIO_CONFIRMED: "WOUND_IMAGING",
    ROLLBACK: "START",
  },
  WOUND_IMAGING: {
    IMAGING_CONFIRMED: "VITALS",
    RESET: "BIO_INTAKE",
    ROLLBACK: "BIO_INTAKE",
  },
  VITALS: {
    VITALS_CAPTURED: "TIME",
    ROLLBACK: "WOUND_IMAGING",
  },
  TIME: {
    TIME_CAPTURED: "FOLLOW_UP",
    ROLLBACK: "VITALS",
  },
  FOLLOW_UP: {
    FOLLOW_UP_RESOLVED: "REVIEW",
    ROLLBACK: "TIME",
  },
  REVIEW: {
    REVIEW_COMPLETED: "ASSEMBLE_JSON",
    ROLLBACK: "FOLLOW_UP",
  },
  ASSEMBLE_JSON: {
    JSON_ASSEMBLED: "LINK_TO_CLINICIAN",
    ROLLBACK: "REVIEW",
  },
  LINK_TO_CLINICIAN: {
    CLINICIAN_LINKED: "STORE_SYNC",
    ROLLBACK: "ASSEMBLE_JSON",
  },
  STORE_SYNC: {
    STORED: "DONE",
    ROLLBACK: "LINK_TO_CLINICIAN",
  },
  DONE: {
    RESET: "START",
  },
};

export const terminalStates: SessionState[] = ["DONE"];
