import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import { DriveService } from "../../drive/drive.service";

export class GoogleDriveDownloadDomino implements DominoExecutable {
  id: string;
  type = "googleDriveDownload" as const;

  private literalConnect: string;
  private literalFullPath: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalConnect = node.data?.Connect?.value ?? "";
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
    const rawFullPath =
      input["Full Path"] ??
      input.fullPath ??
      input.path ??
      this.literalFullPath;

    const vaultId = typeof rawConnect === "string" ? rawConnect : String(rawConnect ?? "");
    if (!vaultId) throw new Error("GoogleDriveDownload: vaultId is required");
    if (!rawFullPath) throw new Error("GoogleDriveDownload: fullPath is required");

    const result = await DriveService.instance.downloadFileFromDrive(
      vaultId,
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
