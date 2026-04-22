import React, { useState, Suspense, lazy } from 'react';
import { useAppContext } from './context/AppContext';
import { RoleSelect } from './components/RoleSelect';
import { Layout } from './components/Layout';

// Lazy loaded pages to optimize bundle size and improve LCP/FCP
const EmployeeDashboard = lazy(() => import('./pages/employee/EmployeeDashboard').then(m => ({ default: m.EmployeeDashboard })));
const UsageReport = lazy(() => import('./pages/employee/UsageReport').then(m => ({ default: m.UsageReport })));
const MasterDashboard = lazy(() => import('./pages/master/MasterDashboard').then(m => ({ default: m.MasterDashboard })));
const SaulDashboard = lazy(() => import('./pages/viewer/SaulDashboard').then(m => ({ default: m.SaulDashboard })));

const FallbackLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-bg-primary">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-blue"></div>
  </div>
);

const App: React.FC = () => {
  const { role } = useAppContext();
  const [masterTab, setMasterTab] = useState<'PANEL' | 'AUDIT' | 'CATALOG' | 'ANALYTICS' | 'CALENDAR' | 'POS' | 'CREATE'>('PANEL');
  const [employeeTab, setEmployeeTab] = useState<'PEDIDO' | 'REPORTES'>('PEDIDO');

  if (!role) {
    return <RoleSelect />;
  }

  if (role === 'VIEWER') {
    return (
      <Suspense fallback={<FallbackLoader />}>
        <SaulDashboard />
      </Suspense>
    );
  }

  return (
    <Layout
      activeTab={role === 'MASTER' ? masterTab : employeeTab}
      onTabChange={(tab: any) => role === 'MASTER' ? setMasterTab(tab) : setEmployeeTab(tab)}
    >
      <Suspense fallback={<FallbackLoader />}>
        {role === 'EMPLOYEE' ? (
          employeeTab === 'REPORTES' ? <UsageReport /> : <EmployeeDashboard />
        ) : (
          <MasterDashboard activeTab={masterTab} onTabChange={setMasterTab} />
        )}
      </Suspense>
    </Layout>
  );
};

export default App;
