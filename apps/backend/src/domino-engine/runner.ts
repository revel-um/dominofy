// domino-engine/runner.ts
import { EventEmitter } from "events";
import { buildGraph } from "./graph";
import { dominoRegistry } from "./registry";
import { PipelineStep } from "../../../../shared/types/pipelineStepType";
import { DominoResult } from "./domino-engine.type";

export class Runner extends EventEmitter {
  constructor(
    private pipeline: PipelineStep[],
    private maxConcurrency = Infinity // now unused, since we run everything immediately
  ) {
    super();
  }

  async run(runId: string) {
    const { children, deps } = buildGraph(this.pipeline);

    // Find initial “root” nodes (no dependencies)
    const ready = [...deps.entries()]
      .filter(([_, depSet]) => depSet.size === 0)
      .map(([nodeId]) => nodeId);

    const inFlight = new Set<string>();
    const results: Record<string, any> = {};

    // Collect only the outputs of direct parents
    const collectParentOutputs = (nodeId: string): Record<string, any> => {
      const parentOutputs: Record<string, any> = {};
      deps.get(nodeId)?.forEach((pId) => {
        if (pId in results) parentOutputs[pId] = results[pId];
      });
      return parentOutputs;
    };

    // Schedule a node immediately—no throttling
    const schedule = (id: string) => {
      inFlight.add(id);

      (async () => {
        const node = this.pipeline.find((n) => n.id === id);
        if (!node) {
          throw new Error(`[Runner] Node ${id} not found in pipeline array`);
        }

        try {
          const dom = dominoRegistry.instantiate(node);
          const res: DominoResult = await dom.execute({
            runId,
            input: collectParentOutputs(id),
          });

          this.emit("done", res);
          results[id] = res.output;
          console.log(`Node ${id} finished`);
        } catch (err) {
          console.error(`[Runner] Error executing node ${id}:`, err);
          this.emit("error", { nodeId: id, error: err });
        } finally {
          inFlight.delete(id);

          // Unlock downstream children
          (children.get(id) || []).forEach((childId) => {
            const depSet = deps.get(childId);
            if (depSet) {
              depSet.delete(id);
              if (depSet.size === 0) {
                console.log(`→ Queuing child ${childId}`);
                ready.push(childId);
              }
            }
          });

          // Drain newly ready items
          while (ready.length) {
            const nextId = ready.shift()!;
            schedule(nextId);
          }
        }
      })();
    };

    // Kick off all initial roots
    while (ready.length) {
      const first = ready.shift()!;
      schedule(first);
    }

    // Wait until every in-flight node completes
    while (inFlight.size) {
      await new Promise((r) => setTimeout(r, 10));
    }
    this.emit("allDone", results);
  }
}
