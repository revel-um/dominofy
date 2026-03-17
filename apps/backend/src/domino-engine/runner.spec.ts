import { Runner } from "./runner";
import { PipelineStep } from "../../../../shared/types/pipelineStepType";

describe("Runner branch pruning", () => {
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
});
