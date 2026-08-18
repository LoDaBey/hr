import { EditJobView } from './components/EditJobView';

export default async function HrJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <EditJobView jobId={jobId} />;
}
