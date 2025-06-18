import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import axios from 'axios';
import * as XLSX from 'xlsx'; // If using excel parsing
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";

export class ReadExcelDomino implements DominoExecutable {
    id: string;
    fileUrl?: string;
    type: string;


    constructor(node: PipelineStep) {
        this.id = node.id;

        this.fileUrl = node?.data?.File?.url;
    }

    async execute(ctx: ExecuteContext): Promise<DominoResult> {
        const startedAt = Date.now();
        let fileUrl = this.fileUrl;
        let fileBuffer: Buffer;

        // 1️⃣ If dynamic input → use it
        if (ctx?.input?.value && ctx?.input?.value?.url) {
            // Enforce type check for Excel
            if (!ctx.input.value.url.match(/\.(xls|xlsx)$/i)) {
                throw new Error(`[ReadExcelDomino:${this.id}] Invalid file type. Only Excel files allowed.`);
            }
            fileUrl = ctx.input.value.url;
        }

        if (!fileUrl) {
            throw new Error(`[ReadExcelDomino:${this.id}] No file URL provided.`);
        }

        // Download file
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        fileBuffer = Buffer.from(response.data);

        // (Optional) Parse Excel here, or return raw content
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
        console.log(sheetData)
        return {
            id: this.id,
            output: { fileContent: sheetData },
            startedAt,
            finishedAt: Date.now(),
        };
    }
}
