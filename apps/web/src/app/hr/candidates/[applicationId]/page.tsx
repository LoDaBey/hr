import { CandidateDetailView } from './components/CandidateDetailView';

export default async function HrCandidateDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  return <CandidateDetailView applicationId={applicationId} />;
}
