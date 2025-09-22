import { describe, it, expect, vi, beforeEach } from "vitest";
import { BioAgent, BioAgentInput } from "../agents/BioAgent.js";
import { InputType } from "../agents/InputRouter.js";
import { OcrAsrAgent, OcrAsrInput } from "../agents/OcrAsrAgent.js";
import { InputRouter, InputRouterInput } from "../agents/InputRouter.js";
import { AgentDependencies, AgentRunContext } from "../agents/AgentContext.js";
import { ArtifactRef } from "../schemas/ArtifactRef.js";
import { CaseRecord } from "../schemas/CaseRecord.js";

// Mock dependencies for testing
const mockDependencies: AgentDependencies = {
  promptLoader: {
    load: vi.fn().mockResolvedValue("Mock prompt content"),
  },
  llm: {
    generate: vi.fn().mockResolvedValue({
      text: '{"firstName": "John", "lastName": "Doe", "age": 38, "sex": "male", "consent": {"dataStorage": true, "photography": true, "sharingToTeamBoard": false}}',
    }),
  },
};

const mockContext: AgentRunContext = {
  record: {
    caseId: "test-case-123",
    clinicianId: "test-clinician-456",
    clinicianPinHash: "test-hash",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    patient: {
      notes: [],
      consent: {
        dataStorage: false,
        photography: false,
        sharingToTeamBoard: false,
      },
    },
    wounds: { photos: [] },
    followUps: [],
    artifacts: [],
    provenanceLog: [],
    consentGranted: false,
    status: "draft",
    storageMeta: {
      version: 1,
      schema: "codex.wound.v1",
      state: "BIO_INTAKE",
      pinIssuedAt: undefined,
    },
    encryptedFields: {},
  } as CaseRecord,
  artifacts: [],
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  autosave: vi.fn(),
};

describe("Multi-Modal Bio Input System", () => {
  let bioAgent: BioAgent;
  let inputRouter: InputRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    bioAgent = new BioAgent(mockDependencies);
    inputRouter = new InputRouter(mockDependencies);
  });

  describe("BioAgent Enhanced Input", () => {
    it("should handle text input type", async () => {
      const input: BioAgentInput = {
        patient: { firstName: "Jane", lastName: "Smith" },
        consent: { dataStorage: true, photography: true, sharingToTeamBoard: false },
        sourceInfo: {
          inputMethod: "text",
          artifactId: undefined,
        },
      };

      const result = await bioAgent.run(input, mockContext);

      expect(result.data.patient.firstName).toBe("Jane");
      expect(result.data.patient.firstName).toBe("Jane");
      expect(result.data.patient.lastName).toBe("Smith");
      expect(result.data.consentValidated).toBe(true);
    });

    it("should handle OCR input type with textToParse", async () => {
      const input: BioAgentInput = {
        textToParse: "Patient: John Doe, Age: 45, Male, MRN: 123456",
        sourceInfo: {
          inputMethod: "ocr",
          artifactId: "test-artifact-123",
        },
      };

      const result = await bioAgent.run(input, mockContext);
      expect(result.data.extractedData).toBeDefined();
      expect(mockDependencies.llm!.generate).toHaveBeenCalled();
    });

    it("should handle audio input type with textToParse", async () => {
      const input: BioAgentInput = {
        textToParse: "Patient states name is Sarah Johnson, date of birth January 1st 1980",
        sourceInfo: {
          inputMethod: "audio",
          artifactId: "test-audio-456",
        },
      };

      const result = await bioAgent.run(input, mockContext);
      expect(result.data.extractedData).toBeDefined();
      expect(mockDependencies.llm!.generate).toHaveBeenCalled();
    });

    it("should track provenance for different input types", async () => {
      const artifact: ArtifactRef = {
        id: "test-artifact-123",
        kind: "image",
        uri: "file://test-image.jpg",
        description: "Patient ID card",
      };

      const input: BioAgentInput = {
        textToParse: "Some extracted text",
        sourceInfo: {
          inputMethod: "ocr",
          artifactId: artifact.id,
        },
      };

      const result = await bioAgent.run(input, mockContext);

      expect(result.provenance).toHaveLength(1);
      expect(result.provenance?.[0].agent).toBe("BioAgent");
      expect(result.provenance?.[0].artifactId).toBe(artifact.id);
      expect(result.provenance?.[0].notes).toContain("ocr input");
    });

    it("should sanitize extracted data properly", async () => {
      // Mock LLM response with potentially unsafe data
      mockDependencies.llm!.generate = vi.fn().mockResolvedValue({
        text: '{"firstName": "  John  ", "age": "not-a-number", "sex": "invalid", "dateOfBirth": "bad-date"}',
      });

      const input: BioAgentInput = {
        textToParse: "Some text",
        sourceInfo: {
          inputMethod: "ocr",
          artifactId: undefined,
        },
      };

      const result = await bioAgent.run(input, mockContext);

      // Check that sanitization occurred
      expect(result.data.extractedData?.firstName).toBe("John"); // Trimmed
      expect(result.data.extractedData?.age).toBeUndefined(); // Invalid number removed
      expect(result.data.extractedData?.sex).toBeUndefined(); // Invalid sex removed
      expect(result.data.extractedData?.dateOfBirth).toBeUndefined(); // Invalid date removed
    });
  });

  describe("InputRouter Workflow", () => {
    it("should route text input directly to BioAgent", async () => {
      const input = InputRouter.createTextInput(
        { firstName: "Alice", lastName: "Johnson" },
        { dataStorage: true, photography: true, sharingToTeamBoard: false }
      );

      const result = await inputRouter.run(input, mockContext);

      // inputSource was removed from BioAgentOutput in the clean redesign
      expect(result.data.bioResult.patient.firstName).toBe("Alice");
      expect(result.data.ocrAsrResult).toBeUndefined();
      expect(result.data.processingFlow).toContain("Started text input processing");
    });

    it("should validate input creation methods", () => {
      const audioArtifact: ArtifactRef = {
        id: "test",
        kind: "audio",
        uri: "file://test.mp3",
      };

      const imageArtifact: ArtifactRef = {
        id: "test",
        kind: "image",
        uri: "file://test.jpg",
      };

      expect(() => InputRouter.createAudioInput(imageArtifact)).toThrow("Audio input requires an audio artifact");
      expect(() => InputRouter.createOCRInput(audioArtifact)).toThrow("OCR input requires an image or document artifact");
    });

    it("should handle processing errors gracefully", async () => {
      // Mock an error by providing an invalid artifact kind
      const invalidArtifact: ArtifactRef = {
        id: "test-123",
        kind: "other", // Invalid for OCR/ASR
        uri: "file://test.unknown",
      };

      const input: InputRouterInput = {
        inputType: "ocr",
        artifact: invalidArtifact,
      };

      const result = await inputRouter.run(input, mockContext);

      expect(result.data.processingFlow.some(step => step.includes("Error:"))).toBe(true);
      expect(result.followUps).toContain("Processing error occurred - please verify extracted data");
      expect(result.data.bioResult).toBeDefined(); // Should still have fallback result
    });
  });

  describe("Integration Flow", () => {
    it("should handle missing fields appropriately", async () => {
      // Mock LLM response with partial data
      mockDependencies.llm!.generate = vi.fn().mockResolvedValue({
        text: '{"firstName": "John"}', // Only partial data
      });

      const artifact: ArtifactRef = {
        id: "partial-data-123",
        kind: "image",
        uri: "file://partial.jpg",
      };

      const input = InputRouter.createOCRInput(artifact);
      const result = await inputRouter.run(input, mockContext);

      expect(result.data.bioResult.missingFields.length).toBeGreaterThan(0);
      expect(result.followUps).toBeTruthy();
      expect(result.followUps!.length).toBeGreaterThan(0);
    });
  });
});