import { CaseRecord } from "../schemas/CaseRecord.js";
import { SessionEvent, SessionState, stateTransitions, terminalStates } from "./transitions.js";

export interface StateSnapshot {
  state: SessionState;
  record: CaseRecord;
}

export class StateMachine {
  private state: SessionState;

  constructor(private record: CaseRecord, initialState: SessionState = "START") {
    this.state = initialState;
  }

  current(): StateSnapshot {
    return { state: this.state, record: this.record };
  }

  canTransition(event: SessionEvent): boolean {
    return Boolean(stateTransitions[this.state]?.[event]);
  }

  transition(event: SessionEvent, recordUpdater?: (record: CaseRecord) => CaseRecord): StateSnapshot {
    if (!this.canTransition(event)) {
      throw new Error(`Invalid transition from ${this.state} using event ${event}`);
    }

    const nextState = stateTransitions[this.state]?.[event];
    if (!nextState) {
      throw new Error(`Transition map missing state for event ${event}`);
    }

    const updatedRecord = recordUpdater ? recordUpdater(this.record) : this.record;
    this.record = {
      ...updatedRecord,
      updatedAt: new Date().toISOString(),
    };
    this.state = nextState;
    return this.current();
  }

  isTerminal(): boolean {
    return terminalStates.includes(this.state);
  }

  reset(record: CaseRecord, state: SessionState = "START"): void {
    this.record = record;
    this.state = state;
  }
}
