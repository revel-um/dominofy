import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import { DriveService } from "../../drive/drive.service";

export class GoogleDriveDomino implements DominoExecutable {
  id: string;
  type = "googleDrive" as const;

  private literalConnect: string;
  private literalFile: any;
  private literalFullPath: string;
  private literalAction: string;
  private literalBulkAction: string;
  private literalTargets: any;
  private literalTags: any;
  private literalDestinationPath: string;
  private literalRenameTemplate: string;
  private literalAccessRole: string;
  private literalAccessType: string;
  private literalAccessEmail: string;
  private literalAccessDomain: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalConnect = node.data?.Connect?.value ?? "";
    this.literalFile = node.data?.["File Upload"]?.value ?? null;
    this.literalFullPath = node.data?.["Full Path"]?.value ?? "";
    this.literalAction = node.data?.Action?.value ?? "upload";
    this.literalBulkAction = node.data?.["Bulk Action"]?.value ?? "";
    this.literalTargets = node.data?.Targets?.value ?? null;
    this.literalTags = node.data?.Tags?.value ?? null;
    this.literalDestinationPath = node.data?.["Destination Path"]?.value ?? "";
    this.literalRenameTemplate = node.data?.["Rename Template"]?.value ?? "";
    this.literalAccessRole = node.data?.["Access Role"]?.value ?? "";
    this.literalAccessType = node.data?.["Access Type"]?.value ?? "";
    this.literalAccessEmail = node.data?.["Access Email"]?.value ?? "";
    this.literalAccessDomain = node.data?.["Access Domain"]?.value ?? "";
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const input = (ctx.input ?? {}) as any;

    const rawConnect =
      input.Connect ??
      input.connect ??
      input.vaultId ??
      this.literalConnect;
    const rawAction =
      input.Action ??
      input.action ??
      input.mode ??
      this.literalAction ??
      "upload";

    const vaultId = typeof rawConnect === "string" ? rawConnect : String(rawConnect ?? "");
    if (!vaultId) throw new Error("GoogleDrive: vaultId is required");

    const actionValue = String(rawAction ?? "").toLowerCase();
    const isBulk =
      actionValue === "bulk" ||
      actionValue === "bulk_action" ||
      actionValue === "bulk action" ||
      actionValue === "batch";

    let result: any;

    if (!isBulk) {
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
      if (!rawFile) throw new Error("GoogleDrive: file is required");
      if (!rawFullPath) throw new Error("GoogleDrive: fullPath is required");

      result = await DriveService.instance.uploadFileToDrive(
        vaultId,
        rawFile,
        String(rawFullPath),
      );
    } else {
      const rawBulkAction =
        input["Bulk Action"] ??
        input.bulkAction ??
        input.bulk ??
        this.literalBulkAction;
      const rawTargets =
        input.Targets ??
        input.targets ??
        input.paths ??
        this.literalTargets;
      const rawTags = input.Tags ?? input.tags ?? this.literalTags;
      const rawDestinationPath =
        input["Destination Path"] ??
        input.destinationPath ??
        input.destination ??
        this.literalDestinationPath;
      const rawRenameTemplate =
        input["Rename Template"] ??
        input.renameTemplate ??
        input.rename ??
        this.literalRenameTemplate;
      const rawAccessRole =
        input["Access Role"] ??
        input.accessRole ??
        input.role ??
        this.literalAccessRole;
      const rawAccessType =
        input["Access Type"] ??
        input.accessType ??
        input.type ??
        this.literalAccessType;
      const rawAccessEmail =
        input["Access Email"] ??
        input.accessEmail ??
        input.email ??
        this.literalAccessEmail;
      const rawAccessDomain =
        input["Access Domain"] ??
        input.accessDomain ??
        input.domain ??
        this.literalAccessDomain;

      const accessConfig =
        rawAccessRole || rawAccessType || rawAccessEmail || rawAccessDomain
          ? {
              role: String(rawAccessRole ?? ""),
              type: String(rawAccessType ?? ""),
              email: rawAccessEmail ? String(rawAccessEmail) : undefined,
              domain: rawAccessDomain ? String(rawAccessDomain) : undefined,
            }
          : undefined;

      result = await DriveService.instance.bulkApplyDriveAction(
        vaultId,
        rawBulkAction,
        rawTargets,
        {
          tags: rawTags,
          destinationPath: rawDestinationPath ? String(rawDestinationPath) : undefined,
          renameTemplate: rawRenameTemplate ? String(rawRenameTemplate) : undefined,
          access: accessConfig,
        },
      );
    }

    return {
      id: this.id,
      output: result,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
