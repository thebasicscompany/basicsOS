/**
 * Kahn's topological sort for DAGs.
 * Returns node IDs in execution order (nodes with no incoming edges first).
 * Only edges whose source and target are in nodeIds are considered.
 */
export function topologicalSort(
  nodeIds: Iterable<string>,
  edges: Iterable<{ source: string; target: string }>
): string[] {
  const nodeIdSet = new Set(nodeIds);
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of nodeIds) {
    adjacency.set(id, []);
    inDegree.set(id, 0);
  }

  for (const edge of edges) {
    if (nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)) {
      adjacency.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [nid, deg] of inDegree) {
    if (deg === 0) queue.push(nid);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const nid = queue.shift()!;
    order.push(nid);
    for (const neighbor of adjacency.get(nid) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return order;
}
