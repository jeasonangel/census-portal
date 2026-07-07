import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import DataExplorer from './pages/DataExplorer';
import ApiKeyManager from './pages/ApiKeyManager';
import AdminUsers from './pages/AdminUsers';
import DataImport from './pages/DataImport';
import Login from './pages/Login';
import Register from './pages/Register';
import UpgradePlan from './pages/UpgradePlan';
import ApiDocs from './pages/ApiDocs';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-cam-ink">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explorer" element={<DataExplorer />} />
          <Route path="/api-keys" element={<ApiKeyManager />} />
          <Route path="/upgrade" element={<UpgradePlan />} />
          <Route path="/docs" element={<ApiDocs />} />
          <Route path="/admin" element={<AdminUsers />} />
          <Route path="/admin/import" element={<DataImport />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}