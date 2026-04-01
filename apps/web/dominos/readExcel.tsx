import { NodeProps, useEdges } from "reactflow";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  FileSpreadsheet,
  FileText,
  FolderOpen,
  LoaderCircle,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";

import DominoPin from "../components/shared/dominoPin";
import { PinType } from "../types/pinTypes";
import { useDomino } from "../contexts/dominoContext";
import { DominoNodeData } from "../types/dominoFieldTypes";
import { FilesApi } from "../apis/files.apis";
import { useRouter } from "next/router";
import dominoCatalog from "./dominos";

type FileValue = {
  key: string;
  url: string;
  size: number;
  name: string;
  mime?: string;
};

const ACCEPTED_FILE_TYPES = [
  ".csv",
  ".docx",
  ".htm",
  ".html",
  ".json",
  ".md",
  ".pdf",
  ".tsv",
  ".txt",
  ".xls",
  ".xlsx",
  ".xml",
].join(",");

const ACCEPTED_FILE_REGEX =
  /\.(csv|docx|htm|html|json|md|pdf|tsv|txt|xls|xlsx|xml)$/i;

const readFileMeta = dominoCatalog.find((entry) => entry.id === "readexcel");
const readFileAccentColor = readFileMeta?.badgeStyle?.background
  ? String(readFileMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : "#22c55e";

export default function ReadExcelDomino({ data, id, selected }: NodeProps) {
  const router = useRouter();
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const edges = useEdges();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValueInConnected = useMemo(() => {
    if (typeof (data as any)?.isHandleConnected === "function") {
      try {
        return (data as any).isHandleConnected(id, "value_in");
      } catch {
        // fall through to edge inspection
      }
    }

    return edges.some(
      (edge) =>
        edge?.target === id &&
        (edge?.targetHandle === "value_in" || edge?.targetHandle === "value")
    );
  }, [data, edges, id]);

  const getFileField = () =>
    data.details?.fields?.find((field: any) => field.heading === "File") as
      | { value?: string | FileValue; file?: { key?: string } }
      | undefined;

  const getInitialFileName = () => {
    const field = getFileField();
    const value = field?.value as any;
    if (value && typeof value === "object") return value.name || "";
    if (typeof value === "string") return value;
    return "";
  };

  const [fileName, setFileName] = useState(getInitialFileName());
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const field = getFileField();
    const value = field?.value as any;
    const nextName =
      value && typeof value === "object"
        ? (value.name ?? "")
        : typeof value === "string"
          ? value
          : "";

    if (nextName !== fileName) setFileName(nextName);
  }, [data.details?.fields, fileName]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_FILE_REGEX.test(file.name)) {
      toast.error(
        "Please upload a supported file: Excel, CSV, DOCX, PDF, JSON, TXT, HTML, or XML."
      );
      return;
    }

    clearValidationForDominoId(id);
    setIsUploading(true);

    try {
      setFileName(file.name);

      const token = localStorage.getItem("token") || "";
      const response = await FilesApi.uploadFile(
        file,
        token,
        router,
        data.workflowId
      );

      if (!response) {
        toast.error("File upload failed");
        return;
      }

      const { key, location } = response;
      const valueObj: FileValue = {
        key,
        url: location,
        size: file.size,
        name: file.name,
        mime: file.type || undefined,
      };

      data.setNodes?.((nodes: any[]) =>
        nodes.map((node: any) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  details: {
                    type: "Read File",
                    description:
                      "Reads spreadsheets, documents, PDFs, and text files",
                    fields: [
                      {
                        inPinId: "value_in",
                        type: "file",
                        heading: "File",
                        value: valueObj,
                        required: true,
                        shouldRender: false,
                        needsUpload: false,
                      },
                    ],
                  } as DominoNodeData,
                  exportFields: ["File"],
                },
              }
            : node
        )
      );
    } catch (error) {
      console.error(error);
      toast.error("An error occurred during upload");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    clearValidationForDominoId(id);
    const field = getFileField();
    const value = field?.value as any;
    const legacyKey = (field as any)?.file?.key;
    const key: string | undefined =
      value && typeof value === "object" ? value.key : legacyKey;

    try {
      if (key) {
        const token = localStorage.getItem("token") || "";
        await FilesApi.deleteFile(key, token, router);
      }
    } catch {
      toast.error("Failed to delete file");
    }

    setFileName("");
    data.setNodes?.((nodes: any[]) =>
      nodes.map((node: any) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                details: {
                  type: "Read File",
                  description:
                    "Reads spreadsheets, documents, PDFs, and text files",
                  fields: [
                    {
                      inPinId: "value_in",
                      type: "file",
                      heading: "File",
                      value: "",
                      required: true,
                      shouldRender: false,
                      needsUpload: true,
                    },
                  ],
                } as DominoNodeData,
              },
            }
          : node
      )
    );
  };

  useEffect(() => {
    if (!data.details && data.setNodes) {
      data.setNodes((prev: any[]) =>
        prev.map((node: any) =>
          node.id !== id
            ? node
            : {
                ...node,
                data: {
                  ...node.data,
                  details: {
                    type: "Read File",
                    description:
                      "Reads spreadsheets, documents, PDFs, and text files",
                    fields: [
                      {
                        inPinId: "value_in",
                        type: "file",
                        heading: "File",
                        value: "",
                        required: true,
                        shouldRender: false,
                        needsUpload: true,
                      },
                    ],
                  } as DominoNodeData,
                  exportFields: ["File"],
                },
              }
        )
      );
    }
  }, [data.details, data.setNodes, id]);

  const acceptedTypesLabel = "CSV, XLSX, DOCX, PDF, JSON, TXT, HTML, XML";

  return (
    <div
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 shadow-sm backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95 ${
        hasError
          ? "error-border"
          : selected
            ? "selected-border border-4 shadow-xl ring-2 ring-primary/50"
            : "unselected-border dark:border-gray-600"
      } hover:shadow-lg`}
      style={{ minWidth: "21rem", maxWidth: "21rem" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={{
              borderColor: readFileAccentColor,
              backgroundColor: `${readFileAccentColor}22`,
            }}
          >
            {isUploading ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                style={{ color: readFileAccentColor }}
              />
            ) : (
              <FileSpreadsheet
                className="h-4 w-4"
                style={{ color: readFileAccentColor }}
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Read File
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Input Parser
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                Source Status
              </div>
              <div className="mt-1 text-sm font-medium text-foreground/80 dark:text-slate-200">
                {isValueInConnected
                  ? "Using a connected file source"
                  : fileName
                    ? `Ready to parse ${fileName}`
                    : "Upload a file or connect a dynamic source"}
              </div>
            </div>
            <span className="rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
              {isValueInConnected ? "Live input" : fileName ? "File selected" : "Awaiting file"}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <FolderOpen className="h-3.5 w-3.5" />
              File Source
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {isValueInConnected ? "Connected" : "Manual upload"}
            </span>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline offset={-16} />
              <div className="min-h-14 min-w-0 flex-1 rounded-xl border border-slate-300/80 bg-dominofy-light-surface dark:border-slate-600 dark:bg-dominofy-dark-surface">
                {isValueInConnected ? (
                  <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium italic text-slate-500 dark:text-slate-400">
                        Connected
                      </div>
                      <div className="mt-0.5 text-[11px] text-foreground/55 dark:text-slate-400">
                        This node will read the incoming file payload from another domino.
                      </div>
                    </div>
                    <FileText className="h-4 w-4 shrink-0 text-foreground/40 dark:text-slate-500" />
                  </div>
                ) : fileName ? (
                  <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground dark:text-slate-200">
                        {fileName}
                      </div>
                      <div className="mt-0.5 text-[11px] text-foreground/55 dark:text-slate-400">
                        Stored on upload and ready for downstream parsing.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-rose-600 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300"
                      disabled={isUploading}
                      aria-label="Remove uploaded file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground dark:text-slate-200">
                        Upload a supported file
                      </div>
                      <div className="mt-0.5 text-[11px] text-foreground/55 dark:text-slate-400">
                        {acceptedTypesLabel}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          <span>Uploading</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          <span>Choose file</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Output
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Parsed content
            </span>
          </div>

          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Extracted file payload
                </div>
              </div>
            </div>
            <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline offset={-17} />
          </div>
        </div>
      </div>
    </div>
  );
}
