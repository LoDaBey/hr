import { ErrorsView } from './components/ErrorsView';

export default function HrErrorsPage() {
  const showDispatchButton = process.env.NODE_ENV !== 'production';
  const cronSecret = showDispatchButton ? (process.env.CRON_SECRET ?? null) : null;

  return (
    <ErrorsView showDispatchButton={showDispatchButton} cronSecret={cronSecret} />
  );
}
