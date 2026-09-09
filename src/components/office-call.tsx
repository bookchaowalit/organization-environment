"use client";
import { LiveKitRoom, VideoConference, useParticipants, useConnectionState } from "@livekit/components-react";
import "@livekit/components-styles";
import { useEffect, useState } from "react";
function CallStatus() {
  const participants = useParticipants();
  const connection = useConnectionState();
  return <p className="office-call-members" role="status">{connection} · {participants.length} คนในการสนทนา</p>;
}
function ProximityAudio({ volumes, enabled }: { volumes: Record<string, number>; enabled: boolean }) {
  const participants = useParticipants();
  useEffect(() => {
    for (const participant of participants) {
      if (participant.isLocal) continue;
      // Unknown/stale coordinates stay audible until the next presence poll;
      // only a known far-away participant is intentionally faded to silence.
      (participant as import("livekit-client").RemoteParticipant).setVolume(enabled ? (volumes[participant.identity] ?? 1) : 1);
    }
  }, [enabled, participants, volumes]);
  return null;
}
export function OfficeCall({ token, url, onLeave, proximity }: { token: string; url: string; onLeave: () => void; proximity: Record<string, number> }) {
  const [error, setError] = useState(false);
  const [proximityEnabled, setProximityEnabled] = useState(true);
  return <div className="office-call">{error ? <p role="alert">เชื่อมต่อเสียง/วิดีโอไม่สำเร็จ ตรวจ media server หรือสิทธิ์อุปกรณ์แล้วลองใหม่</p> : null}
    <LiveKitRoom token={token} serverUrl={url} connect audio={false} video={false}
      onDisconnected={onLeave} onError={() => setError(true)} data-lk-theme="default">
      <CallStatus /><ProximityAudio volumes={proximity} enabled={proximityEnabled} /><VideoConference />
    </LiveKitRoom><div className="office-call-actions"><button onClick={() => setProximityEnabled((value) => !value)}>
      เสียงตามระยะ: {proximityEnabled ? "เปิด" : "ปิด"}</button><button onClick={onLeave}>ออกจากการสนทนา</button></div></div>;
}
