export type DiffType = "added" | "removed" | "changed" | "unchanged";

export interface DiffNode {
  type: DiffType;
  value?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
  children?: Record<string, DiffNode>;
  isArray?: boolean;
}

export function computeJsonDiff(oldVal: unknown, newVal: unknown): DiffNode {
  if (oldVal === newVal) {
    return { type: "unchanged", value: newVal };
  }

  // Primitive equality (also handles null)
  if (
    typeof oldVal !== "object" &&
    typeof newVal !== "object" &&
    oldVal === newVal
  ) {
    return { type: "unchanged", value: newVal };
  }

  if (oldVal === undefined) {
    return { type: "added", value: newVal };
  }

  if (newVal === undefined) {
    return { type: "removed", value: oldVal };
  }

  const oldIsObj = typeof oldVal === "object" && oldVal !== null;
  const newIsObj = typeof newVal === "object" && newVal !== null;

  // If one is primitive and the other is object, or if types fundamentally changed
  if (!oldIsObj || !newIsObj) {
    return { type: "changed", oldValue: oldVal, newValue: newVal };
  }

  const oldIsArr = Array.isArray(oldVal);
  const newIsArr = Array.isArray(newVal);

  if (oldIsArr !== newIsArr) {
    return { type: "changed", oldValue: oldVal, newValue: newVal };
  }

  const children: Record<string, DiffNode> = {};
  let allUnchanged = true;

  const oldRecord = oldVal as Record<string, unknown>;
  const newRecord = newVal as Record<string, unknown>;

  const allKeys = new Set([
    ...Object.keys(oldRecord),
    ...Object.keys(newRecord),
  ]);

  for (const key of allKeys) {
    const childDiff = computeJsonDiff(oldRecord[key], newRecord[key]);
    children[key] = childDiff;
    if (childDiff.type !== "unchanged") {
      allUnchanged = false;
    }
  }

  if (allUnchanged) {
    return { type: "unchanged", value: newVal };
  }

  return { type: "changed", children, isArray: newIsArr };
}
