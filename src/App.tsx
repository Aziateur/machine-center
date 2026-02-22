import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import CaptureBar from './components/CaptureBar';
import Dashboard from './pages/Dashboard';
import Whiteboard from './pages/Whiteboard';
import Inbox from './pages/Inbox';
import './styles/index.css';

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/machine/:machineId" element={<Whiteboard />} />
          <Route path="/inbox" element={<Inbox />} />
        </Routes>
        <CaptureBar />
        {import.meta.env.DEV && (
          <div className="dev-mode-badge">DEV</div>
        )}
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
