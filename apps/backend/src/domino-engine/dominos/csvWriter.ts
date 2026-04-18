import { PipelineStep } from "../../types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import { CreateAssetDto } from '../../gcs/gcs.dto';
import { getGcsService } from '../../gcs/gcs-factory';

const CSV_BATCH_ROW_THRESHOLD = 5000;
const CSV_BATCH_SIZE = 1000;

type CSVBuildResult = {
  chunks: string[];
  rowCount: number;
  batchProcessed: boolean;
};

export class CsvWriterDomino implements DominoExecutable {
  id: string;
  type = "csvwriter" as const;

  private name: string;
  private fileName: string;
  private writeMode: 'append' | 'replace';
  private includeHeader: boolean;
  private considerFirstLineAsHeader: boolean;
  private delimiter: string;
  private inputType: 'json' | 'text';
  private textInput: string;
  private workflowId: string | undefined;

  constructor(private node: PipelineStep) {
    this.id = node.id;
    
    // Extract workflow ID from node data
    this.workflowId = this.node.data?.workflowId;
    
    // Map frontend field names to backend properties
    this.name = this.getFieldValue('Name', 'CSV Writer');
    this.fileName = this.getFieldValue('File Name', 'output.csv');
    this.writeMode = this.getFieldValue('Write Mode', 'replace') as 'append' | 'replace';
    this.includeHeader = this.getFieldValue('Include Header', true);
    this.considerFirstLineAsHeader = this.getFieldValue('Consider First Line As Header', false);
    this.delimiter = this.sanitizeDelimiter(this.getFieldValue('Delimiter', ','));
    this.inputType = this.getFieldValue('Input Type', 'json') as 'json' | 'text';
    this.textInput = this.getFieldValue('Input Box', '');
  }

  private getFieldValue(fieldName: string, defaultValue: any): any {
    const field = this.node.data?.details?.fields?.find((f: any) => f.heading === fieldName);
    return field?.value ?? defaultValue;
  }

  private sanitizeDelimiter(delimiter: string): string {
    return delimiter === '\\t' ? '\t' : delimiter;
  }

  private ensureCsvExtension(rawPath: string): string {
    const trimmed = String(rawPath || '').trim();
    const normalized = trimmed || 'output.csv';
    return normalized.toLowerCase().endsWith('.csv') ? normalized : `${normalized}.csv`;
  }

  private buildStorageKey(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    return `csv-exports/${normalizedPath}`;
  }

  private countApproximateRows(csvContent: string, includeHeader: boolean): number {
    const lines = csvContent
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return 0;
    }

    return Math.max(lines.length - (includeHeader ? 1 : 0), 0);
  }

  private joinCsvContent(existingContent: string, nextContent: string): string {
    if (!existingContent) return nextContent;
    if (!nextContent) return existingContent;
    return `${existingContent.replace(/\s+$/, '')}\n${nextContent.replace(/^\s+/, '')}`;
  }

  private parseTextInput(textInput: string, delimiter: string, considerFirstLineAsHeader: boolean = false): any[] {
    if (!textInput.trim()) return [];
    
    const lines = textInput.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    let headers: string[] = [];
    let dataLines = lines;
    
    // If considering first line as header, extract it
    if (considerFirstLineAsHeader && lines.length > 0) {
      const headerLine = lines[0];
      headers = headerLine.split(delimiter).map(h => h.trim());
      dataLines = lines.slice(1); // Skip the header line for data processing
    }
    
    return dataLines.map(line => {
      const values = line.split(delimiter).map(val => val.trim());
      
      // If it's a single column, return the value directly
      if (values.length === 1) {
        return values[0];
      }
      
      // Multiple columns - create an object
      const obj: any = {};
      values.forEach((val, index) => {
        // Use custom header if available, otherwise use columnN format
        const key = headers[index] || `column${index + 1}`;
        obj[key] = val;
      });
      return obj;
    });
  }

  private escapeCSVValue(value: any, delimiter: string): string {
    const stringValue = String(value ?? '');
    
    // If the value contains the delimiter, newlines, or quotes, wrap in quotes and escape internal quotes
    if (stringValue.includes(delimiter) || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  private buildCSVFromArray(data: any[], delimiter: string, includeHeader: boolean): CSVBuildResult {
    if (!data.length) return { chunks: [], rowCount: 0, batchProcessed: false };

    const firstItem = data[0];
    const chunks: string[] = [];
    const batchProcessed = data.length > CSV_BATCH_ROW_THRESHOLD;
    let rowCount = 0;

    if (typeof firstItem === 'object' && firstItem !== null) {
      const headers = Object.keys(firstItem);

      if (includeHeader) {
        chunks.push(headers.map(header => this.escapeCSVValue(header, delimiter)).join(delimiter) + '\n');
      }

      if (!batchProcessed) {
        let csvContent = '';
        for (const item of data) {
          const row = headers.map(header => this.escapeCSVValue(item[header], delimiter));
          csvContent += row.join(delimiter) + '\n';
          rowCount++;
        }
        if (csvContent) chunks.push(csvContent);
        return { chunks, rowCount, batchProcessed };
      }

      for (let index = 0; index < data.length; index += CSV_BATCH_SIZE) {
        const batch = data.slice(index, index + CSV_BATCH_SIZE);
        let batchContent = '';
        for (const item of batch) {
          const row = headers.map(header => this.escapeCSVValue(item[header], delimiter));
          batchContent += row.join(delimiter) + '\n';
          rowCount++;
        }
        if (batchContent) chunks.push(batchContent);
      }

      return { chunks, rowCount, batchProcessed };
    }

    if (includeHeader) {
      chunks.push('value\n');
    }

    if (!batchProcessed) {
      let csvContent = '';
      for (const item of data) {
        csvContent += this.escapeCSVValue(item, delimiter) + '\n';
        rowCount++;
      }
      if (csvContent) chunks.push(csvContent);
      return { chunks, rowCount, batchProcessed };
    }

    for (let index = 0; index < data.length; index += CSV_BATCH_SIZE) {
      const batch = data.slice(index, index + CSV_BATCH_SIZE);
      let batchContent = '';
      for (const item of batch) {
        batchContent += this.escapeCSVValue(item, delimiter) + '\n';
        rowCount++;
      }
      if (batchContent) chunks.push(batchContent);
    }

    return { chunks, rowCount, batchProcessed };
  }

  private buildCSVFromSingleValue(data: any, delimiter: string, includeHeader: boolean): CSVBuildResult {
    let csvContent = '';
    let rowCount = 0;

    if (typeof data === 'object' && data !== null) {
      const headers = Object.keys(data);

      if (includeHeader) {
        csvContent += headers.map(header => this.escapeCSVValue(header, delimiter)).join(delimiter) + '\n';
      }

      const row = headers.map(header => this.escapeCSVValue(data[header], delimiter));
      csvContent += row.join(delimiter) + '\n';
      rowCount = 1;
    } else {
      if (includeHeader) {
        csvContent += 'value\n';
      }

      csvContent += this.escapeCSVValue(data, delimiter) + '\n';
      rowCount = 1;
    }

    return { chunks: csvContent ? [csvContent] : [], rowCount, batchProcessed: false };
  }

  private joinCSVChunks(chunks: string[]): string {
    return chunks.join('');
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    
    // Accept dynamic parameters from input pins if provided
    const name = ctx.input.Name ?? this.name;
    const fileName = ctx.input['File Name'] ?? this.fileName;
    const writeMode = (ctx.input['Write Mode'] ?? this.writeMode) as 'append' | 'replace';
    const includeHeader = ctx.input['Include Header'] ?? this.includeHeader;
    const considerFirstLineAsHeader = ctx.input['Consider First Line As Header'] ?? this.considerFirstLineAsHeader;
    const delimiter = this.sanitizeDelimiter(ctx.input.Delimiter ?? this.delimiter);
    const inputType = ctx.input['Input Type'] ?? this.inputType;
    const inputData = ctx.input['Input Box'] ?? this.textInput;

    let rowCount = 0;
    let dataSource = '';
    let csvChunks: string[] = [];
    let batchProcessed = false;

    try {
      if (inputType === 'text' && inputData.trim()) {
        // Use text input from the Input Box
        const parsedData = this.parseTextInput(inputData, delimiter, considerFirstLineAsHeader);
        const result = this.buildCSVFromArray(parsedData, delimiter, includeHeader);
        csvChunks = result.chunks;
        rowCount = result.rowCount;
        batchProcessed = result.batchProcessed;
        dataSource = 'text input';
      } else if (inputType === 'json') {
        // Use JSON data from connected input
        if (Array.isArray(inputData) && inputData.length > 0) {
          const result = this.buildCSVFromArray(inputData, delimiter, includeHeader);
          csvChunks = result.chunks;
          rowCount = result.rowCount;
          batchProcessed = result.batchProcessed;
          dataSource = 'json array input';
        } else if (inputData !== undefined && inputData !== null) {
          const result = this.buildCSVFromSingleValue(inputData, delimiter, includeHeader);
          csvChunks = result.chunks;
          rowCount = result.rowCount;
          batchProcessed = result.batchProcessed;
          dataSource = 'json single input';
        } else {
          throw new Error('No input data provided for JSON mode');
        }
      } else {
        throw new Error('No valid input data found');
      }

      // Ensure we have a valid filename with .csv extension
      const finalFileName = this.ensureCsvExtension(fileName);
      const storageKey = this.buildStorageKey(finalFileName);

      let gcsService: any;
      try {
        gcsService = getGcsService();
      } catch {
        throw new Error('Cloud storage is not available for CSV Writer');
      }
      try {
        let existingContent = '';
        let existingRowCount = 0;
        const existingAsset = await gcsService.findAssetByKey(storageKey).catch(() => null);

        if (writeMode === 'append') {
          const existingDownload = await gcsService.download(storageKey).catch(() => null);
          if (existingDownload?.buffer) {
            existingContent = existingDownload.buffer.toString('utf8');
          }
          existingRowCount = Number(existingAsset?.metadata?.rowCount ?? 0);
        }

        const shouldIncludeHeader = writeMode === 'append'
          ? !existingContent.trim() && includeHeader
          : includeHeader;

        if (shouldIncludeHeader !== includeHeader) {
          if (inputType === 'text' && inputData.trim()) {
            const parsedData = this.parseTextInput(inputData, delimiter, considerFirstLineAsHeader);
            const regenerated = this.buildCSVFromArray(parsedData, delimiter, shouldIncludeHeader);
            csvChunks = regenerated.chunks;
            rowCount = regenerated.rowCount;
            batchProcessed = regenerated.batchProcessed;
          } else if (inputType === 'json') {
            if (Array.isArray(inputData) && inputData.length > 0) {
              const regenerated = this.buildCSVFromArray(inputData, delimiter, shouldIncludeHeader);
              csvChunks = regenerated.chunks;
              rowCount = regenerated.rowCount;
              batchProcessed = regenerated.batchProcessed;
            } else if (inputData !== undefined && inputData !== null) {
              const regenerated = this.buildCSVFromSingleValue(inputData, delimiter, shouldIncludeHeader);
              csvChunks = regenerated.chunks;
              rowCount = regenerated.rowCount;
              batchProcessed = regenerated.batchProcessed;
            }
          }
        }

        const nextCsvContent = this.joinCSVChunks(csvChunks);
        const mergedCsvContent =
          writeMode === 'append'
            ? this.joinCsvContent(existingContent, nextCsvContent)
            : nextCsvContent;
        const finalRowCount =
          writeMode === 'append'
            ? existingRowCount + rowCount
            : rowCount;
        const hasData = finalRowCount > 0;
        const buffer = Buffer.from(mergedCsvContent, 'utf8');

        const uploadResult = await gcsService.upload(storageKey, buffer, 'text/csv');
        const gcsUrl = await gcsService.getReadUrl(storageKey);

        const createAssetDto: CreateAssetDto = {
          fileName: finalFileName,
          originalName: finalFileName,
          key: storageKey,
          bucketName: process.env.GCS_BUCKET || 'dominofy-local',
          contentType: 'text/csv',
          size: buffer.length,
          etag: uploadResult.etag,
          md5Hash: uploadResult.md5Hash,
          gcsUrl,
          publicUrl: gcsUrl,
          systemUpload: true,
          workflowId: this.workflowId,
          description: `CSV export generated by ${name}`,
          isPublic: false,
          metadata: {
            dataSource,
            inputType,
            rowCount: finalRowCount,
            generatedBy: 'csvWriter',
            generatedAt: new Date().toISOString(),
            writeMode,
            fileName: finalFileName,
            batchProcessed,
            batchThreshold: CSV_BATCH_ROW_THRESHOLD,
          },
        };

        const asset = await gcsService.createAsset(createAssetDto).catch(() => null);

        return {
          id: this.id,
          output: {
            value_out: gcsUrl,
            fileName: finalFileName,
            filePath: finalFileName,
            key: storageKey,
            downloadUrl: gcsUrl,
            gcsUrl,
            assetId: asset?.id,
            rowCount: finalRowCount,
            size: buffer.length,
            dataSource,
            inputType,
            writeMode,
            batchProcessed,
            hasData,
            success: true,
            uploadedToGcs: true
          },
          isMultiOutPinDomino: true,
          startedAt,
          finishedAt: Date.now(),
        };
      } catch (gcsError) {
        console.error(`[CsvWriter] GCS upload failed: ${gcsError.message}`);
        throw new Error(`Cloud storage upload failed: ${gcsError.message}`);
      }
    } catch (error) {
      throw new Error(`CSV Writer (${name}): ${error.message}`);
    }
  }
}
