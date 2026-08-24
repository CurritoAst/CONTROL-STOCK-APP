import React, { useState, Suspense, lazy } from 'react';
import { useAppContext } from './context/AppContext';
import { RoleSelect } from './components/RoleSelect';
import { Layout } from './components/Layout';

export type MainTab = 'PANEL' | 'PEDIDOS' | 'CALENDAR' | 'CATALOG';

// Lazy loaded pages to keep the initial bundle small
const Dashboard = lazy(() => import('./pages/master/Dashboard').then(m => ({ default: m.Dashboard })));
const Pedidos = lazy(() => import('./pages/master/Pedidos').then(m => ({ default: m.Pedidos })));
const FeriaCalendar = lazy(() => import('./pages/master/FeriaCalendar').then(m => ({ default: m.FeriaCalendar })));
const ProductCatalog = lazy(() => import('./pages/master/ProductCatalog').then(m => ({ default: m.ProductCatalog })));

const FallbackLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-bg-primary">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-blue"></div>
  </div>
);

const App: React.FC = () => {
  const { role } = useAppContext();
  const [tab, setTab] = useState<MainTab>('PANEL');

  if (!role) {
    return <RoleSelect />;
  }

  return (
    <Layout activeTab={tab} onTabChange={setTab}>
      <Suspense fallback={<FallbackLoader />}>
        {tab === 'PANEL' && <Dashboard onGoToPedidos={() => setTab('PEDIDOS')} />}
        {tab === 'PEDIDOS' && <Pedidos />}
        {tab === 'CALENDAR' && <FeriaCalendar />}
        {tab === 'CATALOG' && <ProductCatalog />}
      </Suspense>
    </Layout>
  );
};

export default App;
