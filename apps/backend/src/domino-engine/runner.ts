import { EventEmitter } from "events";
import PQueue from "p-queue";
import { buildGraph } from "./graph";
import { dominoRegistry } from "./registry";
import { PipelineStep } from "../../../../shared/types/pipelineStepType";
import { DominoResult } from "./domino-engine.type";

export class Runner extends EventEmitter {
  private queue: PQueue;
  private scheduled: Set<string>;

  constructor(
    private pipeline: PipelineStep[],
    private maxConcurrency = 20,
  ) {
    super();
    this.queue = new PQueue({ concurrency: this.maxConcurrency });
    this.scheduled = new Set();
  }

  async run(runId: string, globalInput: Record<string, any> = {}) {
    const { children, deps } = buildGraph(this.pipeline);
    const results: Record<string, any> = {};

    // Clone dependencies so we can mutate
    const depsClone = new Map<string, Set<string>>();
    deps.forEach((depSet, nodeId) => {
      depsClone.set(nodeId, new Set(depSet));
    });

    this.scheduled.clear();

    // Schedule all root nodes (no deps)
    depsClone.forEach((depSet, nodeId) => {
      if (depSet.size === 0 && !this.scheduled.has(nodeId)) {
        this.scheduled.add(nodeId);
        this.queue.add(() =>
          this.executeNode(nodeId, runId, globalInput, children, depsClone, results)
        );
      }
    });

    await this.queue.onIdle();
    this.emit("terminate", results);
  }

  private async executeNode(
    id: string,
    runId: string,
    globalInput: Record<string, any>,
    children: Map<string, string[]>,
    deps: Map<string, Set<string>>,
    results: Record<string, any>
  ) {
    console.log(`Scheduling node ${id}`);
    const step = this.pipeline.find(n => n.id === id);
    if (!step) {
      throw new Error(`[Runner] Node ${id} not found in pipeline array`);
    }
    console.log(`Executing node ${id}`);

    try {
      // 1️⃣ Build runtime inputs from step.data
      const runtimeInputs: Record<string, any> = {};
      Object.entries(step.data).forEach(([fieldName, fieldObj]) => {
        const obj = fieldObj as any;
        if (obj.connectedValue) {
          const upstreamId = obj.connectedValue as string;
          const upstreamResult = results[upstreamId];
          if (upstreamResult === undefined) {
            throw new Error(
              `Node ${id} expected output from ${upstreamId}, but it's not available.`
            );
          }
          runtimeInputs[fieldName] =
            upstreamResult[fieldName] !== undefined
              ? upstreamResult[fieldName]
              : upstreamResult;
        } else {
          runtimeInputs[fieldName] = obj.value;
        }
      });

      // 2️⃣ Instantiate the domino
      const dom = dominoRegistry.instantiate(step);

      // 3️⃣ Decide input shape: unwrap for print-domino
      let combinedInput: any;
      if (step.type === "print" && Object.keys(runtimeInputs).length === 1) {
        const soleKey = Object.keys(runtimeInputs)[0];
        combinedInput = runtimeInputs[soleKey];
      } else {
        combinedInput = (dom as any).isTrigger ? globalInput : runtimeInputs;
      }

      // 4️⃣ Execute and capture result
      const res: DominoResult = await dom.execute({ runId, input: combinedInput });
      this.emit("done", res);
      results[id] = res.output;

      // 5️⃣ Remove this node from deps of ALL its children (control + data)
      const allChildren = children.get(id) || [];
      for (const childId of allChildren) {
        deps.get(childId)!.delete(id);
      }

      // 6️⃣ Determine control-flow branches
      const branchKeys = Object.keys(step.next);
      const controlChildren = new Set(Object.values(step.next).flat());
      let branchChildren = new Set<string>();

      if (branchKeys.length === 1 && (!res?.nextChainKeys?.length || res?.nextChainKeys?.includes(branchKeys[0]))) {
        branchChildren = new Set(controlChildren);
      } else if (branchKeys.length > 1) {
        if (!res.nextChainKeys) {
          throw new Error(
            `[Runner] Node ${id} must return nextChainKeys for multi-branch step`
          );
        }
        (res.nextChainKeys as string[])
          .filter(k => step.next[k])
          .forEach(k => step.next[k].forEach(cid => branchChildren.add(cid)));
      }

      // 7️⃣ Enqueue children whose deps are now zero
      for (const childId of allChildren) {
        const childDeps = deps.get(childId)!;
        if (childDeps.size > 0 || this.scheduled.has(childId)) continue;
        if (controlChildren.has(childId) && !branchChildren.has(childId)) continue;

        this.scheduled.add(childId);
        console.log(`→ Child ${childId} ready; enqueueing`);
        this.queue.add(() =>
          this.executeNode(childId, runId, globalInput, children, deps, results)
        );
      }
    } catch (err) {
      this.emit("error", { nodeId: id, error: err });
    }
  }
}
