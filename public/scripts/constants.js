export const WORKFLOW_STEPS = [
  { id: "BIO_INTAKE", label: "Bio Intake" },
  { id: "WOUND_IMAGING", label: "Wound Imaging" },
  { id: "VITALS", label: "Vitals" },
  { id: "TIME", label: "TIME" },
  { id: "FOLLOW_UP", label: "Follow-up" },
  { id: "REVIEW", label: "Review" },
  { id: "ASSEMBLE_JSON", label: "Assemble JSON" },
  { id: "LINK_TO_CLINICIAN", label: "Clinician Link" },
  { id: "STORE_SYNC", label: "Store & Sync" },
];

export const STATE_LABEL_LOOKUP = WORKFLOW_STEPS.reduce((acc, step) => {
  acc[step.id] = step.label;
  return acc;
}, /** @type {Record<string, string>} */ ({}));
