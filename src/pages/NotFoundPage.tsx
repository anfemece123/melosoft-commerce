import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-indigo-600 mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Página no encontrada
        </h1>
        <p className="text-gray-500 mb-8">
          La página que buscas no existe o fue movida.
        </p>

        <Link
          to="/admin"
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Ir al panel
        </Link>
      </div>
    </div>
  );
}
