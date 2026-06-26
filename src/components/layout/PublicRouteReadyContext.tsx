import { createContext, useContext } from 'react';

interface PublicRouteReadyContextValue {
  setRouteReady: (ready: boolean) => void;
}

const PublicRouteReadyContext = createContext<PublicRouteReadyContextValue>({
  setRouteReady: () => {},
});

export function PublicRouteReadyProvider({
  value,
  children,
}: {
  value: PublicRouteReadyContextValue;
  children: React.ReactNode;
}) {
  return (
    <PublicRouteReadyContext.Provider value={value}>
      {children}
    </PublicRouteReadyContext.Provider>
  );
}

export function usePublicRouteReady() {
  return useContext(PublicRouteReadyContext);
}
