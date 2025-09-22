import type { IncomingMessage, ServerResponse } from "node:http";
import { createSessionController } from "../../codex/server/sessionRuntime/index.js";
import { extractRequestContext } from "../../codex/server/requestContext.js";
import { handleError, readJsonBody, sendJson, sendMethodNotAllowed } from "../../codex/server/httpHelpers.js";
import type { InputRouterInput } from "../../codex/agents/InputRouter.js";
import type { ArtifactRef } from "../../codex/schemas/ArtifactRef.js";

import { PatientBio, ConsentPreferences } from "../../codex/schemas/PatientBio.js";

// Legacy format - defined inline for backward compatibility
type LegacyBioInput = {
  patient: Partial<PatientBio>;
  consent: Partial<ConsentPreferences>;
};

// Support both legacy and new multi-modal input formats
interface BioEndpointInput {
  // Legacy format (backward compatibility)
  patient?: Partial<PatientBio>;
  consent?: Partial<ConsentPreferences>;

  // New multi-modal format
  inputType?: "text" | "audio" | "ocr";
  artifact?: ArtifactRef;
  directInput?: {
    patient?: Partial<PatientBio>;
    consent?: Partial<ConsentPreferences>;
  };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method === "POST") {
      const body = await readJsonBody<BioEndpointInput>(req);
      const { caseId, clinicianId } = extractRequestContext(req);
      const controller = await createSessionController({ caseId, clinicianId });

      // Determine if this is legacy or multi-modal input
      const isMultiModal = body.inputType !== undefined;

      if (isMultiModal) {
        // Handle new multi-modal input
        const routerInput: InputRouterInput = {
          inputType: body.inputType!,
          directInput: body.directInput,
          artifact: body.artifact,
        };

        const snapshot = await controller.updateBioMultiModal(routerInput);
        sendJson(res, 200, {
          ...snapshot,
          inputMethod: "multi-modal",
          processingFlow: snapshot.processingFlow,
        });
      } else {
        // Handle legacy input format for backward compatibility
        const legacyInput: LegacyBioInput = {
          patient: body.patient ?? {},
          consent: body.consent ?? {},
        };

        const snapshot = await controller.updateBio(legacyInput);
        sendJson(res, 200, {
          ...snapshot,
          inputMethod: "legacy",
        });
      }

      return;
    }

    if (req.method === "GET") {
      // Return current bio state and supported input types
      const { caseId, clinicianId } = extractRequestContext(req);
      const controller = await createSessionController({ caseId, clinicianId });
      const snapshot = await controller.getSnapshot();

      sendJson(res, 200, {
        patient: snapshot.record.patient,
        supportedInputTypes: ["text", "audio", "ocr"],
        inputOptions: {
          text: {
            description: "Direct form input",
            requiredFields: ["patient", "consent"],
          },
          audio: {
            description: "Speech-to-text processing",
            requiredFields: ["artifact"],
            supportedFormats: ["mp3", "wav", "m4a"],
          },
          ocr: {
            description: "Optical character recognition",
            requiredFields: ["artifact"],
            supportedFormats: ["jpg", "png", "pdf"],
          },
        },
      });
      return;
    }

    sendMethodNotAllowed(res, ["POST", "GET"]);
  } catch (error) {
    handleError(res, error);
  }
}