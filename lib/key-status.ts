export type KeyStatus =
  | "available"
  | "assigned"
  | "lost"
  | "damaged"
  | "retired";

export function canAssign(status: KeyStatus) {
  return status === "available";
}

export function canReturn(status: KeyStatus) {
  return status === "assigned";
}

export function canMarkLost(status: KeyStatus) {
  return status === "available" || status === "assigned";
}

export function canMarkDamaged(status: KeyStatus) {
  return status === "available" || status === "assigned";
}

export function canMarkRetired(status: KeyStatus) {
  return status !== "retired";
}