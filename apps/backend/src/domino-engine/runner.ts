// domino-engine/runner.ts
import { EventEmitter } from "events";
import PQueue from "p-queue";
import { buildGraph } from "./graph";
import { dominoRegistry } from "./registry";
import { PipelineStep } from "../../../../shared/types/pipelineStepType";
import { DominoResult } from "./domino-engine.type";

export class Runner extends EventEmitter {
  private queue: PQueue;

  constructor(
    private pipeline: PipelineStep[],
    private maxConcurrency = 5 // default to 5 concurrent dominos
  ) {
    super();
    // Initialize the queue with a concurrency cap:
    this.queue = new PQueue({ concurrency: this.maxConcurrency });
  }

  async run(runId: string) {
    const { children, deps } = buildGraph(this.pipeline);
    const results: Record<string, any> = {};

    // 1️⃣  Enqueue all “root” nodes (deps.size === 0)
    deps.forEach((depSet, nodeId) => {
      if (depSet.size === 0) {
        this.queue.add(() => this.executeNode(nodeId, runId, children, deps, results));
      }
    });

    // 2️⃣  Wait until the queue is idle (i.e., all tasks have finished or errored)
    await this.queue.onIdle();
    this.emit("allDone", results);
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
      // Instantiate & run the domino
      const dom = dominoRegistry.instantiate(node);
      const res: DominoResult = await dom.execute({
        runId,
        input: this.collectParentOutputs(id, deps, results),
      });

      this.emit("done", res);
      results[id] = res.output;
      console.log(`Node ${id} finished`);
    } catch (err) {
      console.error(`[Runner] Error executing node ${id}:`, err);
      this.emit("error", { nodeId: id, error: err });
      // We still proceed to unlock children; we don't leave them hanging.
    } finally {
      // 3️⃣  Unlock downstream children
      (children.get(id) || []).forEach((childId) => {
        const childDeps = deps.get(childId)!;
        childDeps.delete(id);
        if (childDeps.size === 0) {
          // Child is now ready—enqueue it
          console.log(`→ Child ${childId} ready; enqueueing`);
          this.queue.add(() =>
            this.executeNode(childId, runId, children, deps, results)
          );
        }
      });
    }
  }

  private collectParentOutputs(
    nodeId: string,
    deps: Map<string, Set<string>>,
    results: Record<string, any>
  ): Record<string, any> {
    const parentOutputs: Record<string, any> = {};
    deps.get(nodeId)?.forEach((pId) => {
      if (pId in results) {
        parentOutputs[pId] = results[pId];
      }
    });
    return parentOutputs;
  }
}
