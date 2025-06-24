// apps/backend/src/domino-engine/runner.ts
import { EventEmitter } from "events";
import PQueue from "p-queue";
import { buildGraph } from "./graph";
import { dominoRegistry } from "./registry";
import { PipelineStep } from "../../../../shared/types/pipelineStepType";
import { ExecuteContext, DominoResult } from "./domino-engine.type";

export class Runner extends EventEmitter {
  private queue: PQueue;
  private scheduled = new Set<string>();
  /** Per-domino scratch-pad that survives across ticks */
  private localState = new Map<string, Record<string, any>>();
  /** Dominos that emit multiple value-out pins */
  private multiOut = new Set<string>();

  constructor(private pipeline: PipelineStep[], private maxConcurrency = 20) {
    super();
    this.queue = new PQueue({ concurrency: this.maxConcurrency });
  }

  /* ───────────────────────── run ───────────────────────── */

  async run(runId: string, globalInput: Record<string, any> = {}) {
    const { children, deps } = buildGraph(this.pipeline);
    const results: Record<string, any> = {};

    /* clone dep-graph so we can mutate it */
    const depsClone = new Map<string, Set<string>>();
    deps.forEach((set, id) => depsClone.set(id, new Set(set)));

    /* quick validation */
    for (const [nodeId, depSet] of depsClone) {
      depSet.forEach(depId => {
        if (!depsClone.has(depId)) {
          throw new Error(
            `[Runner] Invalid pipeline: "${nodeId}" depends on nonexistent "${depId}".`,
          );
        }
      });
    }

    const unresolved = new Set(this.pipeline.map(s => s.id));
    this.scheduled.clear();
    this.multiOut.clear();

    /* schedule roots */
    depsClone.forEach((depSet, nodeId) => {
      if (depSet.size === 0) {
        this.scheduleNode(
          nodeId,
          runId,
          globalInput,
          children,
          depsClone,
          results,
          unresolved,
        );
      }
    });

    await this.queue.onIdle();

    if (unresolved.size) {
      const pending = [...unresolved].map(id => ({
        id,
        waitingFor: [...(depsClone.get(id) ?? [])],
      }));
      this.emit("deadlock", pending);
      this.cleanup();
      const msg =
        `[Runner] Dead-lock: the following dominos could not be scheduled:\n` +
        pending
          .map(
            p => ` • ${p.id}  ←  ${p.waitingFor.join(", ") || "??"}`,
          )
          .join("\n");
      throw new Error(msg);
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
    this.localState.clear();
    this.multiOut.clear();
    this.removeAllListeners();
  }

  private scheduleNode(
    id: string,
    runId: string,
    globalInput: Record<string, any>,
    children: Map<string, string[]>,
    deps: Map<string, Set<string>>,
    results: Record<string, any>,
    unresolved: Set<string>,
  ) {
    if (this.scheduled.has(id)) return;
    this.scheduled.add(id);
    this.queue.add(() =>
      this.executeNode(
        id,
        runId,
        globalInput,
        children,
        deps,
        results,
        unresolved,
      ),
    );
  }

  private async executeNode(
    id: string,
    runId: string,
    globalInput: Record<string, any>,
    children: Map<string, string[]>,
    deps: Map<string, Set<string>>,
    results: Record<string, any>,
    unresolved: Set<string>,
  ) {
    this.scheduled.delete(id);

    const step = this.pipeline.find(n => n.id === id);
    if (!step)
      throw new Error(`[Runner] Node ${id} not found in pipeline array`);

    try {
      /* 1️⃣ Build runtime inputs */
      const runtimeInputs: Record<string, any> = {};

      for (const [fieldName, fieldObj] of Object.entries(step.data)) {
        const obj = fieldObj as any;

        if (obj.connectedValue) {
          const upstreamId = obj.connectedValue as string;
          const upstreamOutput = results[upstreamId];

          if (upstreamOutput === undefined) {
            throw new Error(
              `Node ${id} expected output from ${upstreamId}, but it is not yet available`,
            );
          }

          const upstreamIsMulti = this.multiOut.has(upstreamId);

          if (upstreamIsMulti) {
            /* must have connectedPin */
            const pin = obj.connectedPin as string | undefined;
            if (!pin) {
              throw new Error(
                `Node ${id} is wired to multi-output domino "${upstreamId}" ` +
                  `but field "${fieldName}" lacks connectedPin.`,
              );
            }
            if (
              typeof upstreamOutput !== "object" ||
              upstreamOutput === null ||
              !(pin in upstreamOutput)
            ) {
              throw new Error(
                `Node ${id} requested pin "${pin}" from "${upstreamId}", ` +
                  `but that domino did not produce it.`,
              );
            }
            runtimeInputs[fieldName] = upstreamOutput[pin];
          } else {
            /* single-output domino: pass whole value */
            runtimeInputs[fieldName] = upstreamOutput;
          }
        } else {
          runtimeInputs[fieldName] = obj.value;
        }
      }

      /* 2️⃣ Instantiate domino & build context */
      const domino = dominoRegistry.instantiate(step);

      const combinedInput =
        step.type === "print" && Object.keys(runtimeInputs).length === 1
          ? runtimeInputs[Object.keys(runtimeInputs)[0]]
          : (domino as any).isTrigger
          ? globalInput
          : runtimeInputs;

      const local = this.localState.get(id) ?? {};
      const setLocal = (k: string, v: any) => {
        if (v === undefined) delete local[k];
        else local[k] = v;
        this.localState.set(id, local);
      };

      const ctx: ExecuteContext = {
        runId,
        input: combinedInput,
        globals: globalInput,
        local,
        setLocal,
      };

      /* 3️⃣ Execute domino */
      const res: DominoResult = await domino.execute(ctx);
      this.emit("done", res);

      results[id] = res.output;
      if ((res as any).isMultiOutPinDomino) this.multiOut.add(id);

      /* iterator re-queue */
      const hasCursor = Object.keys(local).some(k =>
        k.startsWith(`iterator_cursor_${id}`),
      );
      if (hasCursor) {
        this.scheduleNode(
          id,
          runId,
          globalInput,
          children,
          deps,
          results,
          unresolved,
        );
      }

      /* mark executed */
      unresolved.delete(id);

      /* dep-graph update */
      const allChildren = children.get(id) || [];
      allChildren.forEach(childId => deps.get(childId)!.delete(id));

      /* branch resolution */
      const branchKeys = Object.keys(step.next);
      const controlChildren = new Set(Object.values(step.next).flat());
      let branchChildren = new Set<string>();

      if (
        branchKeys.length === 1 &&
        (!res.nextChainKeys?.length ||
          res.nextChainKeys.includes(branchKeys[0]))
      ) {
        branchChildren = new Set(controlChildren);
      } else if (branchKeys.length > 1) {
        if (!res.nextChainKeys) {
          throw new Error(
            `[Runner] Node ${id} must return nextChainKeys for multi-branch step`,
          );
        }
        res.nextChainKeys
          .filter(k => step.next[k])
          .forEach(k =>
            step.next[k].forEach(cid => branchChildren.add(cid)),
          );
      }

      /* queue eligible children */
      for (const childId of allChildren) {
        const childDeps = deps.get(childId)!;
        if (childDeps.size > 0) continue;
        if (
          controlChildren.has(childId) &&
          !branchChildren.has(childId)
        )
          continue;
        this.scheduleNode(
          childId,
          runId,
          globalInput,
          children,
          deps,
          results,
          unresolved,
        );
      }
    } catch (err) {
      this.emit("error", { nodeId: id, error: err });
      // unresolved → dead-lock detector handles it
    }
  }
}
