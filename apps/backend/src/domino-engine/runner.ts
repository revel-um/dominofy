import { EventEmitter } from "events";
import PQueue from "p-queue";
import { buildGraph } from "./graph";
import { dominoRegistry } from "./registry";
import { PipelineStep } from "../../../../shared/types/pipelineStepType";
import { ExecuteContext, DominoResult } from "./domino-engine.type";
import { getWorkflowValidationError } from "../../../../shared/helpers/validateWorkflow";

export class Runner extends EventEmitter {
  private queue: PQueue;
  private scheduled = new Set<string>();
  private active = new Set<string>();
  private localState = new Map<string, Record<string, any>>(); // per-domino state
  private multiOut = new Set<string>();                        // multi-pin dominos
  private doneFlags = new Map<string, boolean>();              // cascade flags
  private skipped = new Set<string>();                         // pruned branch nodes
  private executionErrorNodeId: string | null = null;
  private executionErrorMessage: string | null = null;
  private controlParents = new Map<string, Set<string>>();

  constructor(private pipeline: PipelineStep[], private maxConcurrency = 20, private visualJson: any) {
    super();
    this.queue = new PQueue({ concurrency: this.maxConcurrency });
    this.pipeline.forEach((node) => {
      Object.values(node.next || {}).forEach((list) => {
        list.forEach((childId) => {
          if (!this.controlParents.has(childId)) {
            this.controlParents.set(childId, new Set());
          }
          this.controlParents.get(childId)!.add(node.id);
        });
      });
    });
  }

  /* ───────────────────────── run ───────────────────────── */

  async run(
    runId: string,
    globalInput: Record<string, any> = {},
    runtimeMeta: { workflowId?: string } = {},
  ) {
    
    //Validate if workflow is invalid
    const workflowValidationError = getWorkflowValidationError(this.visualJson);
    if (workflowValidationError) {
      throw new Error(`Workflow validation failed: ${workflowValidationError}`);
    }

    const { children, deps } = buildGraph(this.pipeline);
    const results: Record<string, any> = {};

    /* clone dep-graph so we can mutate it */
    const depsClone = new Map<string, Set<string>>();
    deps.forEach((set, id) => depsClone.set(id, new Set(set)));

    /* validate dependencies */
    for (const [nodeId, depSet] of depsClone) {
      depSet.forEach(depId => {
        if (!depsClone.has(depId)) {
          throw new Error(`Invalid pipeline: "${nodeId}" depends on nonexistent "${depId}".`);
        }
      });
    }

    const unresolved = new Set(this.pipeline.map(s => s.id));
    this.scheduled.clear();
    this.multiOut.clear();
    this.doneFlags.clear();
    this.skipped.clear();
    this.executionErrorNodeId = null;
    this.executionErrorMessage = null;

    /* schedule roots (no control dependencies) */
    depsClone.forEach((depSet, nodeId) => {
      if (depSet.size === 0) {
        this.scheduleNode(nodeId, runId, globalInput, runtimeMeta, children, depsClone, results, unresolved);
      }
    });
    
    await this.queue.onIdle();

    if (this.executionErrorNodeId && this.executionErrorMessage) {
      this.emit("terminate", results);
      this.cleanup();
      return results;
    }

    if (unresolved.size) {
      const pending = [...unresolved].map(id => ({
        id,
        waitingFor: [...(depsClone.get(id) ?? [])]
      }));
      this.emit("deadlock", pending);
      this.cleanup();
      throw new Error(
        `Dead-lock: the following dominos could not be scheduled:\n` +
        pending.map(p => ` • ${p.id} ← ${p.waitingFor.join(", ") || "??"}`).join("\n")
      );
    }

    this.emit("terminate", results);
    this.cleanup();
    return results;
  }

  /* ───────────────────────── helpers ───────────────────────── */

  private cleanup() {
    this.queue.clear();
    this.queue.pause();
    this.scheduled.clear();
    this.active.clear();
    this.localState.clear();
    this.multiOut.clear();
    this.doneFlags.clear();
    this.skipped.clear();
    this.executionErrorNodeId = null;
    this.executionErrorMessage = null;
    this.removeAllListeners();
  }

  private scheduleNode(
    id: string,
    runId: string,
    globalInput: Record<string, any>,
    runtimeMeta: { workflowId?: string },
    children: Map<string, string[]>,
    deps: Map<string, Set<string>>,
    results: Record<string, any>,
    unresolved: Set<string>,
  ) {
    if (this.skipped.has(id)) return;
    if (this.scheduled.has(id)) return;
    this.scheduled.add(id);
    this.queue.add(() =>
      this.executeNode(id, runId, globalInput, runtimeMeta, children, deps, results, unresolved),
    );
  }

  /* ───────────────────── execute one node ───────────────────── */

  private async executeNode(
    id: string,
    runId: string,
    globalInput: Record<string, any>,
    runtimeMeta: { workflowId?: string },
    children: Map<string, string[]>,
    deps: Map<string, Set<string>>,
    results: Record<string, any>,
    unresolved: Set<string>
  ) {
    if (this.skipped.has(id)) return;
    this.scheduled.delete(id);
    this.active.add(id);
    const step = this.pipeline.find(n => n.id === id);
    if (!step) throw new Error(`Node ${id} not found in pipeline`);

    try {
      // 1️⃣ build runtime inputs & upstream done flag
      const runtimeInputs: Record<string, any> = {};
      let upstreamDone = false;
      let hasIteratorValueParent = false;
      for (const [fieldName, fieldObj] of Object.entries(step.data)) {
        const obj = fieldObj as any;
        if (obj.connectedValue) {
          const upstreamId = obj.connectedValue as string;
          const upstreamStep = this.pipeline.find(n => n.id === upstreamId);
          if (upstreamStep?.type === "iterator") {
            hasIteratorValueParent = true;
          }
          const upstreamOutput = results[upstreamId];
          if (upstreamOutput === undefined) {
            throw new Error(`Node ${id} expected output from ${upstreamId}`);
          }
          const upstreamIsMulti = this.multiOut.has(upstreamId);
          if (upstreamIsMulti) {
            const pin = obj.connectedPin as string;
            runtimeInputs[fieldName] = upstreamOutput[pin];
          } else {
            runtimeInputs[fieldName] = upstreamOutput;
          }
          if (this.doneFlags.get(upstreamId)) upstreamDone = true;
        } else {
          runtimeInputs[fieldName] = (fieldObj as any).value;
        }
      }

      // 2️⃣ instantiate domino & build ExecuteContext
      const domino = dominoRegistry.instantiate(step);
      const combinedInput =
        step.type === "print" && Object.keys(runtimeInputs).length === 1
          ? runtimeInputs[Object.keys(runtimeInputs)[0]]
          : (domino as any).isTrigger
            ? globalInput
            : runtimeInputs;
      const local = this.localState.get(id) ?? {};
      const setLocal = (k: string, v: any) => {
        if (v === undefined) delete local[k]; else local[k] = v;
        this.localState.set(id, local);
      };
      const ctx: ExecuteContext = {
        runId,
        workflowId: runtimeMeta.workflowId,
        input: combinedInput,
        globals: globalInput,
        local,
        setLocal,
        done: upstreamDone,
      };

      // 3️⃣ execute
      const res: DominoResult = await domino.execute(ctx);
      this.emit("done", res);
      const nodeDone = upstreamDone || (res as any).done === true;
      this.doneFlags.set(id, nodeDone);
      results[id] = res.output;
      if ((res as any).isMultiOutPinDomino) this.multiOut.add(id);
      unresolved.delete(id);

      // remove control dependency
      const allChildren = children.get(id) || [];
      allChildren.forEach(childId => deps.get(childId)!.delete(id));

      // branch resolution
      const branchKeys = Object.keys(step.next);
      const controlChildren = new Set(Object.values(step.next).flat());
      let branchChildren = new Set<string>();
      if (
        branchKeys.length === 1 &&
        (res.nextChainKeys === undefined || res.nextChainKeys.includes(branchKeys[0]))
      ) {
        branchChildren = new Set(controlChildren);
      } else if (branchKeys.length > 1) {
        if (!res.nextChainKeys) throw new Error(`Node ${id} must return nextChainKeys`);
        res.nextChainKeys.forEach(k => step.next[k]?.forEach(cid => branchChildren.add(cid)));
      }

      // prune unused branches so they don't count as deadlock
      const shouldPruneSkippedBranches =
        nodeDone || (res.nextChainKeys !== undefined && !hasIteratorValueParent);
      if (shouldPruneSkippedBranches) {
        const skippedChildren = [...controlChildren].filter(cid => !branchChildren.has(cid));
        skippedChildren.forEach(cid => this.skipSubtree(cid, children, deps, unresolved));
      }

      // 4️⃣ enqueue control-flow children
      for (const childId of allChildren) {
        const childDeps = deps.get(childId)!;
        if (childDeps.size > 0) continue;
        if (controlChildren.has(childId) && !branchChildren.has(childId)) continue;
        const isDataOnlyChild = !controlChildren.has(childId);
        const hasAnyControlParent = (this.controlParents.get(childId)?.size ?? 0) > 0;
        if (step.type === "iterator" && isDataOnlyChild && hasAnyControlParent) continue;
        this.scheduleNode(childId, runId, globalInput, runtimeMeta, children, deps, results, unresolved);
      }

      // 5️⃣ then re-queue iterator if needed
      const hasCursor = Object.keys(local).some(k => k.startsWith(`iterator_cursor_${id}`));
      if (hasCursor) {
        this.scheduleNode(id, runId, globalInput, runtimeMeta, children, deps, results, unresolved);
      }
    } catch (err) {
      if (!this.executionErrorNodeId) {
        this.executionErrorNodeId = id;
        this.executionErrorMessage =
          err instanceof Error ? err.message : String(err);
      }
      if (this.listenerCount("error") > 0) {
        this.emit("error", { nodeId: id, error: err });
      }
      // unresolved left for deadlock detection
    } finally {
      this.active.delete(id);
    }
  }

  private skipSubtree(
    startId: string,
    children: Map<string, string[]>,
    deps: Map<string, Set<string>>,
    unresolved: Set<string>
  ) {
    const stack = [startId];
    while (stack.length) {
      const id = stack.pop()!;
      if (this.skipped.has(id)) continue;
      if (this.scheduled.has(id) || this.active.has(id)) continue;
      if (!unresolved.has(id)) continue;
      this.skipped.add(id);
      unresolved.delete(id);
      const childIds = children.get(id) || [];
      childIds.forEach(childId => {
        deps.get(childId)?.delete(id);
        if (!this.skipped.has(childId)) stack.push(childId);
      });
    }
  }
}
