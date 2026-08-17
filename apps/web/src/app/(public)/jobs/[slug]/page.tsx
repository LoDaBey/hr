import { Container } from '@mantine/core';
import { notFound } from 'next/navigation';
import { getPublicJob } from '@/lib/repos/jobs';
import { ClosedJobNotice } from './components/ClosedJobNotice';
import { JobDetailView } from './components/JobDetailView';

export const dynamic = 'force-dynamic';

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPublicJob(slug);
  if (!result.ok && result.code === 'NOT_FOUND') notFound();
  if (!result.ok) return <ClosedJobNotice />;

  return (
    <Container py="xl">
      <JobDetailView job={result.job} />
    </Container>
  );
}
