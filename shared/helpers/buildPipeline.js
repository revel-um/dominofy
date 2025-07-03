"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPipeline = buildPipeline;
function buildPipeline(nodes, edges) {
    const execEdges = edges.filter(e => e.sourceHandle?.startsWith("exec"));
    const idToNode = new Map(nodes.map(n => [n.id, n]));
    const adjacency = {};
    const inDegree = {};
    nodes.forEach(node => {
        adjacency[node.id] = {};
        inDegree[node.id] = 0;
    });
    execEdges.forEach(({ source, target, sourceHandle }) => {
        if (source && target && sourceHandle) {
            if (!adjacency[source][sourceHandle]) {
                adjacency[source][sourceHandle] = [];
            }
            adjacency[source][sourceHandle].push(target);
            inDegree[target] = (inDegree[target] || 0) + 1;
        }
    });
    const queue = Object.keys(inDegree).filter(id => inDegree[id] === 0);
    const sortedPipeline = [];
    const visited = new Set();
    const makeStep = (node) => {
        const exportFields = node.data?.exportFields || [];
        const fields = node.data?.details?.fields || [];
        const cleanedData = {};
        exportFields.forEach(fieldHeading => {
            const field = fields.find((f) => f.heading === fieldHeading);
            if (!field)
                return;
            const override = field.connectedValue ? undefined : field.exportOverride;
            if (Array.isArray(override)) {
                const overrideObject = {};
                override.forEach(name => {
                    overrideObject[name] = field[name];
                });
                cleanedData[fieldHeading] = overrideObject;
            }
            else if (typeof override === "string") {
                cleanedData[fieldHeading] = field[override];
            }
            else {
                cleanedData[fieldHeading] = {
                    value: field.value,
                    connectedValue: field.connectedValue,
                    connectedPin: field.connectedPin,
                };
            }
        });
        const next = adjacency[node.id] || {};
        return {
            id: node.id,
            type: node.type || "unknown",
            data: cleanedData,
            next,
        };
    };
    while (queue.length) {
        const current = queue.shift();
        if (visited.has(current))
            continue;
        visited.add(current);
        const node = idToNode.get(current);
        if (node) {
            sortedPipeline.push(makeStep(node));
        }
        const downstreamMap = adjacency[current] || {};
        Object.values(downstreamMap).forEach(targetList => {
            targetList.forEach(targetId => {
                inDegree[targetId]--;
                if (inDegree[targetId] === 0) {
                    queue.push(targetId);
                }
            });
        });
    }
    nodes.forEach(node => {
        if (!visited.has(node.id)) {
            sortedPipeline.push(makeStep(node));
        }
    });
    return sortedPipeline;
}
//# sourceMappingURL=buildPipeline.js.map