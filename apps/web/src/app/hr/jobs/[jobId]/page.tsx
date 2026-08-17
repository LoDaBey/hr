'use client';

import { use } from 'react';
import { EditJobView } from './components/EditJobView';

export default function HrJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  return <EditJobView jobId={jobId} />;
}
