import { redirect } from 'next/navigation';

// There is no public landing page. The only public surface is a single job's
// application form, reached by its slug link, which HR shares directly.
// Everything else requires a session.
export default function Home() {
  redirect('/hr');
}
