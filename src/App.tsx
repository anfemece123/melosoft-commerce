import { useAuthBootstrap } from '@/features/auth/useAuthBootstrap';
import { AppRouter } from '@/routes/AppRouter';
import { AppToaster } from '@/components/ui/AppToaster';

export default function App() {
  useAuthBootstrap();
  return (
    <>
      <AppRouter />
      <AppToaster />
    </>
  );
}
