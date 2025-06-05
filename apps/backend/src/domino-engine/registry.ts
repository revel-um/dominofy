// domino-engine/registry.ts
import { PipelineStep } from "../../../../shared/types/pipelineStepType";
import { DominoExecutable } from "./domino-engine.type";
import { ApiCallDomino } from "./dominos/apicall";
import { PrintDomino } from "./dominos/print";
// …import any other dominos you support…

type DominoCtor = new (node: PipelineStep) => DominoExecutable;

class DominoRegistry {
    private readonly map = new Map<string, DominoCtor>();

    constructor() {
        // Register every type → its constructor here:
        this.register("apicall", ApiCallDomino);
        this.register("print", PrintDomino);
        // this.register("arithmetic", ArithmeticDomino);
        // …etc…
    }

    public register(type: string, ctor: DominoCtor) {
        if (this.map.has(type)) {
            throw new Error(`Domino "${type}" already registered`);
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
