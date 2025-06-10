// domino-engine/registry.ts
import { PipelineStep } from "../../../../shared/types/pipelineStepType";
import { DominoExecutable } from "./domino-engine.type";

// Import each domino implementation class:
import { ApiCallDomino } from "./dominos/apicall";
import { PrintDomino }   from "./dominos/print";
// … import other dominos here …

type DominoCtor = new (node: PipelineStep) => DominoExecutable;

class DominoRegistry {
  private readonly map = new Map<string, DominoCtor>();

  constructor() {
    // Register each type → its class constructor:
    this.register("apicall", ApiCallDomino);
    this.register("print",   PrintDomino);
    // this.register("arithmetic", ArithmeticDomino);
    // … etc. for all your other domino types …
  }

  public register(type: string, ctor: DominoCtor) {
    if (this.map.has(type)) {
      throw new Error(`Domino type "${type}" already registered`);
    }
    this.map.set(type, ctor);
  }

  public instantiate(node: PipelineStep): DominoExecutable {
    const ctor = this.map.get(node.type);
    if (!ctor) {
      throw new Error(`Unknown domino type "${node.type}"`);
    }
    return new ctor(node);
  }
}

export const dominoRegistry = new DominoRegistry();
