import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import * as fs from 'fs';
import * as path from 'path';

export class CsvWriterDomino implements DominoExecutable {
  id: string;
  type = "csvwriter" as const;

  private filename: string;
  private delimiter: string;
  private includeHeaders: boolean;

  constructor(private node: PipelineStep) {
    this.id = node.id;
    this.filename = node.data?.Filename?.value ?? "output.csv";
    this.delimiter = node.data?.Delimiter?.value ?? ",";
    this.includeHeaders = node.data?.IncludeHeaders?.value ?? true;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    
    // Accept dynamic parameters from input pins if provided
    const filename = ctx.input.Filename ?? this.filename;
    const delimiter = ctx.input.Delimiter ?? this.delimiter;
    const includeHeaders = ctx.input.IncludeHeaders ?? this.includeHeaders;
    const input = ctx.input.Input;

    let csvContent = "";
    let rowCount = 0;

    if (Array.isArray(input) && input.length > 0) {
      // Handle array of objects
      const firstItem = input[0];
      
      if (typeof firstItem === 'object' && firstItem !== null) {
        // Extract headers from the first object
        const headers = Object.keys(firstItem);
        
        // Add headers if requested
        if (includeHeaders) {
          csvContent += headers.join(delimiter) + '\n';
        }
        
        // Add data rows
        for (const item of input) {
          const row = headers.map(header => {
            const value = item[header];
            // Escape values that contain the delimiter or quotes
            if (typeof value === 'string' && (value.includes(delimiter) || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? '';
          });
          csvContent += row.join(delimiter) + '\n';
          rowCount++;
        }
      } else {
        // Handle array of primitives
        if (includeHeaders) {
          csvContent += 'value\n';
        }
        for (const item of input) {
          const value = typeof item === 'string' && (item.includes(delimiter) || item.includes('"') || item.includes('\n'))
            ? `"${item.replace(/"/g, '""')}"`
            : item;
          csvContent += value + '\n';
          rowCount++;
        }
      }
    } else if (input !== undefined && input !== null) {
      // Handle single object or primitive
      if (typeof input === 'object') {
        const headers = Object.keys(input);
        if (includeHeaders) {
          csvContent += headers.join(delimiter) + '\n';
        }
        const row = headers.map(header => {
          const value = input[header];
          if (typeof value === 'string' && (value.includes(delimiter) || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        });
        csvContent += row.join(delimiter) + '\n';
        rowCount = 1;
      } else {
        // Single primitive value
        if (includeHeaders) {
          csvContent += 'value\n';
        }
        const value = typeof input === 'string' && (input.includes(delimiter) || input.includes('"') || input.includes('\n'))
          ? `"${input.replace(/"/g, '""')}"`
          : input;
        csvContent += value + '\n';
        rowCount = 1;
      }
    }

    // Ensure output directory exists
    const outputDir = path.dirname(filename);
    if (outputDir !== '.' && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write CSV content to file
    fs.writeFileSync(filename, csvContent, 'utf8');

    return {
      id: this.id,
      output: {
        filename,
        rowCount,
        size: csvContent.length,
        success: true
      },
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
