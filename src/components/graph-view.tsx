import type { EngineeringRoom } from "@/src/domain/types";

interface GraphNode {
  id: string;
  label: string;
  kind: "room" | "decision" | "task" | "actor" | "work";
  x: number;
  y: number;
  width: number;
}

function nodeCenter(node: GraphNode) {
  return { x: node.x + node.width / 2, y: node.y + 24 };
}

export function GraphView({ room }: { room: EngineeringRoom }) {
  const nodes: GraphNode[] = [
    { id: room.room.id, label: room.room.name, kind: "room", x: 20, y: 24, width: 176 },
    { id: room.decision.id, label: room.decision.status, kind: "decision", x: 244, y: 24, width: 190 },
    ...room.decision.tasks.map((task, i) => ({ id: task.id, label: task.externalKey, kind: "task" as const,
      x: 510, y: 24 + i * 80, width: 140 })),
    ...room.actors.map((actor, i) => ({ id: actor.id, label: actor.name, kind: "actor" as const,
      x: 840, y: 24 + i * 80, width: 210 })),
    ...room.workItems.map((item, i) => ({ id: item.id, label: item.externalKey, kind: "work" as const,
      x: 244, y: 120 + i * 80, width: 190 })),
  ];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const height = Math.max(...nodes.map((node) => node.y)) + 90;
  return (
    <section className="graph-panel panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">ORGANIZATION GRAPH</span>
          <h2>One decision, many execution links</h2>
        </div>
        <span className="quiet-label">{room.edges.length} typed edges</span>
      </div>

      <div className="graph-canvas" role="img" aria-label="Engineering room organization graph">
        <svg viewBox={`0 0 1080 ${height}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="#6f8294" />
            </marker>
          </defs>

          {room.edges.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const start = nodeCenter(from);
            const end = nodeCenter(to);
            return (
              <g key={edge.id}>
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#314254"
                  strokeWidth="1.5"
                  markerEnd="url(#arrow)"
                />
                <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 5} className="graph-edge-label">
                  {edge.relation}
                </text>
              </g>
            );
          })}

          {nodes.map((node) => (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height="48"
                rx="10"
                className={`graph-node graph-node-${node.kind}`}
              />
              <text x={node.x + 14} y={node.y + 21} className="graph-node-kind">
                {node.kind.toUpperCase()}
              </text>
              <text x={node.x + 14} y={node.y + 38} className="graph-node-label">
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="graph-legend">
        <span><i className="legend-dot legend-room" />room</span>
        <span><i className="legend-dot legend-decision" />decision</span>
        <span><i className="legend-dot legend-task" />task</span>
        <span><i className="legend-dot legend-actor" />actor</span>
        <span><i className="legend-dot legend-work" />dependency</span>
      </div>
    </section>
  );
}
