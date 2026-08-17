'use client';

import { use } from 'react';
import { CandidateDetailView } from './components/CandidateDetailView';

export default function HrCandidateDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = use(params);
  return <CandidateDetailView applicationId={applicationId} />;
}
