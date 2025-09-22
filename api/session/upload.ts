import type { IncomingMessage, ServerResponse } from "node:http";
import { extractRequestContext } from "../../codex/server/requestContext.js";
import { handleError, sendJson, sendMethodNotAllowed } from "../../codex/server/httpHelpers.js";
import type { ArtifactRef } from "../../codex/schemas/ArtifactRef.js";
import { randomUUID } from "node:crypto";
import formidable from "formidable";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method === "POST") {
      const { caseId, clinicianId } = extractRequestContext(req);

      // Parse multipart form data with in-memory processing for Vercel
      const form = formidable({
        maxFileSize: 50 * 1024 * 1024, // 50MB max
        allowEmptyFiles: false,
        // Keep files in memory for serverless environment
        fileWriteStreamHandler: () => {
          const chunks: Buffer[] = [];
          return {
            write: (chunk: Buffer) => {
              chunks.push(chunk);
            },
            end: () => {
              return Buffer.concat(chunks);
            }
          } as any;
        },
        filter: ({ mimetype }) => {
          // Allow only specific file types
          const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "audio/mpeg",
            "audio/wav",
            "audio/m4a",
            "audio/mp4",
            "application/pdf",
          ];
          return allowedTypes.includes(mimetype || "");
        },
      });

      const [fields, files] = await form.parse(req);

      // Get the uploaded file
      const fileArray = Array.isArray(files.file) ? files.file : [files.file];
      const uploadedFile = fileArray[0];

      if (!uploadedFile) {
        throw new Error("No file uploaded");
      }

      // Validate file
      const validation = validateUpload(uploadedFile);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // For Vercel, we'll create a data URL instead of file storage
      // Read file data from formidable File object
      const fs = await import("fs");
      const fileBuffer = await fs.promises.readFile(uploadedFile.filepath);
      const base64Data = fileBuffer.toString('base64');
      const mimeType = uploadedFile.mimetype || 'application/octet-stream';
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      // Create artifact reference with data URL
      const artifact: ArtifactRef = {
        id: randomUUID(),
        kind: getArtifactKind(uploadedFile.mimetype || ""),
        uri: dataUrl, // Use data URL for serverless
        capturedAt: new Date().toISOString(),
        capturedBy: clinicianId,
        description: getFieldValue(fields.description) || `Uploaded ${uploadedFile.originalFilename}`,
        metadata: {
          originalFilename: uploadedFile.originalFilename,
          fileSize: uploadedFile.size,
          mimeType: uploadedFile.mimetype,
          uploadedAt: new Date().toISOString(),
          storageType: "dataurl", // Indicate this is a data URL
        },
        qa: {
          confidence: 1.0, // File upload is certain
          notes: "File uploaded successfully as data URL, ready for processing",
        },
      };

      sendJson(res, 201, {
        success: true,
        artifact,
        message: "File uploaded successfully (in-memory processing)",
        nextSteps: {
          bio: {
            endpoint: "/api/session/bio",
            method: "POST",
            payload: {
              inputType: artifact.kind === "audio" ? "audio" : "ocr",
              artifact,
            },
          },
        },
        deployment: {
          environment: "vercel",
          storage: "in-memory",
          note: "Files processed directly without persistent storage"
        }
      });

      return;
    }

    if (req.method === "GET") {
      // Return upload requirements and supported file types
      sendJson(res, 200, {
        supportedTypes: {
          image: {
            mimeTypes: ["image/jpeg", "image/png", "image/gif"],
            maxSize: "10MB",
            purposes: ["bio", "wound", "document"],
            description: "Photos of ID cards, wristbands, forms, wound sites",
          },
          audio: {
            mimeTypes: ["audio/mpeg", "audio/wav", "audio/m4a", "audio/mp4"],
            maxSize: "25MB", // Reduced for Vercel memory limits
            purposes: ["bio"],
            description: "Voice recordings of patient interviews or dictations",
          },
          document: {
            mimeTypes: ["application/pdf"],
            maxSize: "10MB", // Reduced for Vercel
            purposes: ["bio", "document"],
            description: "Scanned forms, consent documents, medical records",
          },
        },
        deployment: {
          environment: "vercel",
          storage: "in-memory",
          limitations: [
            "Files processed in memory only",
            "No persistent file storage",
            "Reduced file size limits for serverless constraints",
            "Processing happens within function execution time"
          ]
        },
        securityRequirements: [
          "Files processed in memory only (not stored)",
          "File type validation performed on all uploads",
          "Access controlled by clinician authentication",
          "Data URLs used for serverless compatibility",
        ],
        uploadProcess: [
          "1. POST file to /api/session/upload",
          "2. File converted to data URL for processing",
          "3. Use artifact in bio/wound/other endpoints immediately",
        ],
      });

      return;
    }

    sendMethodNotAllowed(res, ["POST", "GET"]);
  } catch (error) {
    handleError(res, error);
  }
}

// Helper function to determine artifact kind from file type
function getArtifactKind(mimeType: string): ArtifactRef["kind"] {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.includes("pdf")) return "document";
  return "other";
}

// Helper function to validate file uploads (adjusted for Vercel)
function validateUpload(file: formidable.File): { valid: boolean; error?: string } {
  const maxSizes = {
    "image/": 10 * 1024 * 1024, // 10MB (reduced for Vercel)
    "audio/": 25 * 1024 * 1024, // 25MB (reduced for Vercel)
    "application/pdf": 10 * 1024 * 1024, // 10MB (reduced for Vercel)
  };

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "audio/mpeg",
    "audio/wav",
    "audio/m4a",
    "audio/mp4",
    "application/pdf",
  ];

  if (!allowedTypes.includes(file.mimetype || "")) {
    return { valid: false, error: `Unsupported file type: ${file.mimetype}` };
  }

  const maxSize = Object.entries(maxSizes).find(([prefix]) =>
    (file.mimetype || "").startsWith(prefix) || file.mimetype === prefix
  )?.[1] || maxSizes["image/"];

  if (file.size > maxSize) {
    return { valid: false, error: `File too large: ${file.size} bytes (max: ${maxSize})` };
  }

  return { valid: true };
}

function getFieldValue(field: formidable.File | formidable.File[] | string | string[] | undefined): string | undefined {
  if (typeof field === "string") return field;
  if (Array.isArray(field) && field.length > 0) {
    const first = field[0];
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
}