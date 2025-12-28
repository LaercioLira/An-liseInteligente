
import React from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { AppTab } from './types';

const App: React.FC = () => {
  return (
    <Layout activeTab={AppTab.DASHBOARD} setActiveTab={() => {}}>
      <Dashboard />
    </Layout>
  );
};

export default App;
