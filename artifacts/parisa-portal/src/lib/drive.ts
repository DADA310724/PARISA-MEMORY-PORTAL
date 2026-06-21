import { api } from "./api";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
}

export interface DriveListResp {
  files: DriveFile[];
  nextPageToken?: string;
}

export const isFolder = (f: DriveFile) =>
  f.mimeType === "application/vnd.google-apps.folder";

export const isImage = (f: DriveFile) => f.mimeType.startsWith("image/");
export const isVideo = (f: DriveFile) => f.mimeType.startsWith("video/");
export const isAudio = (f: DriveFile) => f.mimeType.startsWith("audio/");
export const isHtml = (f: DriveFile) =>
  f.mimeType === "text/html" ||
  f.name.toLowerCase().endsWith(".html") ||
  f.name.toLowerCase().endsWith(".htm");
export const isText = (f: DriveFile) =>
  f.mimeType.startsWith("text/") ||
  /\.(txt|md|log|json|csv)$/i.test(f.name);
export const isPdf = (f: DriveFile) => f.mimeType === "application/pdf";

export async function listFolder(folderId: string): Promise<DriveListResp> {
  return api<DriveListResp>(
    `/drive/list?folderId=${encodeURIComponent(folderId)}`,
  );
}

export async function fileMeta(id: string): Promise<DriveFile> {
  return api<DriveFile>(`/drive/file/${id}`);
}

export async function fetchText(id: string): Promise<string> {
  const r = await api<{ text: string }>(`/drive/text/${id}`);
  return r.text;
}

export const proxyUrl = (id: string) => `/api/drive/proxy/${id}`;
export const streamUrl = (id: string) => `/api/drive/stream/${id}`;

export async function uploadFiles(
  folderId: string,
  files: File[],
): Promise<{ results: unknown[] }> {
  const fd = new FormData();
  fd.append("folderId", folderId);
  for (const f of files) fd.append("files", f, f.name);
  return api<{ results: unknown[] }>("/drive/upload", {
    method: "POST",
    body: fd,
  });
}

export async function copyFromDrive(
  sourceFileId: string,
  destFolderId: string,
  name?: string,
): Promise<DriveFile> {
  return api<DriveFile>("/drive/copy-from-drive", {
    method: "POST",
    body: { sourceFileId, destFolderId, name },
  });
}

export async function createSubFolder(
  name: string,
  parentId: string,
): Promise<DriveFile> {
  return api<DriveFile>("/drive/create-folder", {
    method: "POST",
    body: { name, parentId },
  });
}

export function formatSize(bytes?: string | number): string {
  if (!bytes) return "";
  const n = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!Number.isFinite(n) || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDateBn(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
