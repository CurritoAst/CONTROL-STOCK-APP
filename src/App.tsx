import React, { useState } from 'react';
import { useAppContext } from './context/AppContext';
import { RoleSelect } from './components/RoleSelect';
import { Layout } from './components/Layout';
// Employee Pages
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';
import { UsageReport } from './pages/employee/UsageReport';
// Master Pages
import { MasterDashboard } from './pages/master/MasterDashboard';

const App: React.FC = () => {
  const { role } = useAppContext();
  const [masterTab, setMasterTab] = useState<'PANEL' | 'AUDIT' | 'CATALOG' | 'ANALYTICS' | 'CALENDAR' | 'POS'>('PANEL');
  const [employeeTab, setEmployeeTab] = useState<'PEDIDO' | 'REPORTES'>('PEDIDO');

  if (!role) {
    return <RoleSelect />;
  }

  return (
    <Layout
      activeTab={role === 'MASTER' ? masterTab : employeeTab}
      onTabChange={(tab: any) => role === 'MASTER' ? setMasterTab(tab) : setEmployeeTab(tab)}
    >
      {role === 'EMPLOYEE' ? (
        employeeTab === 'REPORTES' ? <UsageReport /> : <EmployeeDashboard />
      ) : (
        <MasterDashboard activeTab={masterTab} onTabChange={setMasterTab} />
      )}
    </Layout>
  );
};

export default App;
