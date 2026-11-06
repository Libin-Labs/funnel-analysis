export interface FunnelEvent {
  readonly id: string;
  readonly userId: string;
  readonly event: string;
  readonly timestamp: number;
}
export interface FunnelOptions {
  readonly steps: readonly string[];
  readonly windowMs: number;
  readonly excludeEvents?: readonly string[];
  readonly duplicates?: 'reject' | 'first';
  readonly ties?: 'input' | 'id';
  readonly maxEvents?: number;
  readonly maxUsers?: number;
}
export interface FunnelJourney {
  readonly userId: string;
  readonly reached: number;
  readonly eventIds: readonly string[];
  readonly startedAt: number | null;
  readonly completedAt: number | null;
}
export interface FunnelReport {
  readonly journeys: readonly FunnelJourney[];
  readonly excludedUsers: readonly string[];
  readonly counts: readonly number[];
  /** Number reaching a step but not the next; final step has zero drop-off. */
  readonly dropOff: readonly number[];
  readonly conversion: number;
  readonly duplicateCount: number;
}
function label(value: string): void {
  if (typeof value !== 'string' || !value || value.length > 256)
    throw new TypeError('Funnel labels must contain 1 to 256 UTF-16 units.');
}
function bound(value: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    throw new RangeError('Invalid funnel capacity.');
  return value;
}
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
export function analyzeFunnel(
  events: readonly FunnelEvent[],
  options: FunnelOptions,
): FunnelReport {
  if (
    !options ||
    !Array.isArray(options.steps) ||
    !options.steps.length ||
    options.steps.length > 128
  )
    throw new TypeError('Supply 1 to 128 funnel steps.');
  const steps = options.steps.slice();
  steps.forEach(label);
  if (!Number.isSafeInteger(options.windowMs) || options.windowMs < 0)
    throw new RangeError('Window must be a nonnegative safe integer.');
  const window = options.windowMs;
  const maxEvents = bound(options.maxEvents ?? 100_000, 1_000_000);
  const maxUsers = bound(options.maxUsers ?? 10_000, 100_000);
  const duplicates = options.duplicates ?? 'reject';
  const ties = options.ties ?? 'input';
  if (!['reject', 'first'].includes(duplicates) || !['input', 'id'].includes(ties))
    throw new TypeError('Invalid duplicate or tie policy.');
  if (
    options.excludeEvents !== undefined &&
    (!Array.isArray(options.excludeEvents) || options.excludeEvents.length > 128)
  )
    throw new TypeError('Invalid exclusion list.');
  const excludedEvents = new Set(options.excludeEvents ?? []);
  excludedEvents.forEach(label);
  if (!Array.isArray(events)) throw new TypeError('Events must be an array.');
  if (events.length > maxEvents) throw new RangeError('Event capacity exceeded.');
  const users = new Map<
    string,
    { events: (FunnelEvent & { order: number })[]; ids: Set<string> }
  >();
  let duplicateCount = 0;
  events.forEach((event, order) => {
    if (!event || typeof event !== 'object') throw new TypeError('Invalid funnel event.');
    label(event.id);
    label(event.userId);
    label(event.event);
    if (!Number.isSafeInteger(event.timestamp) || event.timestamp < 0)
      throw new TypeError('Timestamps must be nonnegative safe integers.');
    let user = users.get(event.userId);
    if (!user) {
      if (users.size >= maxUsers) throw new RangeError('User capacity exceeded.');
      user = { events: [], ids: new Set() };
      users.set(event.userId, user);
    }
    if (user.ids.has(event.id)) {
      if (duplicates === 'reject') throw new TypeError('Duplicate user event ID.');
      duplicateCount++;
      return;
    }
    user.ids.add(event.id);
    user.events.push({
      id: event.id,
      userId: event.userId,
      event: event.event,
      timestamp: event.timestamp,
      order,
    });
  });
  const journeys: FunnelJourney[] = [];
  const excludedUsers: string[] = [];
  const counts = steps.map(() => 0);
  for (const [userId, user] of [...users].sort(([a], [b]) => compare(a, b))) {
    if (user.events.some((event) => excludedEvents.has(event.event))) {
      excludedUsers.push(userId);
      continue;
    }
    user.events.sort(
      (a, b) =>
        a.timestamp - b.timestamp || (ties === 'id' ? compare(a.id, b.id) : a.order - b.order),
    );
    const eventIds: string[] = [];
    let startedAt: number | null = null;
    let completedAt: number | null = null;
    for (const event of user.events) {
      if (eventIds.length === steps.length) break;
      if (startedAt !== null && event.timestamp - startedAt > window) break;
      if (event.event !== steps[eventIds.length]) continue;
      if (startedAt === null) startedAt = event.timestamp;
      eventIds.push(event.id);
      counts[eventIds.length - 1]!++;
      if (eventIds.length === steps.length) completedAt = event.timestamp;
    }
    journeys.push(
      Object.freeze({
        userId,
        reached: eventIds.length,
        eventIds: Object.freeze(eventIds),
        startedAt,
        completedAt,
      }),
    );
  }
  return Object.freeze({
    journeys: Object.freeze(journeys),
    excludedUsers: Object.freeze(excludedUsers),
    counts: Object.freeze(counts),
    dropOff: Object.freeze(
      counts.map((count, i) => (i + 1 === counts.length ? 0 : count - counts[i + 1]!)),
    ),
    conversion: counts[0] ? counts[counts.length - 1]! / counts[0] : 0,
    duplicateCount,
  });
}
