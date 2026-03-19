import {
  DominoExecutable,
  ExecuteContext,
  DominoResult,
} from '../domino-engine.type';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Storage } from '@google-cloud/storage';
import { PipelineStep } from '../../types/pipelineStepType';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import yauzl from 'yauzl';

type FileValue = {
  key?: string;
  url?: string;
  size?: number | string;
  name?: string;
  mime?: string;
  bucket?: string; // optional; falls back to env GCS_BUCKET or url-derived
};

type FileRef =
  | { buffer: Buffer; name?: string; mime?: string }
  | { url: string; name?: string; mime?: string }
  | { bucket: string; key: string; name?: string; mime?: string };

type DetectedFileKind =
  | 'spreadsheet'
  | 'pdf'
  | 'docx'
  | 'json'
  | 'html'
  | 'xml'
  | 'text';

type ParsedContent =
  | { kind: 'spreadsheet'; output: Record<string, unknown>[] }
  | { kind: 'json'; output: unknown }
  | { kind: 'pdf' | 'docx' | 'html' | 'xml' | 'text'; output: string };

const DEBUG = process.env.READ_EXCEL_DEBUG === '1';

export class ReadExcelDomino implements DominoExecutable {
  id: string;
  type = 'readexcel' as const;

  private staticUrl?: string;
  private staticKey?: string;
  private staticBucket?: string;

  private readonly bucketFromEnv = process.env.GCS_BUCKET;
  private readonly emulatorBase = (
    process.env.STORAGE_EMULATOR_HOST || ''
  ).replace(/\/$/, '');
  private readonly isEmu = !!this.emulatorBase;

  private storage = new Storage({
    projectId:
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      'local-gcp',
  });

  constructor(node: PipelineStep) {
    this.id = node.id;

    const f =
      (node as any)?.data?.File?.value ??
      (node as any)?.data?.File ??
      (node as any)?.data?.file?.value;

    if (f && typeof f === 'object' && typeof f.url === 'string') {
      this.staticUrl = f.url;
    } else if (typeof (node as any)?.data?.File?.url === 'string') {
      this.staticUrl = (node as any).data.File.url;
    }

    const key =
      (f && typeof f === 'object' && typeof f.key === 'string' && f.key) ||
      undefined;
    const bucket =
      (f &&
        typeof f === 'object' &&
        typeof f.bucket === 'string' &&
        f.bucket) ||
      this.bucketFromEnv ||
      (this.staticUrl ? this.bucketFromAnyUrl(this.staticUrl) : undefined);

    this.staticKey = key;
    this.staticBucket = bucket;
  }

  // ───────── utils
  private getFileExtension(name?: string) {
    if (!name) return '';
    const cleanName = name.split('?')[0].split('#')[0];
    const match = cleanName.match(/\.([a-z0-9]+)$/i);
    return match?.[1]?.toLowerCase() ?? '';
  }

  private isSpreadsheetExtension(ext: string) {
    return ['csv', 'tsv', 'xls', 'xlsx'].includes(ext);
  }

  private isTextLikeExtension(ext: string) {
    return ['htm', 'html', 'json', 'md', 'txt', 'xml'].includes(ext);
  }

  private isSpreadsheetMime(mime?: string) {
    const normalized = mime?.toLowerCase() ?? '';
    return [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/tab-separated-values',
      'application/csv',
      'application/vnd.ms-excel.sheet.macroenabled.12',
    ].includes(normalized);
  }

  private isTextLikeMime(mime?: string) {
    const normalized = mime?.toLowerCase() ?? '';
    if (!normalized) return false;
    if (normalized.startsWith('text/')) return true;
    return [
      'application/json',
      'application/xml',
      'application/xhtml+xml',
    ].includes(normalized);
  }

  private isPdfBuffer(buffer: Buffer) {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }

  private isZipBuffer(buffer: Buffer) {
    return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  }

  private isOleCompoundBuffer(buffer: Buffer) {
    const header = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    return header.every((value, index) => buffer[index] === value);
  }

  private looksLikeUtf8Text(buffer: Buffer) {
    if (!buffer.length) return true;
    const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
    let suspicious = 0;
    for (const byte of sample) {
      const isControl = byte < 9 || (byte > 13 && byte < 32);
      if (isControl) suspicious += 1;
    }
    return suspicious / sample.length < 0.05;
  }

  private normalizeText(text: string) {
    return text
      .replace(/\u0000/g, '')
      .replace(/\r\n/g, '\n')
      .trim();
  }

  private stripHtml(html: string) {
    return this.normalizeText(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<\/(p|div|section|article|li|h[1-6]|tr)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>'),
    );
  }

  private getPreferredKindFromHints(
    name?: string,
    mime?: string,
  ): DetectedFileKind | undefined {
    const ext = this.getFileExtension(name);
    if (this.isSpreadsheetExtension(ext) || this.isSpreadsheetMime(mime)) {
      return 'spreadsheet';
    }
    if (ext === 'pdf' || mime?.toLowerCase() === 'application/pdf') {
      return 'pdf';
    }
    if (
      ext === 'docx' ||
      mime?.toLowerCase() ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return 'docx';
    }
    if (ext === 'json' || mime?.toLowerCase() === 'application/json') {
      return 'json';
    }
    if (ext === 'xml' || mime?.toLowerCase() === 'application/xml') {
      return 'xml';
    }
    if (
      ext === 'html' ||
      ext === 'htm' ||
      mime?.toLowerCase() === 'text/html'
    ) {
      return 'html';
    }
    if (this.isTextLikeExtension(ext) || this.isTextLikeMime(mime)) {
      return 'text';
    }
    return undefined;
  }
  private isHttpUrl(u?: string): u is string {
    return !!u && /^https?:\/\//i.test(u);
  }
  private parseGsUri(
    uri?: string,
  ): { bucket: string; key: string } | undefined {
    if (!uri || !/^gs:\/\//i.test(uri)) return;
    const s = uri.replace(/^gs:\/\//i, '');
    const i = s.indexOf('/');
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
      const parts = u.pathname.replace(/^\/+/, '').split('/');
      if (parts[0]) return decodeURIComponent(parts[0]);
    } catch {}
    return undefined;
  }

  private decodeInlineBuffer(val: any): Buffer | undefined {
    if (!val || typeof val !== 'object') return undefined;

    if (Buffer.isBuffer(val.buffer)) {
      return val.buffer;
    }

    if (
      typeof val.buffer === 'string' &&
      (typeof val.name === 'string' || typeof val.mime === 'string')
    ) {
      try {
        const buffer = Buffer.from(val.buffer, 'base64');
        if (buffer.length > 0) return buffer;
      } catch {}
    }

    return undefined;
  }

  private findFileRef(input: Record<string, any>): FileRef | undefined {
    const walk = (val: any): FileRef | undefined => {
      if (!val) return;

      // A) Buffer from upstream
      if (typeof val === 'object' && val.file?.buffer) {
        return {
          buffer: Buffer.from(val.file.buffer),
          name: val.file.originalname,
          mime:
            typeof val.file?.mimetype === 'string'
              ? val.file.mimetype
              : undefined,
        };
      }

      // A2) Email attachment shape: { name, mime, buffer } where buffer is base64
      const inlineBuffer = this.decodeInlineBuffer(val);
      if (inlineBuffer) {
        return {
          buffer: inlineBuffer,
          name: typeof val.name === 'string' ? val.name : undefined,
          mime: typeof val.mime === 'string' ? val.mime : undefined,
        };
      }

      // B) Prefer {key} (infer bucket from value.bucket, env, or url) over URL
      const consider = (v: FileValue): FileRef | undefined => {
        if (typeof v.key === 'string') {
          const bucket =
            v.bucket ||
            this.bucketFromEnv ||
            (v.url ? this.bucketFromAnyUrl(v.url) : undefined);
          if (bucket) return { bucket, key: v.key, name: v.name, mime: v.mime };
        }
        if (typeof v.url === 'string') {
          return { url: v.url, name: v.name, mime: v.mime };
        }
        return undefined;
      };

      if (
        typeof val === 'object' &&
        val.value &&
        typeof val.value === 'object'
      ) {
        const r = consider(val.value as FileValue);
        if (r) return r;
      }
      if (typeof val === 'object') {
        const r = consider(val as FileValue);
        if (r) return r;
      }

      // C) Direct url anywhere
      if (typeof val?.url === 'string') {
        return {
          url: val.url,
          name: typeof val.name === 'string' ? val.name : undefined,
          mime: typeof val.mime === 'string' ? val.mime : undefined,
        };
      }

      // D) gs:// anywhere
      if (typeof val === 'string') {
        const gs = this.parseGsUri(val);
        if (gs) return gs;
      }
      if (typeof val?.gsUri === 'string') {
        const gs = this.parseGsUri(val.gsUri);
        if (gs) return gs;
      }

      // Recurse
      if (typeof val === 'object') {
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
      responseType: 'arraybuffer',
      timeout: 30_000,
      maxRedirects: 3,
    });
    return Buffer.from(data);
  }

  // use STORAGE_EMULATOR_HOST only for JSON API
  private emulatorMediaUrl(bucket: string, key: string): string {
    const base = (
      process.env.STORAGE_EMULATOR_HOST || 'http://localhost:8000'
    ).replace(/\/$/, '');
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
      const staticUrl = `${(process.env.GCS_PUBLIC_BASE || 'http://localhost:8000').replace(/\/$/, '')}/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`;
      try {
        return await this.readViaHttp(staticUrl);
      } catch {
        // 2) (very rare) older "download" alias
        const base = (
          process.env.STORAGE_EMULATOR_HOST || 'http://localhost:8000'
        ).replace(/\/$/, '');
        const legacy = `${base}/download/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(key)}?alt=media`;
        return await this.readViaHttp(legacy);
      }
    }
  }

  private async readViaGcsSdk(bucket: string, key: string): Promise<Buffer> {
    if (DEBUG)
      console.log(`[ReadExcelDomino] GCS download gs://${bucket}/${key}`);
    const file = this.storage.bucket(bucket).file(key);
    const [buf] = await file.download();
    return buf;
  }

  private async detectZipOfficeKind(
    buffer: Buffer,
  ): Promise<DetectedFileKind | undefined> {
    if (!this.isZipBuffer(buffer)) return undefined;

    const entries = await new Promise<string[]>((resolve, reject) => {
      yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zipfile) => {
        if (error || !zipfile) {
          reject(error);
          return;
        }

        const names: string[] = [];
        zipfile.readEntry();
        zipfile.on('entry', (entry) => {
          names.push(entry.fileName);
          zipfile.readEntry();
        });
        zipfile.on('end', () => resolve(names));
        zipfile.on('error', reject);
      });
    });

    if (entries.some((entry) => entry.startsWith('xl/'))) return 'spreadsheet';
    if (entries.some((entry) => entry.startsWith('word/'))) return 'docx';
    return undefined;
  }

  private async detectFileKind(buffer: Buffer, name?: string, mime?: string) {
    const hintedKind = this.getPreferredKindFromHints(name, mime);
    if (hintedKind === 'pdf' || this.isPdfBuffer(buffer)) return 'pdf';
    if (hintedKind === 'docx') return 'docx';
    if (hintedKind === 'json') return 'json';
    if (hintedKind === 'html') return 'html';
    if (hintedKind === 'xml') return 'xml';
    if (hintedKind === 'text' && !this.isZipBuffer(buffer)) return 'text';
    if (hintedKind === 'spreadsheet') return 'spreadsheet';

    if (this.isZipBuffer(buffer)) {
      const zipKind = await this.detectZipOfficeKind(buffer);
      if (zipKind) return zipKind;
    }

    if (this.isOleCompoundBuffer(buffer)) {
      const ext = this.getFileExtension(name);
      return this.isSpreadsheetExtension(ext) || this.isSpreadsheetMime(mime)
        ? 'spreadsheet'
        : undefined;
    }

    try {
      XLSX.read(buffer, { type: 'buffer' });
      return 'spreadsheet';
    } catch {
      // fall through
    }

    if (this.looksLikeUtf8Text(buffer)) {
      return hintedKind ?? 'text';
    }

    return hintedKind;
  }

  private parseSpreadsheet(buffer: Buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    if (!wb.SheetNames?.length) {
      throw new Error(`[ReadExcelDomino:${this.id}] Workbook has no sheets.`);
    }
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
    });
  }

  private parseDelimitedText(text: string) {
    const normalized = this.normalizeText(text);
    const lines = normalized
      .split('\n')
      .filter((line) => line.trim().length > 0);
    if (lines.length < 2) return undefined;

    const delimiter = lines[0].includes('\t')
      ? '\t'
      : lines[0].includes(',')
        ? ','
        : '';
    if (!delimiter) return undefined;

    const headers = lines[0].split(delimiter).map((value) => value.trim());
    if (!headers.every(Boolean)) return undefined;

    return lines.slice(1).map((line) => {
      const cells = line.split(delimiter);
      return headers.reduce<Record<string, string>>((row, header, index) => {
        row[header] = cells[index]?.trim() ?? '';
        return row;
      }, {});
    });
  }

  private async parseBuffer(
    buffer: Buffer,
    name?: string,
    mime?: string,
  ): Promise<ParsedContent> {
    const kind = await this.detectFileKind(buffer, name, mime);

    if (kind === 'spreadsheet') {
      return { kind, output: this.parseSpreadsheet(buffer) };
    }

    if (kind === 'pdf') {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return { kind, output: this.normalizeText(result.text) };
      } finally {
        await parser.destroy();
      }
    }

    if (kind === 'docx') {
      const result = await mammoth.extractRawText({ buffer });
      return { kind, output: this.normalizeText(result.value) };
    }

    const text = buffer.toString('utf8');
    if (kind === 'json') {
      return { kind, output: JSON.parse(text) };
    }
    if (kind === 'html') {
      return { kind, output: this.stripHtml(text) };
    }
    if (kind === 'xml') {
      return { kind, output: this.normalizeText(text) };
    }

    const delimitedRows = this.parseDelimitedText(text);
    if (delimitedRows) {
      return { kind: 'spreadsheet', output: delimitedRows };
    }

    return { kind: 'text', output: this.normalizeText(text) };
  }

  // ───────── execute
  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();

    const dyn = this.findFileRef((ctx.input as any) ?? {});
    let buffer: Buffer | undefined;
    let sourceName: string | undefined;
    let sourceMime: string | undefined;
    let pathUsed:
      | 'buffer'
      | 'emu-key'
      | 'http-url'
      | 'prod-sdk-key'
      | 'static-http'
      | 'static-emu-key'
      | 'static-prod-sdk-key'
      | 'static-gs'
      | 'none' = 'none';

    try {
      if (dyn && 'buffer' in dyn) {
        buffer = dyn.buffer;
        sourceName = dyn.name;
        sourceMime = dyn.mime;
        pathUsed = 'buffer';
      } else if (dyn && 'bucket' in dyn && 'key' in dyn) {
        const bucket = dyn.bucket;
        sourceName = dyn.name || dyn.key;
        sourceMime = dyn.mime;
        if (this.isEmu) {
          buffer = await this.readViaEmulator(bucket, dyn.key);
          pathUsed = 'emu-key';
        } else {
          buffer = await this.readViaGcsSdk(bucket, dyn.key);
          pathUsed = 'prod-sdk-key';
        }
      } else if (dyn && 'url' in dyn) {
        buffer = await this.readViaHttp(dyn.url);
        sourceName = dyn.name || dyn.url;
        sourceMime = dyn.mime;
        pathUsed = 'http-url';
      } else {
        // statics
        if (this.isHttpUrl(this.staticUrl)) {
          buffer = await this.readViaHttp(this.staticUrl!);
          sourceName = this.staticUrl;
          pathUsed = 'static-http';
        } else if (this.staticUrl) {
          const gs = this.parseGsUri(this.staticUrl);
          if (!gs)
            throw new Error(
              `[ReadExcelDomino:${this.id}] Invalid gs:// URL: ${this.staticUrl}`,
            );
          if (this.isEmu) {
            buffer = await this.readViaEmulator(gs.bucket, gs.key);
            pathUsed = 'static-emu-key';
          } else {
            buffer = await this.readViaGcsSdk(gs.bucket, gs.key);
            pathUsed = 'static-gs';
          }
          sourceName = gs.key;
        } else if (this.staticKey) {
          const bucket =
            this.staticBucket ||
            this.bucketFromEnv ||
            (this.staticUrl
              ? this.bucketFromAnyUrl(this.staticUrl)
              : undefined);
          if (!bucket) {
            throw new Error(
              `[ReadExcelDomino:${this.id}] No bucket for key=${this.staticKey}. Set GCS_BUCKET, include bucket in value, or provide a URL.`,
            );
          }
          if (this.isEmu) {
            buffer = await this.readViaEmulator(bucket, this.staticKey);
            pathUsed = 'static-emu-key';
          } else {
            buffer = await this.readViaGcsSdk(bucket, this.staticKey);
            pathUsed = 'static-prod-sdk-key';
          }
          sourceName = this.staticKey;
        }
      }

      if (!buffer) {
        throw new Error(
          `[ReadExcelDomino:${this.id}] No supported file supplied (dynamic or static).`,
        );
      }

      if (DEBUG)
        console.log(
          `[ReadExcelDomino] path=${pathUsed}, buffer.length=${buffer.length}`,
        );

      const parsed = await this.parseBuffer(buffer, sourceName, sourceMime);

      if (DEBUG) {
        console.log(
          `[ReadExcelDomino] kind=${parsed.kind}, size=${
            Array.isArray(parsed.output)
              ? parsed.output.length
              : typeof parsed.output
          }`,
        );
      }

      return {
        id: this.id,
        output: parsed.output,
        startedAt,
        finishedAt: Date.now(),
      };
    } catch (err) {
      console.error(`[ReadExcelDomino] failed:`, err);
      throw err;
    }
  }
}
