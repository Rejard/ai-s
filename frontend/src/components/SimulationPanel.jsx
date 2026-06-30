import React from 'react';
import { API_BASE } from '../App';
import { buildAuthHeaders } from '../lib/authSession';

const SCALE_OPTIONS = [
  { value: 'small', label: 'Small (1만 세대)', description: '~3분 소요', color: '#4ade80' },
  { value: 'medium', label: 'Medium (10만 세대)', description: '~30분 소요', color: '#facc15' },
  { value: 'large', label: 'Large (100만 세대)', description: '~5시간 소요', color: '#f87171' },
];

const STATUS_LABELS = {
  IDLE: '\ub300\uae30 \uc911',
  COLLECTING_DATA: '\ub370\uc774\ud130 \uc218\uc9d1 \uc911...',
  LOADING_POPULATION: '\uc778\uad6c \ub85c\ub529 \uc911...',
  EVOLVING: '\uc9c4\ud654 \uc2dc\ubbac\ub808\uc774\uc158 \uc911...',
  SAVING: 'DB \uc800\uc7a5 \uc911...',
  COMPLETED: '\uc644\ub8cc',
  CANCELLED: '\ucde8\uc18c\ub428',
  ERROR: '\uc624\ub958 \ubc1c\uc0dd',
};

export default function SimulationPanel({ managerEmail }) {
  const [status, setStatus] = React.useState({ status: 'IDLE', progress: 0 });
  const [selectedScale, setSelectedScale] = React.useState('small');
  const [starting, setStarting] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const pollRef = React.useRef(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/simulation/status`, {
        headers: buildAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        const isActive = ['EVOLVING', 'COLLECTING_DATA', 'LOADING_POPULATION', 'SAVING'].includes(data.status);
        if (isActive && !pollRef.current) {
          pollRef.current = setInterval(fetchStatus, 2000);
        }
        if (!isActive && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch { /* */ }
  }, []);

  React.useEffect(() => {
    fetchStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus]);

  const startSimulation = async () => {
    setStarting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/simulation/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        body: JSON.stringify({ scale: selectedScale }),
      });
      const data = await res.json().catch(() => ({}));
      console.log('[SimPanel] start response:', res.status, data);
      if (res.ok) {
        pollRef.current = setInterval(fetchStatus, 2000);
        fetchStatus();
      }
    } catch (err) {
      console.error('[SimPanel] start error:', err);
    }
    setStarting(false);
  };

  const cancelSim = async () => {
    setCancelling(true);
    try {
      await fetch(`${API_BASE}/admin/simulation/cancel`, {
        method: 'POST',
        headers: buildAuthHeaders(),
      });
      fetchStatus();
    } catch { /* */ }
    setCancelling(false);
  };

  const isRunning = ['EVOLVING', 'COLLECTING_DATA', 'LOADING_POPULATION', 'SAVING'].includes(status.status);

  const clusterEntries = status.clusterStats ? Object.entries(status.clusterStats) : [];
  const clusterTotal = clusterEntries.reduce((sum, [, count]) => sum + count, 0);

  const factionColors = {
    BLACK_SWAN_SENTINEL: '#a855f7',
    EXPRESSION_DOMINANT: '#3b82f6',
    DECAY_RESISTANT: '#6b7280',
    MUTAGEN_ADAPTIVE: '#22c55e',
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0c0c1d 0%, #1a1a2e 50%, #16213e 100%)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      marginTop: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <span style={{ fontSize: '24px' }}>🧬</span>
        <h3 style={{ color: '#e0e7ff', margin: 0, fontSize: '18px', fontWeight: 700 }}>
          Mass Evolution Simulation
        </h3>
        <span style={{
          background: isRunning ? '#059669' : status.status === 'COMPLETED' ? '#2563eb' : '#374151',
          color: '#fff',
          padding: '2px 10px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 600,
        }}>
          {STATUS_LABELS[status.status] || status.status}
        </span>
      </div>

      {!isRunning && status.status !== 'SAVING' && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            {SCALE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedScale(opt.value)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: selectedScale === opt.value
                    ? `2px solid ${opt.color}`
                    : '1px solid rgba(255,255,255,0.1)',
                  background: selectedScale === opt.value
                    ? `${opt.color}15`
                    : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ color: opt.color, fontWeight: 700, fontSize: '14px' }}>{opt.label}</div>
                <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '4px' }}>{opt.description}</div>
              </button>
            ))}
          </div>
          <button
            onClick={startSimulation}
            disabled={starting}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 700,
              cursor: starting ? 'wait' : 'pointer',
              opacity: starting ? 0.6 : 1,
            }}
          >
            {starting ? 'Starting...' : `🚀 Start ${SCALE_OPTIONS.find(o => o.value === selectedScale)?.label} Simulation`}
          </button>
        </div>
      )}

      {isRunning && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>
              Generation {(status.generation || 0).toLocaleString()} / {(status.totalGenerations || 0).toLocaleString()}
            </span>
            <span style={{ color: '#a5b4fc', fontWeight: 700, fontSize: '14px' }}>
              {status.progress || 0}%
            </span>
          </div>
          <div style={{
            height: '8px',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${status.progress || 0}%`,
              borderRadius: '4px',
              background: 'linear-gradient(90deg, #6366f1, #a855f7)',
              transition: 'width 0.5s ease',
            }} />
          </div>

          {status.bestFitness > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '10px',
              marginTop: '12px',
            }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ color: '#9ca3af', fontSize: '11px' }}>Best Fitness</div>
                <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '16px' }}>{status.bestFitness?.toFixed(4)}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ color: '#9ca3af', fontSize: '11px' }}>Avg Fitness</div>
                <div style={{ color: '#facc15', fontWeight: 700, fontSize: '16px' }}>{status.avgFitness?.toFixed(4)}</div>
              </div>
              {status.validationFitness !== undefined && (
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ color: '#9ca3af', fontSize: '11px' }}>Validation</div>
                  <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '16px' }}>{status.validationFitness?.toFixed(4)}</div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={cancelSim}
            disabled={cancelling}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.1)',
              color: '#f87171',
              fontSize: '13px',
              fontWeight: 600,
              cursor: cancelling ? 'wait' : 'pointer',
              marginTop: '12px',
            }}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Simulation'}
          </button>
        </div>
      )}

      {status.status === 'COMPLETED' && clusterEntries.length > 0 && (
        <div style={{
          background: 'rgba(99,102,241,0.08)',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid rgba(99,102,241,0.15)',
        }}>
          <div style={{ color: '#a5b4fc', fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>
            Evolution Result — Faction Distribution
          </div>

          <div style={{
            display: 'flex',
            height: '24px',
            borderRadius: '6px',
            overflow: 'hidden',
            marginBottom: '12px',
          }}>
            {clusterEntries.map(([name, count]) => (
              <div
                key={name}
                style={{
                  width: `${(count / clusterTotal) * 100}%`,
                  background: factionColors[name] || '#6b7280',
                  transition: 'width 0.3s ease',
                }}
                title={`${name}: ${count}`}
              />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {clusterEntries.map(([name, count]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: factionColors[name] || '#6b7280',
                }} />
                <span style={{ color: '#d1d5db', fontSize: '12px' }}>
                  {name}: <strong>{count}</strong> ({((count / clusterTotal) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>

          {status.bestFitness > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '16px' }}>
              <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                Best: <span style={{ color: '#4ade80', fontWeight: 700 }}>{status.bestFitness?.toFixed(4)}</span>
              </span>
              <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                Avg: <span style={{ color: '#facc15', fontWeight: 700 }}>{status.avgFitness?.toFixed(4)}</span>
              </span>
              <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                Duration: {status.startedAt && status.completedAt
                  ? `${Math.round((new Date(status.completedAt) - new Date(status.startedAt)) / 1000)}s`
                  : '-'}
              </span>
            </div>
          )}
        </div>
      )}

      {status.candleData && (
        <div style={{
          marginTop: '12px',
          display: 'flex',
          gap: '12px',
          color: '#6b7280',
          fontSize: '11px',
        }}>
          <span>Cached Candles: {status.candleData.count?.toLocaleString() || 0}</span>
          {status.candleData.earliest && <span>From: {status.candleData.earliest.slice(0, 10)}</span>}
          {status.candleData.latest && <span>To: {status.candleData.latest.slice(0, 10)}</span>}
        </div>
      )}
    </div>
  );
}
