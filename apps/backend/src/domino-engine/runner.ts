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

    // Schedule all root nodes
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
      // Build runtime inputs from `node.data`
      const runtimeInputs: Record<string, any> = {};
      Object.entries(step.data).forEach(([fieldName, fieldObj]) => {
        if (fieldObj.connectedValue) {
          const upstreamId = fieldObj.connectedValue;
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
          runtimeInputs[fieldName] = fieldObj.value;
        }
      });

      // Instantiate the domino
      const dom = dominoRegistry.instantiate(step);

      // Combine inputs: globalInput for triggers, single-value or object otherwise
      let combinedInput: any;
      if ((dom as any).isTrigger) {
        combinedInput = globalInput;
      } else {
        const keys = Object.keys(runtimeInputs);
        combinedInput = keys.length === 1 ? runtimeInputs[keys[0]] : runtimeInputs;
      }

      // Execute and capture result
      const res: DominoResult = await dom.execute({ runId, input: combinedInput });
      this.emit("done", res);
      results[id] = res.output;

      // ─── Determine branches to follow ───
      const branchKeys = Object.keys(step.next);
      let toFollow: string[];

      if (branchKeys.length === 0) {
        // No outgoing branches
        return;
      } else if (branchKeys.length === 1) {
        // Single branch: always follow
        toFollow = branchKeys;
      } else {
        // Multi-branch: require nextChainKeys
        if (!res.nextChainKeys) {
          throw new Error(
            `[Runner] Node ${id} must return nextChainKeys for multi-branch step`
          );
        }
        toFollow = res.nextChainKeys.filter(k => !!step.next[k]);
        if (toFollow.length === 0) {
          throw new Error(
            `[Runner] Node ${id} returned no valid branches (${res.nextChainKeys.join(",")})`
          );
        }
      }

      // ─── Enqueue only selected children ───
      for (const branch of toFollow) {
        for (const childId of step.next[branch]) {
          const childDeps = deps.get(childId)!;
          childDeps.delete(id);
          if (childDeps.size === 0 && !this.scheduled.has(childId)) {
            this.scheduled.add(childId);
            console.log(`→ Child ${childId} ready on branch ${branch}; enqueueing`);
            this.queue.add(() =>
              this.executeNode(childId, runId, globalInput, children, deps, results)
            );
          }
        }
      }

    } catch (err) {
      this.emit("error", { nodeId: id, error: err });
    }
  }
}
