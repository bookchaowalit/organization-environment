import type { Location } from "./contracts";

const NEAR_DISTANCE = 18;
const FAR_DISTANCE = 58;

/** Convert a room coordinate distance into a local audio volume. */
export function proximityVolume(distance: number) {
  if (!Number.isFinite(distance) || distance >= FAR_DISTANCE) return 0;
  if (distance <= NEAR_DISTANCE) return 1;
  return Math.round((1 - (distance - NEAR_DISTANCE) / (FAR_DISTANCE - NEAR_DISTANCE)) * 100) / 100;
}

export function proximityVolumes(origin: Location, people: Array<{ id: string; roomId: string; x: number; y: number }>) {
  return Object.fromEntries(people.filter((person) => person.id !== "self" && person.roomId === origin.roomId).map((person) => {
    const distance = Math.hypot(person.x - origin.x, person.y - origin.y);
    return [person.id, proximityVolume(distance)];
  }));
}
