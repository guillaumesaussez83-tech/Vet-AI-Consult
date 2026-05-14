import { Storage, type StorageOptions, File } from "@google-cloud/storage";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

// ============================================================================
//  Provider switching
//  - "replit-sidecar"  (dev local sur Replit)  → sidecar http://127.0.0.1:1106
//  - "gcs" (prod, Railway/k8s/autre)            → GCS standard via service
//    account JSON (variable GOOGLE_APPLICATION_CREDENTIALS_JSON base64).
//  Le défaut prod est "gcs". Pour conserver le comportement Replit, positionner
//  OBJECT_STORAGE_PROVIDER=replit-sidecar.
// ============================================================================
type Provider = "gcs" | "replit-sidecar";
const PROVIDER: Provider =
  ((process.env["OBJECT_STORAGE_PROVIDER"] as Provider | undefined) ?? "gcs");

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function buildStorageClient(): Storage {
  if (PROVIDER === "replit-sidecar") {
    return new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: { type: "json", subject_token_field_name: "access_token" },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
  }

  // gcs (prod) — credentials standards
  const opts: StorageOptions = {};
  const credsB64 = process.env["GOOGLE_APPLICATION_CREDENTIALS_JSON"];
  if (credsB64) {
    try {
      const json = Buffer.from(credsB64, "base64").toString("utf8");
      const credentials = JSON.parse(json);
      opts.credentials = credentials;
      opts.projectId = credentials.project_id;
    } catch (err) {
      throw new Error(
        "Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON — expected base64-encoded service account JSON. " +
          (err as Error).message,
      );
    }
  }
  // Sans credentials explicites, le SDK utilisera la chaîne ADC par défaut.
  return new Storage(opts);
}

export const objectStorageClient: Storage = buildStorageClient();

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env["PUBLIC_OBJECT_SEARCH_PATHS"] || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0),
      ),
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket and set " +
          "PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths).",
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env["PRIVATE_OBJECT_DIR"] || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket and set PRIVATE_OBJECT_DIR env var.",
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) return file;
    }
    return null;
  }

  async downloadObject(file: File, cacheTtlSec: number = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  /**
   * URL signée PUT. Path d'upload structuré en tenant-safe :
   *   {PRIVATE_OBJECT_DIR}/uploads/{clinicId}/{userId}/{uuid}
   * Cela évite qu'une erreur d'ACL côté lecture expose des objets d'une
   * autre clinique.
   */
  async getObjectEntityUploadURL(args: {
    clinicId: string;
    ownerUserId: string;
  }): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const safeClinic = args.clinicId.replace(/[^A-Za-z0-9_-]/g, "_");
    const safeUser = args.ownerUserId.replace(/[^A-Za-z0-9_-]/g, "_");
    const fullPath = `${privateObjectDir}/uploads/${safeClinic}/${safeUser}/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({ bucketName, objectName, method: "PUT", ttlSec: 900 });
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) entityDir = `${entityDir}/`;
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) throw new ObjectNotFoundError();
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) return rawPath;

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) objectEntityDir = `${objectEntityDir}/`;

    if (!rawObjectPath.startsWith(objectEntityDir)) return rawObjectPath;

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) return normalizedPath;

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");
  return { bucketName, objectName };
}

// ============================================================================
//  Signing URLs — routage selon le provider
// ============================================================================
async function signObjectURL(args: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  if (PROVIDER === "replit-sidecar") {
    return signObjectURLViaReplitSidecar(args);
  }
  return signObjectURLViaGcs(args);
}

async function signObjectURLViaReplitSidecar(args: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: args.bucketName,
    object_name: args.objectName,
    method: args.method,
    expires_at: new Date(Date.now() + args.ttlSec * 1000).toISOString(),
  };
  const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL via Replit sidecar (status ${response.status}). ` +
        `Ensure you're running on Replit or switch OBJECT_STORAGE_PROVIDER=gcs.`,
    );
  }
  const { signed_url: signedURL } = await response.json() as { signed_url: string };
  return signedURL;
}

async function signObjectURLViaGcs(args: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const file = objectStorageClient.bucket(args.bucketName).file(args.objectName);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: args.method === "PUT" ? "write" : args.method === "DELETE" ? "delete" : "read",
    expires: Date.now() + args.ttlSec * 1000,
  });
  return url;
}
