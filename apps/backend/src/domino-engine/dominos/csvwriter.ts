import { PipelineStep } from "../../types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import { v4 as uuidv4 } from 'uuid';
import { CreateAssetDto } from '../../gcs/gcs.dto';
import { getGcsService } from '../../gcs/gcs-factory';
import * as path from 'path';
import * as fs from 'fs';

export class CsvWriterDomino implements DominoExecutable {
  id: string;
  type = "csvwriter" as const;

  private name: string;
  private fileName: string;
  private includeHeader: boolean;
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
    this.includeHeader = this.getFieldValue('Include Header', true);
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

  private parseTextInput(textInput: string, delimiter: string): any[] {
    if (!textInput.trim()) return [];
    
    const lines = textInput.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim());
    return lines.map(line => {
      const values = line.split(delimiter).map(val => val.trim());
      // If it's a single column, return the value directly
      if (values.length === 1) {
        return values[0];
      }
      // Multiple columns - create an object with column1, column2, etc.
      const obj: any = {};
      values.forEach((val, index) => {
        obj[`column${index + 1}`] = val;
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

  private generateCSVFromArray(data: any[], delimiter: string, includeHeader: boolean): { content: string, rowCount: number } {
    if (!data.length) return { content: '', rowCount: 0 };

    let csvContent = '';
    let rowCount = 0;
    
    const firstItem = data[0];
    
    if (typeof firstItem === 'object' && firstItem !== null) {
      // Array of objects
      const headers = Object.keys(firstItem);
      
      if (includeHeader) {
        csvContent += headers.map(header => this.escapeCSVValue(header, delimiter)).join(delimiter) + '\n';
      }
      
      for (const item of data) {
        const row = headers.map(header => this.escapeCSVValue(item[header], delimiter));
        csvContent += row.join(delimiter) + '\n';
        rowCount++;
      }
    } else {
      // Array of primitives
      if (includeHeader) {
        csvContent += 'value\n';
      }
      
      for (const item of data) {
        csvContent += this.escapeCSVValue(item, delimiter) + '\n';
        rowCount++;
      }
    }
    
    return { content: csvContent, rowCount };
  }

  private generateCSVFromSingleValue(data: any, delimiter: string, includeHeader: boolean): { content: string, rowCount: number } {
    let csvContent = '';
    let rowCount = 0;
    
    if (typeof data === 'object' && data !== null) {
      // Single object
      const headers = Object.keys(data);
      
      if (includeHeader) {
        csvContent += headers.map(header => this.escapeCSVValue(header, delimiter)).join(delimiter) + '\n';
      }
      
      const row = headers.map(header => this.escapeCSVValue(data[header], delimiter));
      csvContent += row.join(delimiter) + '\n';
      rowCount = 1;
    } else {
      // Single primitive
      if (includeHeader) {
        csvContent += 'value\n';
      }
      
      csvContent += this.escapeCSVValue(data, delimiter) + '\n';
      rowCount = 1;
    }
    
    return { content: csvContent, rowCount };
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    
    // Accept dynamic parameters from input pins if provided
    const name = ctx.input.Name ?? this.name;
    const fileName = ctx.input['File Name'] ?? this.fileName;
    const includeHeader = ctx.input['Include Header'] ?? this.includeHeader;
    const delimiter = this.sanitizeDelimiter(ctx.input.Delimiter ?? this.delimiter);
    const inputType = ctx.input['Input Type'] ?? this.inputType;
    const inputData = ctx.input['Input Box'] ?? this.textInput;

    let csvContent = '';
    let rowCount = 0;
    let dataSource = '';

    try {
      if (inputType === 'text' && inputData.trim()) {
        // Use text input from the Input Box
        const parsedData = this.parseTextInput(inputData, delimiter);
        const result = this.generateCSVFromArray(parsedData, delimiter, includeHeader);
        csvContent = result.content;
        rowCount = result.rowCount;
        dataSource = 'text input';
      } else if (inputType === 'json') {
        // Use JSON data from connected input
        console.log(ctx)
        console.log(inputData)
        if (Array.isArray(inputData) && inputData.length > 0) {
          const result = this.generateCSVFromArray(inputData, delimiter, includeHeader);
          csvContent = result.content;
          rowCount = result.rowCount;
          dataSource = 'json array input';
        } else if (inputData !== undefined && inputData !== null) {
          const result = this.generateCSVFromSingleValue(inputData, delimiter, includeHeader);
          csvContent = result.content;
          rowCount = result.rowCount;
          dataSource = 'json single input';
        } else {
          throw new Error('No input data provided for JSON mode');
        }
      } else {
        throw new Error('No valid input data found');
      }

      // Ensure we have a valid filename with .csv extension
      let finalFileName = fileName;
      if (!finalFileName.endsWith('.csv')) {
        finalFileName += '.csv';
      }

      console.log(finalFileName)
      // Try to get GCS service from singleton factory
      let gcsService: any = null;
      try {
        gcsService = getGcsService();
      } catch (error) {
        console.warn('[CsvWriter] GCS service not available, falling back to local filesystem');
      }
      
      // If GCS service is available, upload to GCS
      if (gcsService && csvContent.length > 0) {
        console.log('service found')
        try {
          // Generate unique key for GCS
          const key = `csv-exports/${uuidv4()}-${finalFileName}`;
          const buffer = Buffer.from(csvContent, 'utf8');
          
          // Upload to GCS
          const uploadResult = await gcsService.upload(key, buffer, 'text/csv');
          console.log(uploadResult)
          const gcsUrl = await gcsService.getReadUrl(key);

          console.log(`[CsvWriter] Uploaded CSV to GCS at ${gcsUrl}`);
          // Create asset record in database
          const createAssetDto: CreateAssetDto = {
            fileName: finalFileName,
            originalName: finalFileName,
            key,
            bucketName: process.env.GCS_BUCKET || 'dominofy-local',
            contentType: 'text/csv',
            size: csvContent.length,
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
              rowCount,
              generatedBy: 'csvWriter',
              generatedAt: new Date().toISOString(),
            },
          };

          const asset = await gcsService.createAsset(createAssetDto);

          return {
            id: this.id,
            output: {
              fileName: finalFileName,
              key,
              gcsUrl,
              assetId: asset.id,
              rowCount,
              size: csvContent.length,
              dataSource,
              inputType,
              success: true,
              uploadedToGcs: true
            },
            startedAt,
            finishedAt: Date.now(),
          };
        } catch (gcsError) {
          console.error(`[CsvWriter] GCS upload failed: ${gcsError.message}`);
          // Fall back to local file system if GCS fails
        }
      }

      // Fallback: write to local filesystem
      const outputDir = path.dirname(finalFileName);
      if (outputDir !== '.' && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(finalFileName, csvContent, 'utf8');

      return {
        id: this.id,
        output: {
          fileName: finalFileName,
          rowCount,
          size: csvContent.length,
          dataSource,
          inputType,
          success: true,
          uploadedToGcs: false
        },
        startedAt,
        finishedAt: Date.now(),
      };
    } catch (error) {
      throw new Error(`CSV Writer (${name}): ${error.message}`);
    }
  }
}
