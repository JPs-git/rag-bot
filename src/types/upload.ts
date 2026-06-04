export interface UploadResult {
  successCount: number;
  skippedCount: number;
  skippedFiles: string[];
  failedCount: number;
  failedFiles: { name: string; error: string }[];
}
