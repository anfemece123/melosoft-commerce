import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export function StorefrontBackButton({
  storeSlug,
  className = '',
  color,
  label = 'Volver a la tienda',
}: {
  storeSlug: string;
  className?: string;
  color: string;
  label?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBackToStorefront = location.state?.fromStorefront === true;
  const fromPath = typeof location.state?.fromPath === 'string' ? location.state.fromPath : null;

  function handleBack() {
    if (canGoBackToStorefront && fromPath) {
      navigate(fromPath, {
        replace: true,
        state: { fromStorefront: true, restoreScroll: true, restoreScrollKey: fromPath },
      });
      return;
    }

    navigate(`/s/${storeSlug}`);
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 ${className}`.trim()}
      style={{ color }}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
