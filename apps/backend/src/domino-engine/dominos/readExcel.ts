import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import axios from "axios";
import * as XLSX from "xlsx";
import { Storage } from "@google-cloud/storage";
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";

type FileValue = {
  key?: string;
  url?: string;
  size?: number | string;
  name?: string;
  mime?: string;
  bucket?: string; // optional; falls back to env GCS_BUCKET or url-derived
};

type FileRef =
  | { buffer: Buffer; name?: string }
  | { url: string }
  | { bucket: string; key: string };

const DEBUG = process.env.READ_EXCEL_DEBUG === "1";

export class ReadExcelDomino implements DominoExecutable {
  id: string;
  type = "readexcel" as const;

  private staticUrl?: string;
  private staticKey?: string;
  private staticBucket?: string;

  private readonly bucketFromEnv = process.env.GCS_BUCKET;
  private readonly emulatorBase = (process.env.STORAGE_EMULATOR_HOST || "").replace(/\/$/, "");
  private readonly isEmu = !!this.emulatorBase;

  private storage = new Storage({
    projectId:
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      "local-gcp",
  });

  constructor(node: PipelineStep) {
    this.id = node.id;

    const f =
      (node as any)?.data?.File?.value ??
      (node as any)?.data?.File ??
      (node as any)?.data?.file?.value;

    if (f && typeof f === "object" && typeof f.url === "string") {
      this.staticUrl = f.url;
    } else if (typeof ((node as any)?.data?.File?.url) === "string") {
      this.staticUrl = (node as any).data.File.url;
    }

    const key =
      (f && typeof f === "object" && typeof f.key === "string" && f.key) || undefined;
    const bucket =
      (f && typeof f === "object" && typeof f.bucket === "string" && f.bucket) ||
      this.bucketFromEnv ||
      (this.staticUrl ? this.bucketFromAnyUrl(this.staticUrl) : undefined);

    this.staticKey = key;
    this.staticBucket = bucket;
  }

  // ───────── utils
  private isExcelOrCsvName(name?: string) {
    return !!name && /\.(xls|xlsx|csv)$/i.test(name);
  }
  private isHttpUrl(u?: string): u is string {
    return !!u && /^https?:\/\//i.test(u);
  }
  private parseGsUri(uri?: string): { bucket: string; key: string } | undefined {
    if (!uri || !/^gs:\/\//i.test(uri)) return;
    const s = uri.replace(/^gs:\/\//i, "");
    const i = s.indexOf("/");
    if (i <= 0) return;
    return { bucket: s.slice(0, i), key: s.slice(i + 1) };
  }

  /** Try to extract bucket from a URL (works for emulator and storage.googleapis.com). */
  private bucketFromAnyUrl(url: string): string | undefined {
    try {
      const u = new URL(url);
      // virtual-hosted style: <bucket>.storage.googleapis.com/...
      const m = u.hostname.match(/^(.+)\.storage\.googleapis\.com$/i);
      if (m?.[1]) return m[1];
      // path style: /<bucket>/<object>
      const parts = u.pathname.replace(/^\/+/, "").split("/");
      if (parts[0]) return decodeURIComponent(parts[0]);
    } catch { }
    return undefined;
  }

  private findFileRef(input: Record<string, any>): FileRef | undefined {
    const walk = (val: any): FileRef | undefined => {
      if (!val) return;

      // A) Buffer from upstream
      if (
        typeof val === "object" &&
        val.file?.buffer &&
        this.isExcelOrCsvName(val.file?.originalname)
      ) {
        return { buffer: Buffer.from(val.file.buffer), name: val.file.originalname };
      }

      // B) Prefer {key} (infer bucket from value.bucket, env, or url) over URL
      const consider = (v: FileValue): FileRef | undefined => {
        if (typeof v.key === "string") {
          const bucket =
            v.bucket ||
            this.bucketFromEnv ||
            (v.url ? this.bucketFromAnyUrl(v.url) : undefined);
          if (bucket) return { bucket, key: v.key };
        }
        if (typeof v.url === "string" && this.isExcelOrCsvName(v.name || v.url)) {
          return { url: v.url };
        }
        return undefined;
      };

      if (typeof val === "object" && val.value && typeof val.value === "object") {
        const r = consider(val.value as FileValue);
        if (r) return r;
      }
      if (typeof val === "object") {
        const r = consider(val as FileValue);
        if (r) return r;
      }

      // C) Direct url anywhere
      if (typeof val?.url === "string" && this.isExcelOrCsvName(val.url)) {
        return { url: val.url };
      }

      // D) gs:// anywhere
      if (typeof val === "string") {
        const gs = this.parseGsUri(val);
        if (gs) return gs;
      }
      if (typeof val?.gsUri === "string") {
        const gs = this.parseGsUri(val.gsUri);
        if (gs) return gs;
      }

      // Recurse
      if (typeof val === "object") {
        for (const nested of Object.values(val)) {
          const found = walk(nested);
          if (found) return found;
        }
      }
      return undefined;
    };

    return walk(input);
  }

  // ───────── readers
  private async readViaHttp(url: string): Promise<Buffer> {
    if (DEBUG) console.log(`[ReadExcelDomino] HTTP GET ${url}`);
    const { data } = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout: 30_000,
      maxRedirects: 3,
    });
    return Buffer.from(data);
  }

  // use STORAGE_EMULATOR_HOST only for JSON API
  private emulatorMediaUrl(bucket: string, key: string): string {
    const base = (process.env.STORAGE_EMULATOR_HOST || "http://localhost:8000").replace(/\/$/, "");
    // JSON API media download
    return `${base}/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(key)}?alt=media`;
  }

  private async readViaEmulator(bucket: string, key: string): Promise<Buffer> {
    // try JSON API media endpoint first
    try {
      return await this.readViaHttp(this.emulatorMediaUrl(bucket, key));
    } catch (e: any) {
      // Fallbacks for older flags/run modes:
      // 1) path-style static hosting when started with -public-host
      const staticUrl = `${(process.env.GCS_PUBLIC_BASE || "http://localhost:8000").replace(/\/$/, "")}/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`;
      try {
        return await this.readViaHttp(staticUrl);
      } catch {
        // 2) (very rare) older "download" alias
        const base = (process.env.STORAGE_EMULATOR_HOST || "http://localhost:8000").replace(/\/$/, "");
        const legacy = `${base}/download/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(key)}?alt=media`;
        return await this.readViaHttp(legacy);
      }
    }
  }

  private async readViaGcsSdk(bucket: string, key: string): Promise<Buffer> {
    if (DEBUG) console.log(`[ReadExcelDomino] GCS download gs://${bucket}/${key}`);
    const file = this.storage.bucket(bucket).file(key);
    const [buf] = await file.download();
    return buf;
  }

  // ───────── execute
  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();

    const dyn = this.findFileRef((ctx.input as any) ?? {});
    let buffer: Buffer | undefined;
    let pathUsed:
      | "buffer"
      | "emu-key"
      | "http-url"
      | "prod-sdk-key"
      | "static-http"
      | "static-emu-key"
      | "static-prod-sdk-key"
      | "static-gs"
      | "none" = "none";

    try {
      if (dyn && "buffer" in dyn) {
        buffer = dyn.buffer;
        pathUsed = "buffer";
      } else if (dyn && "bucket" in dyn && "key" in dyn) {
        const bucket = dyn.bucket;
        if (this.isEmu) {
          buffer = await this.readViaEmulator(bucket, dyn.key);
          pathUsed = "emu-key";
        } else {
          buffer = await this.readViaGcsSdk(bucket, dyn.key);
          pathUsed = "prod-sdk-key";
        }
      } else if (dyn && "url" in dyn) {
        buffer = await this.readViaHttp(dyn.url);
        pathUsed = "http-url";
      } else {
        // statics
        if (this.isHttpUrl(this.staticUrl)) {
          buffer = await this.readViaHttp(this.staticUrl!);
          pathUsed = "static-http";
        } else if (this.staticUrl) {
          const gs = this.parseGsUri(this.staticUrl);
          if (!gs) throw new Error(`[ReadExcelDomino:${this.id}] Invalid gs:// URL: ${this.staticUrl}`);
          if (this.isEmu) {
            buffer = await this.readViaEmulator(gs.bucket, gs.key);
            pathUsed = "static-emu-key";
          } else {
            buffer = await this.readViaGcsSdk(gs.bucket, gs.key);
            pathUsed = "static-gs";
          }
        } else if (this.staticKey) {
          const bucket =
            this.staticBucket ||
            this.bucketFromEnv ||
            (this.staticUrl ? this.bucketFromAnyUrl(this.staticUrl) : undefined);
          if (!bucket) {
            throw new Error(
              `[ReadExcelDomino:${this.id}] No bucket for key=${this.staticKey}. Set GCS_BUCKET, include bucket in value, or provide a URL.`
            );
          }
          if (this.isEmu) {
            buffer = await this.readViaEmulator(bucket, this.staticKey);
            pathUsed = "static-emu-key";
          } else {
            buffer = await this.readViaGcsSdk(bucket, this.staticKey);
            pathUsed = "static-prod-sdk-key";
          }
        }
      }

      if (!buffer) {
        throw new Error(`[ReadExcelDomino:${this.id}] No Excel/CSV file supplied (dynamic or static).`);
      }

      if (DEBUG) console.log(`[ReadExcelDomino] path=${pathUsed}, buffer.length=${buffer.length}`);

      const wb = XLSX.read(buffer, { type: "buffer" });
      if (!wb.SheetNames?.length) {
        throw new Error(`[ReadExcelDomino:${this.id}] Workbook has no sheets (path=${pathUsed}).`);
      }
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const sheetJSON = XLSX.utils.sheet_to_json(sheet);

      if (DEBUG) console.log(`[ReadExcelDomino] rows=${Array.isArray(sheetJSON) ? sheetJSON.length : 0}`);

      return {
        id: this.id,
        output: sheetJSON,
        startedAt,
        finishedAt: Date.now(),
      };
    } catch (err) {
      console.error(`[ReadExcelDomino] failed:`, err);
      throw err;
    }
  }
}
