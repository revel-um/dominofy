import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import axios from "axios";
import * as XLSX from "xlsx";
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";

export class ReadExcelDomino implements DominoExecutable {
  id: string;
  private staticFileUrl?: string;
  type = "readexcel" as const;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.staticFileUrl = node?.data?.File?.url;
  }

  /** ─────────────────────────────────────────────────────────
   *  Scan ctx.input for either:
   *    • { File: { file: { buffer, originalname } } }   ← NEW
   *    • { url: "…xls/xlsx" }
   *  Returns { buffer }  or  { url }  or  undefined.
   *  ────────────────────────────────────────────────────────*/
  private extractDynamicFile(
    input: Record<string, any>
  ): { buffer: Buffer; name: string } | { url: string } | undefined {
    const walk = (val: any): any => {
      if (!val || typeof val !== "object") return undefined;

      // Case A: Buffered file object
      if (
        val.file?.buffer &&
        val.file?.originalname &&
        /\.(xls|xlsx)$/i.test(val.file.originalname)
      ) {
        return { buffer: Buffer.from(val.file.buffer), name: val.file.originalname };
      }

      // Case B: Direct url property
      if (typeof val.url === "string" && /\.(xls|xlsx)$/i.test(val.url)) {
        return { url: val.url };
      }

      // Recurse into nested values
      for (const nested of Object.values(val)) {
        const found = walk(nested);
        if (found) return found;
      }
      return undefined;
    };

    return walk(input);
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();

    // 1️⃣  Find dynamic file (buffer OR url)
    const dynamic = this.extractDynamicFile(ctx.input ?? {});
    let buffer: Buffer | undefined;

    if (dynamic && "buffer" in dynamic) {
      // a) Got buffer directly ✔
      buffer = dynamic.buffer;
    } else {
      // b) Need a URL (dynamic url → static url)
      const fileUrl = dynamic && "url" in dynamic ? dynamic.url : this.staticFileUrl;
      if (!fileUrl) {
        throw new Error(
          `[ReadExcelDomino:${this.id}] No Excel file supplied (dynamic or static).`
        );
      }

      const { data } = await axios.get<ArrayBuffer>(fileUrl, { responseType: "arraybuffer" });
      buffer = Buffer.from(data);
    }

    // 2️⃣  Parse first worksheet
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    const sheetJSON = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

    // 3️⃣  Return result
    return {
      id: this.id,
      output: { fileContent: sheetJSON },
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
