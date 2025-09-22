import { STATE_LABEL_LOOKUP, WORKFLOW_STEPS } from "../constants.js";

const stepIndexById = new Map(WORKFLOW_STEPS.map((step, index) => [step.id, index]));

export const registerSessionRenderer = ({ store, elements }) => {
  store.subscribe((state) => {
    const { snapshot, phase, message } = state;

    if (elements.statusMessage) {
      elements.statusMessage.textContent = message;
      elements.statusMessage.dataset.phase = phase;
    }

    if (!snapshot) {
      toggleFormDisabled(elements.form, true);
      if (elements.sessionPhase) {
        elements.sessionPhase.textContent = "";
      }
      return;
    }

    toggleFormDisabled(elements.form, phase === "loading");
    renderRecordMeta(elements.recordMeta, snapshot.record);
    renderConsentBadge(elements.consentBadge, snapshot.bio);
    renderMissingList(elements.missingList, snapshot.bio.missingFields);
    renderFormValues(elements.form, snapshot.record);
    // Removed automatic confirm button updates - now manual via Check Input button
    updateTimeline(elements.timeline, snapshot);
    renderSessionPhase(elements.sessionPhase, snapshot);
    managePanelVisibility(snapshot.state);
  });
};

const toggleFormDisabled = (form, disabled) => {
  if (!form) return;
  form.querySelectorAll("input, textarea, button").forEach((element) => {
    element.toggleAttribute("disabled", disabled);
  });
};

const renderRecordMeta = (node, record) => {
  if (!node || !record) return;
  const updated = new Date(record.updatedAt ?? Date.now());
  node.textContent = `Case ${record.caseId} \u00B7 Updated ${updated.toLocaleTimeString()}`;
};

const renderConsentBadge = (node, bio) => {
  if (!node || !bio) return;
  node.dataset.state = bio.consentValidated ? "approved" : "pending";
  node.textContent = bio.consentValidated ? "Consent verified" : "Consent pending";
};

const renderMissingList = (listNode, missingFields) => {
  if (!listNode) return;
  listNode.innerHTML = "";
  if (!missingFields || missingFields.length === 0) {
    const li = document.createElement("li");
    li.textContent = "All required fields captured.";
    listNode.appendChild(li);
    return;
  }

  missingFields.forEach((field) => {
    const li = document.createElement("li");
    li.textContent = field;
    listNode.appendChild(li);
  });
};

const renderFormValues = (form, record) => {
  if (!form || !record) return;
  const { patient } = record;
  applyFieldValue(form, "firstName", patient.firstName ?? "");
  applyFieldValue(form, "lastName", patient.lastName ?? "");
  applyFieldValue(form, "preferredName", patient.preferredName ?? "");
  applyFieldValue(form, "mrn", patient.mrn ?? "");
  applyFieldValue(form, "dateOfBirth", patient.dateOfBirth ?? "");
  applyFieldValue(form, "age", patient.age ?? "");
  applyFieldValue(form, "notes", (patient.notes ?? []).join("\n"));

  applyCheckbox(form, "dataStorage", patient.consent?.dataStorage);
  applyCheckbox(form, "photography", patient.consent?.photography);
  applyCheckbox(form, "sharingToTeamBoard", patient.consent?.sharingToTeamBoard);
};

const applyFieldValue = (form, name, value) => {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
    return;
  }
  const nextValue = String(value ?? "");
  if (field.value === nextValue) return;
  field.value = nextValue;
};

const applyCheckbox = (form, name, checked) => {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement) || field.type !== "checkbox") {
    return;
  }
  const next = Boolean(checked);
  if (field.checked === next) return;
  field.checked = next;
};

const updateConfirmButton = (button, bio, phase) => {
  if (!button || !bio) return;
  const hasBlockingFields = bio.missingFields.length > 0 || !bio.consentValidated;
  const isBusy = phase === "saving" || phase === "confirming" || phase === "loading";
  button.disabled = hasBlockingFields || isBusy;
  button.dataset.state = isBusy ? "busy" : "idle";
};

const updateTimeline = (listNode, snapshot) => {
  if (!listNode) return;
  const activeIndex = deriveActiveIndex(snapshot.state);
  listNode.innerHTML = "";

  WORKFLOW_STEPS.forEach((step, index) => {
    const item = document.createElement("li");
    let status = "pending";
    if (index < activeIndex) {
      status = "completed";
    } else if (index === activeIndex) {
      status = "active";
    }
    item.dataset.status = status;
    item.dataset.step = step.id;

    const title = document.createElement("span");
    title.className = "timeline-title";
    title.textContent = step.label;

    const hint = document.createElement("span");
    hint.className = "timeline-hint";
    hint.textContent = statusLabel(status);

    item.appendChild(title);
    item.appendChild(hint);
    listNode.appendChild(item);
  });
};

const renderSessionPhase = (node, snapshot) => {
  if (!node) return;
  const stateId = normalizeStateId(snapshot.state);
  node.textContent = STATE_LABEL_LOOKUP[stateId] ?? snapshot.state;
};

const deriveActiveIndex = (state) => {
  const normalized = normalizeStateId(state);
  if (stepIndexById.has(normalized)) {
    return stepIndexById.get(normalized);
  }
  return 0;
};

const normalizeStateId = (state) => {
  if (stepIndexById.has(state)) {
    return state;
  }
  if (state === "BIO_COMPLETE") {
    return "WOUND_IMAGING";
  }
  return "BIO_INTAKE";
};

const statusLabel = (status) => {
  switch (status) {
    case "completed":
      return "Completed";
    case "active":
      return "In progress";
    default:
      return "Pending";
  }
};

const managePanelVisibility = (state) => {
  // Get panel elements
  const bioPanel = document.querySelector('.panel:has(#bio-form)') || document.querySelector('.panel');
  const woundPanel = document.getElementById('wound-imaging-panel');

  // Show/hide panels based on session state
  switch (state) {
    case 'START':
    case 'BIO_INTAKE':
      if (bioPanel) bioPanel.style.display = 'block';
      if (woundPanel) woundPanel.style.display = 'none';
      break;

    case 'WOUND_IMAGING':
      if (bioPanel) bioPanel.style.display = 'none';
      if (woundPanel) woundPanel.style.display = 'block';
      break;

    case 'VITALS':
    case 'TIME':
    case 'FOLLOW_UP':
    case 'REVIEW':
    default:
      // For now, hide both panels for other states
      if (bioPanel) bioPanel.style.display = 'none';
      if (woundPanel) woundPanel.style.display = 'none';
      break;
  }
};
