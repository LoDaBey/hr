import { notFound } from 'next/navigation';

// No public job index. Jobs are only reachable at /jobs/[slug] via the link HR
// shares. Listing every open role publicly would expose roles that were never
// meant to be discoverable.
export default function JobsIndex() {
  notFound();
}
