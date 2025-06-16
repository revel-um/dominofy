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

    const depsClone = new Map<string, Set<string>>();
    deps.forEach((depSet, nodeId) => {
      depsClone.set(nodeId, new Set(depSet));
    });

    this.scheduled.clear();

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
    const node = this.pipeline.find((n) => n.id === id);
    if (!node) {
      throw new Error(`[Runner] Node ${id} not found in pipeline array`);
    }

    console.log(`Executing node ${id}`);
    try {
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
          runtimeInputs[fieldName] =
            upstreamResult[fieldName] !== undefined
              ? upstreamResult[fieldName]
              : upstreamResult;
        } else {
          runtimeInputs[fieldName] = fieldObj.value;
        }
      });

      // Instantiate the domino
      const dom = dominoRegistry.instantiate(node);

      // ✅ Use globalInput if this domino declares itself a trigger
      let combinedInput: Record<string, any>;
      if ((dom as any).isTrigger) {
        combinedInput = globalInput;
      } else {
        const keys = Object.keys(runtimeInputs);
        combinedInput = keys.length === 1 ? runtimeInputs[keys[0]] : runtimeInputs;
      }

      const res: DominoResult = await dom.execute({
        runId,
        input: combinedInput,
      });

      this.emit("done", res);
      results[id] = res.output;
    } catch (err) {
      this.emit("error", { nodeId: id, error: err });
    } finally {
      (children.get(id) || []).forEach((childId) => {
        const childDeps = deps.get(childId)!;
        childDeps.delete(id);
        if (childDeps.size === 0 && !this.scheduled.has(childId)) {
          this.scheduled.add(childId);
          console.log(`→ Child ${childId} ready; enqueueing`);
          this.queue.add(() =>
            this.executeNode(childId, runId, globalInput, children, deps, results)
          );
        }
      });
    }
  }
}
