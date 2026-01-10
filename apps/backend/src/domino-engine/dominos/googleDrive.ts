import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import { DriveService } from "../../drive/drive.service";

export class GoogleDriveDomino implements DominoExecutable {
  id: string;
  type = "googleDrive" as const;

  private literalConnect: string;
  private literalFile: any;
  private literalFullPath: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalConnect = node.data?.Connect?.value ?? "";
    this.literalFile = node.data?.["File Upload"]?.value ?? null;
    this.literalFullPath = node.data?.["Full Path"]?.value ?? "";
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const input = (ctx.input ?? {}) as any;

    const rawConnect =
      input.Connect ??
      input.connect ??
      input.vaultId ??
      this.literalConnect;
    const rawFile =
      input["File Upload"] ??
      input.file ??
      input.fileUpload ??
      this.literalFile;
    const rawFullPath =
      input["Full Path"] ??
      input.fullPath ??
      input.path ??
      this.literalFullPath;

    const vaultId = typeof rawConnect === "string" ? rawConnect : String(rawConnect ?? "");
    if (!vaultId) throw new Error("GoogleDrive: vaultId is required");
    if (!rawFile) throw new Error("GoogleDrive: file is required");
    if (!rawFullPath) throw new Error("GoogleDrive: fullPath is required");

    const result = await DriveService.instance.uploadFileToDrive(
      vaultId,
      rawFile,
      String(rawFullPath),
    );

    return {
      id: this.id,
      output: result,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
