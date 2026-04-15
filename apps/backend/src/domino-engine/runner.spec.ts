import { Runner } from "./runner";
import { PipelineStep } from "../../../../shared/types/pipelineStepType";

describe("Runner branch pruning", () => {
  it("keeps aggregator state across iterator passes and emits only on completion", async () => {
    const pipeline: PipelineStep[] = [
      {
        id: "iterator-1",
        type: "iterator",
        data: {
          Input: { value: ["a", "b", "c"] },
          Order: { value: "forward" },
          "Range Start": { value: "0" },
          "Range End": { value: "0" },
          Max: { value: true },
        },
        next: { exec_out: ["jointext-1"], exec_out_1: [] },
      },
      {
        id: "jointext-1",
        type: "jointext",
        data: {
          Input_1: { value: "item-" },
          Input_2: { connectedValue: "iterator-1" },
        },
        next: { exec_out: ["aggregator-1"] },
      },
      {
        id: "aggregator-1",
        type: "aggregator",
        data: {
          Operation: { value: "array" },
          "Initial Value": { value: "" },
          Input: { connectedValue: "jointext-1" },
        },
        next: { exec_out: ["print-1"] },
      },
      {
        id: "print-1",
        type: "print",
        data: {
          Text: { connectedValue: "aggregator-1" },
        },
        next: {},
      },
    ];

    const visualJson = {
      nodes: pipeline.map(({ id }) => ({ id })),
      edges: [
        { id: "e1", source: "iterator-1", target: "jointext-1", sourceHandle: "exec_out", targetHandle: "exec_in" },
        { id: "e2", source: "jointext-1", target: "aggregator-1", sourceHandle: "exec_out", targetHandle: "exec_in" },
        { id: "e3", source: "aggregator-1", target: "print-1", sourceHandle: "exec_out", targetHandle: "exec_in" },
      ],
    };

    const runner = new Runner(pipeline, 20, visualJson);
    const printOutputs: string[] = [];

    runner.on("done", (result) => {
      if (result.id === "print-1") {
        printOutputs.push(String(result.output));
      }
    });

    const results = await runner.run("aggregator-test-run");

    expect(results).toBeDefined();
    expect(results!["aggregator-1"]).toEqual(["item-a", "item-b", "item-c"]);
    expect(results!["print-1"]).toEqual(JSON.stringify(["item-a", "item-b", "item-c"], null, 2));
    expect(printOutputs).toEqual([
      JSON.stringify(["item-a", "item-b", "item-c"], null, 2),
    ]);
  });

  it("iterates numeric input from zero to input minus one", async () => {
    const pipeline: PipelineStep[] = [
      {
        id: "iterator-1",
        type: "iterator",
        data: {
          Input: { value: 4 },
          Order: { value: "forward" },
          "Range Start": { value: "0" },
          "Range End": { value: "0" },
          Max: { value: true },
        },
        next: { exec_out: ["aggregator-1"], exec_out_1: [] },
      },
      {
        id: "aggregator-1",
        type: "aggregator",
        data: {
          Operation: { value: "array" },
          "Initial Value": { value: "" },
          Input: { connectedValue: "iterator-1" },
        },
        next: {},
      },
    ];

    const visualJson = {
      nodes: pipeline.map(({ id }) => ({ id })),
      edges: [
        { id: "e1", source: "iterator-1", target: "aggregator-1", sourceHandle: "exec_out", targetHandle: "exec_in" },
      ],
    };

    const runner = new Runner(pipeline, 20, visualJson);
    const results = await runner.run("iterator-number-input-test");

    expect(results).toBeDefined();
    expect(results!["aggregator-1"]).toEqual([0, 1, 2, 3]);
  });

  it("returns the connected value through a response domino", async () => {
    const pipeline: PipelineStep[] = [
      {
        id: "api-trigger-1",
        type: "apitrigger",
        data: {
          Function: { value: "hello" },
          "Require Body": { value: true },
        },
        next: { exec_out: ["response-1"] },
      },
      {
        id: "response-1",
        type: "response",
        data: {
          Response: { connectedValue: "api-trigger-1" },
        },
        next: {},
      },
    ];

    const visualJson = {
      nodes: pipeline.map(({ id }) => ({ id })),
      edges: [
        { id: "e1", source: "api-trigger-1", target: "response-1", sourceHandle: "exec_out", targetHandle: "exec_in" },
      ],
    };

    const runner = new Runner(pipeline, 20, visualJson);
    const results = await runner.run("api-response-test-run", {
      body: { hello: "world" },
    });

    expect(results).toBeDefined();
    expect(results!["response-1"]).toEqual({
      body: { hello: "world" },
    });
  });

  it("does not skip descendants that are already in flight when iterator completes", async () => {
    const pipeline: PipelineStep[] = [
      {
        id: "iterator-1",
        type: "iterator",
        data: {
          Input: { value: undefined },
          Order: { value: "forward" },
          "Range Start": { value: "0" },
          "Range End": { value: "3" },
          Max: { value: false },
        },
        next: { exec_out: ["print-1"] },
      },
      {
        id: "print-1",
        type: "print",
        data: {
          Text: { connectedValue: "iterator-1" },
        },
        next: { exec_out: ["delay-1"] },
      },
      {
        id: "delay-1",
        type: "delay",
        data: {
          Delay: { value: 5 },
          Input: { value: "ignored" },
        },
        next: { exec_out: ["print-2"] },
      },
      {
        id: "print-2",
        type: "print",
        data: {
          Text: { value: "hello" },
        },
        next: {},
      },
    ];

    const visualJson = {
      nodes: pipeline.map(({ id }) => ({ id })),
      edges: [
        { id: "e1", source: "iterator-1", target: "print-1", sourceHandle: "exec_out", targetHandle: "exec_in" },
        { id: "e2", source: "print-1", target: "delay-1", sourceHandle: "exec_out", targetHandle: "exec_in" },
        { id: "e3", source: "delay-1", target: "print-2", sourceHandle: "exec_out", targetHandle: "exec_in" },
      ],
    };

    const runner = new Runner(pipeline, 20, visualJson);
    const outputs: string[] = [];

    runner.on("done", (result) => {
      if (result.id === "print-2") {
        outputs.push(String(result.output));
      }
    });

    await runner.run("test-run");

    expect(outputs).toEqual(["hello", "hello", "hello"]);
  });

  it("keeps a parallel in-flight branch alive when iterator completes", async () => {
    const pipeline: PipelineStep[] = [
      {
        id: "iterator-1",
        type: "iterator",
        data: {
          Input: { value: undefined },
          Order: { value: "forward" },
          "Range Start": { value: "0" },
          "Range End": { value: "3" },
          Max: { value: false },
        },
        next: { exec_out: ["print-1", "delay-1"] },
      },
      {
        id: "print-1",
        type: "print",
        data: {
          Text: { connectedValue: "iterator-1" },
        },
        next: {},
      },
      {
        id: "delay-1",
        type: "delay",
        data: {
          Delay: { value: 5 },
          Input: { value: "ignored" },
        },
        next: { exec_out: ["print-2"] },
      },
      {
        id: "print-2",
        type: "print",
        data: {
          Text: { value: "hello" },
        },
        next: {},
      },
    ];

    const visualJson = {
      nodes: pipeline.map(({ id }) => ({ id })),
      edges: [
        { id: "e1", source: "iterator-1", target: "print-1", sourceHandle: "exec_out", targetHandle: "exec_in" },
        { id: "e2", source: "iterator-1", target: "delay-1", sourceHandle: "exec_out", targetHandle: "exec_in" },
        { id: "e3", source: "delay-1", target: "print-2", sourceHandle: "exec_out", targetHandle: "exec_in" },
      ],
    };

    const runner = new Runner(pipeline, 20, visualJson);
    const outputs: string[] = [];

    runner.on("done", (result) => {
      if (result.id === "print-2") {
        outputs.push(String(result.output));
      }
    });

    await runner.run("parallel-test-run");

    expect(outputs).toEqual(["hello", "hello", "hello"]);
  });

  it("prunes a single wired condition branch when the condition resolves false", async () => {
    const pipeline: PipelineStep[] = [
      {
        id: "condition-1",
        type: "condition",
        data: {
          Text1: { value: "false" },
          Text2: { value: "true" },
          Option: { value: "equal" },
        },
        next: { exec_out_1: ["print-1"] },
      },
      {
        id: "print-1",
        type: "print",
        data: {
          Text: { value: "should-not-run" },
        },
        next: { exec_out: ["print-2"] },
      },
      {
        id: "print-2",
        type: "print",
        data: {
          Text: { value: "should-not-run-either" },
        },
        next: {},
      },
    ];

    const visualJson = {
      nodes: pipeline.map(({ id }) => ({ id })),
      edges: [
        { id: "e1", source: "condition-1", target: "print-1", sourceHandle: "exec_out_1", targetHandle: "exec_in" },
        { id: "e2", source: "print-1", target: "print-2", sourceHandle: "exec_out", targetHandle: "exec_in" },
      ],
    };

    const runner = new Runner(pipeline, 20, visualJson);
    const doneIds: string[] = [];

    runner.on("done", (result) => {
      doneIds.push(result.id);
    });

    const results = await runner.run("condition-single-branch-prune");

    expect(doneIds).toEqual(["condition-1"]);
    expect(results).toEqual({
      "condition-1": false,
    });
  });
});
