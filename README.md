# @lp-labs/funnel-analysis

Deterministic bounded ordered user journeys with explicit windows, duplicates, ties and
exclusions. Descriptive analytics, **not inferred causality**. Independent MIT, Node >=18,
zero runtime/peer dependencies, ESM/CJS and strict typings.

## Install and quickstart

```sh
npm install @lp-labs/funnel-analysis
```

```js
import { analyzeFunnel } from '@lp-labs/funnel-analysis';

const report = analyzeFunnel(
  [
    { id: '2', userId: 'opaque-user', event: 'buy', timestamp: 10 },
    { id: '1', userId: 'opaque-user', event: 'view', timestamp: 0 },
  ],
  { steps: ['view', 'buy'], windowMs: 10, ties: 'id', duplicates: 'reject' },
);
console.log(report.counts, report.dropOff, report.conversion);
```

CommonJS: `const { analyzeFunnel } = require('@lp-labs/funnel-analysis')`.

## API and types

- `FunnelEvent`: readonly `id: string`, `userId: string`, `event: string`, `timestamp: number`.
  Labels accept 1–256 UTF-16 units; timestamps are nonnegative safe integers in a caller-chosen
  millisecond epoch. Unicode is preserved exactly; no identity normalization.
- `FunnelOptions`: required `steps: readonly string[]` (1–128; repeated labels allowed),
  `windowMs: number` (nonnegative safe integer); optional `excludeEvents: readonly string[]`
  (at most 128), `duplicates: 'reject' | 'first'` (default reject),
  `ties: 'input' | 'id'` (default input), `maxEvents` (default 100000, 1–1000000),
  `maxUsers` (default 10000, 1–100000).
- `analyzeFunnel(events: readonly FunnelEvent[], options: FunnelOptions): FunnelReport`.
- `FunnelJourney`: readonly `userId: string`, `reached: number`, `eventIds: readonly string[]`,
  `startedAt: number | null`, `completedAt: number | null`.
- `FunnelReport`: readonly `journeys: readonly FunnelJourney[]`,
  `excludedUsers: readonly string[]`, `counts: readonly number[]`, `dropOff: readonly number[]`,
  `conversion: number`, `duplicateCount: number`. All results/arrays are frozen.

## Ordering and attribution contract

Duplicate IDs are scoped to exact user ID. Reject by default; `first` keeps the first input
record **before sorting**, even if later duplicates have different timestamps/data.
Excluded events on retained records exclude the entire user, even outside the window.
Each remaining user is sorted by timestamp, then original input position or code-unit
lexicographic event ID. Equal-time records can advance steps only in that explicit order.
User output and exclusions are sorted by code-unit user ID, not locale.

One journey per nonexcluded user: choose the first chronological first-step event, then
greedily match subsequent steps within the inclusive window measured from that start.
No restarting after expiry; unrelated events do not reset the window. Each record matches
at most one step, including repeated steps; identical timestamps do not imply causation.
Users with no first step remain with reached zero and null times.

`counts[i]` counts users reaching step i. `dropOff[i] = counts[i] - counts[i+1]`;
final drop-off is zero. Conversion is final count / first count, or zero with no starts
(one-step funnels convert every starter). No multi-attempt attribution, session inference,
population exposure denominator, identity stitching, statistical confidence or causal effect.

## Errors, limits and privacy

Invalid records, labels, timestamps, policies, exclusions or steps throw `TypeError`;
invalid windows/capacities or exceeding events/users throws `RangeError`. Duplicate rejection
throws `TypeError`. Diagnostics contain no original IDs/values. Inputs are not mutated.
O(events log events) sorting and O(events + users + steps) retained data; raw input count,
including duplicates, consumes the batch bound. No streaming, implicit dropping or eviction.
Caller owns trusted data-object construction; getters/proxies are not sandboxed.

Reports deliberately retain user/event IDs. Supply pseudonymous IDs and privacy-safe event
labels, and enforce consent/retention outside this package. No PII detection, anonymity
guarantee, data transmission, persistence or background tasks.

## Development

`npm ci --offline`, `npm run build`, `npm run typecheck`, `npm test`, `npm run format`,
`npm run format:check`, `npm run prepack`. TypeScript ^5.9.3 and Prettier ^3.6.2 are dev-only.
Dual dist builds, dist-import tests and strict bare `.mts`/`.cts` consumers.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
