import type { EngineeringRoom } from "@/src/domain/types";

export function SpatialView({ room }: { room: EngineeringRoom }) {
  return (
    <section className="spatial-panel panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SPATIAL INTERFACE</span>
          <h2>A room that reflects live work</h2>
        </div>
        <span className="quiet-label">renderer: DOM prototype</span>
      </div>

      <div className="spatial-world">
        <div className="world-grid" />
        <div className="world-zone zone-core">
          <span className="zone-label">CHECKOUT ROOM</span>
          <span className="zone-subtitle">{room.organization.focus}</span>
        </div>
        <div className="world-zone zone-observe">
          <span className="zone-label">OBSERVABILITY</span>
          <span className="zone-subtitle">Production healthy</span>
        </div>
        <div className="world-zone zone-execution">
          <span className="zone-label">EXECUTION BOARD</span>
          <span className="zone-subtitle">{room.decision.tasks.filter((task) => task.status === "proposed").length} proposed · {room.workItems.length} work items</span>
        </div>

        {room.actors.map((actor) => (
          <button
            className={`actor-token actor-token-${actor.type}`}
            key={actor.id}
            style={{ left: actor.position.x, top: actor.position.y }}
            type="button"
            title={`${actor.name} — ${actor.role}`}
          >
            <span className={`actor-orb orb-${actor.accent}`} aria-hidden="true">
              {actor.type === "agent" ? <span className="actor-token-marker actor-token-marker-agent" /> : <span className="actor-token-marker" />}
            </span>
            <span className="actor-token-copy">
              <strong>{actor.name}</strong>
              <small>{actor.status === "observing" ? "observing" : actor.role}</small>
            </span>
          </button>
        ))}

        <div className="spatial-status-card">
          <span className="status-dot status-dot-lime" />
          <div>
            <strong>{room.mode} · simulated presence</strong>
            <small>{room.decision.status} · verification pending</small>
          </div>
        </div>
      </div>
    </section>
  );
}
