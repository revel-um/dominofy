import { PipelineStep } from "../types/pipelineStepType";

export function isWorkflowBlocking(
  workflow: PipelineStep[],
  RANGE_THRESHOLD = 1_000_00
): boolean {
  console.log(workflow);
  for (const step of workflow) {
    // ─── Iterator check ───
    if (step.type === "iterator") {
      const data = (step as any).data ?? {};
      const startVal = data["Range Start"]?.value;
      const endVal = data["Range End"]?.value;
      const maxVal = data["Max"]?.value;

      const start = Number(startVal ?? 0);
      const end = Number(endVal ?? 0);
      const isMax = Boolean(maxVal);

      if (!isMax && end > start) {
        const range = end - start;
        if (range > RANGE_THRESHOLD) {
          return true;
        }
      }
    }

    // ─── Read Excel file size check ───
    if (step.type === "Read Excel") {
      const details = (step as any).data?.details;
      const fields = details?.fields as any[];
      if (Array.isArray(fields)) {
        const fileField = fields.find(
          (f) => f.heading === "File" && f.file?.size != null
        );
        if (fileField) {
          const size = Number(fileField.file.size);
          // 5 MB threshold
          if (size > 5 * 1024 * 1024) {
            return true;
          }
        }
      }
    }
  }

  return false;
}
