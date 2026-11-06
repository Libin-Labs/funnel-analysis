import { analyzeFunnel } from '@lp-labs/funnel-analysis';
import type {
  FunnelEvent,
  FunnelOptions,
  FunnelJourney,
  FunnelReport,
} from '@lp-labs/funnel-analysis';
const event: FunnelEvent = { id: '1', userId: 'pseudonym', event: 'view', timestamp: 0 };
const options: FunnelOptions = { steps: ['view'], windowMs: 10, ties: 'id' };
const report: FunnelReport = analyzeFunnel([event], options);
const journey: FunnelJourney | undefined = report.journeys[0];
void journey;
// @ts-expect-error unsupported tie policy
analyzeFunnel([], { ...options, ties: 'random' });
// @ts-expect-error report counts are readonly
report.counts.push(1);
