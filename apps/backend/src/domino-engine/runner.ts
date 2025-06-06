// domino-engine/runner.ts
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
    private maxConcurrency = 20 // default to 20 concurrent dominos
  ) {
    super();
    // Initialize the queue with a concurrency cap:
    this.queue = new PQueue({ concurrency: this.maxConcurrency });
    this.scheduled = new Set();
  }

  async run(runId: string) {
    const { children, deps } = buildGraph(this.pipeline);
    const results: Record<string, any> = {};

    // Deep clone deps to avoid mutating original dependencies across runs
    const depsClone = new Map<string, Set<string>>();
    deps.forEach((depSet, nodeId) => {
      depsClone.set(nodeId, new Set(depSet));
    });

    // Clear scheduled set before starting
    this.scheduled.clear();

    // 1️⃣  Enqueue all “root” nodes (deps.size === 0)
    depsClone.forEach((depSet, nodeId) => {
      if (depSet.size === 0 && !this.scheduled.has(nodeId)) {
        this.scheduled.add(nodeId);
        this.queue.add(() =>
          this.executeNode(nodeId, runId, children, depsClone, results)
        );
      }
    });

    // 2️⃣  Wait until the queue is idle (i.e., all tasks have finished or errored)
    await this.queue.onIdle();
    this.emit("terminate", results);
  }

  private async executeNode(
    id: string,
    runId: string,
    children: Map<string, string[]>,
    deps: Map<string, Set<string>>,
    results: Record<string, any>
  ) {
    console.log(`Scheduling node ${id}`);
    const node = this.pipeline.find((n) => n.id === id);
    if (!node) {
      throw new Error(`[Runner] Node ${id} not found in pipeline array`);
    }

    console.log(`Executing node ${id}`);
    try {
      // Build runtime inputs by resolving value pins
      const runtimeInputs: Record<string, any> = {};
      Object.entries(node.data).forEach(([fieldName, fieldObj]) => {
        if (fieldObj.connectedValue) {
          const upstreamId = fieldObj.connectedValue;
          const upstreamResult = results[upstreamId];
          if (upstreamResult === undefined) {
            throw new Error(
              `Node ${id} expected output from ${upstreamId}, but it's not available.`
            );
          }
          // Assume upstreamResult is an object containing fields matching fieldName or a direct value
          runtimeInputs[fieldName] =
            upstreamResult[fieldName] !== undefined
              ? upstreamResult[fieldName]
              : upstreamResult;
        } else {
          runtimeInputs[fieldName] = fieldObj.value;
        }
      });

      // Instantiate & run the domino with resolved inputs
      const dom = dominoRegistry.instantiate(node);
      const res: DominoResult = await dom.execute({ runId, input: runtimeInputs });

      this.emit("done", res);
      results[id] = res.output;
      // console.log(`Node ${id} finished`);
    } catch (err) {
      // console.error(`[Runner] Error executing node ${id}:`, err);
      this.emit("error", { nodeId: id, error: err });
    } finally {
      // 3️⃣  Unlock downstream children
      (children.get(id) || []).forEach((childId) => {
        const childDeps = deps.get(childId)!;
        childDeps.delete(id);
        if (childDeps.size === 0 && !this.scheduled.has(childId)) {
          this.scheduled.add(childId);
          console.log(`→ Child ${childId} ready; enqueueing`);
          this.queue.add(() =>
            this.executeNode(childId, runId, children, deps, results)
          );
        }
      });
    }
  }
}
