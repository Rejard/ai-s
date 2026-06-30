import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, ShieldCheck,
  ArrowLeft, BarChart3, Home, Settings, Users, Activity, Timer
} from 'lucide-react';
import { useAdminLogic } from '../hooks/useAdminLogic';
import { ADMIN_DIAGNOSTIC_SECTIONS } from '../lib/adminDiagnosticsSections';

import AdminHomeTab from './admin/AdminHomeTab';
import AdminSettingsTab from './admin/AdminSettingsTab';
import AdminEvaluationTab from './admin/AdminEvaluationTab';
import AdminDiagnosticsTab from './admin/AdminDiagnosticsTab';
import AdminCouncilTab from './admin/AdminCouncilTab';
import AdminSchedulerTab from './admin/AdminSchedulerTab';

function AdminMobileDashboard({ walletAddress, managerEmail }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');
  const diagSections = ADMIN_DIAGNOSTIC_SECTIONS.map((section) => ({
    ...section,
    name: section.id === 'algorithm' ? `Core Algorithm Module (${section.count})` : section.id === 'infrastructure' ? `External Infra Integration (${section.count})` : section.id === 'security' ? `Security & Benchmark (${section.count})` : section.id === 'council' ? `Council Sub-tasks (${section.count})` : `Shadow Racing (${section.count})`
  }));

  const {
    managers,
    loading,
    promoteWallet,
    setPromoteWallet,
    submittingPromote,
    submittingDelete,
    globalAiModel,
    setGlobalAiModel,
    globalGeminiApiKey,
    setGlobalGeminiApiKey,
    globalAiInterval,
    setGlobalAiInterval,
    globalAiIntervalAuto,
    setGlobalAiIntervalAuto,
    globalGeminiTimeoutMs,
    setGlobalGeminiTimeoutMs,
    aidlContextMutationRate,
    setAidlContextMutationRate,
    aidlStateMutationRate,
    setAidlStateMutationRate,
    aidlProfileMutationRate,
    setAidlProfileMutationRate,
    aidlCopyNumberMutationRate,
    setAidlCopyNumberMutationRate,
    aidlWeightNudgeSize,
    setAidlWeightNudgeSize,
    savingAiConfig,
    isAdmin,
    handlePromoteManager,
    handleDeleteManager,
    handleSaveAiConfig,
    vaultSutBalance,
    stats,
    aiLogs,
    globalAiEngine,
    trainingDataCount,
    aisLastTrainedAt,
    aisModelAccuracy,
    aisTrainingStats,
    savingAiEngine,
    handleSaveAiEngine,
    councilStats,
    loadingCouncilStats,
    handleToggleAutomaticPromotion,
    submittingAidlGeneState,
    handleAidlGeneStateUpdate,
    submittingAidlGeneContext,
    handleAidlGeneContextUpdate,
    diagnosticsData,
    loadingDiagnostics,
    runningDiagnostics,
    runDiagnostics,
    schedulerData,
    loadingScheduler,
    fetchSchedulerHealth
  } = useAdminLogic(managerEmail);

  if (!isAdmin) {
    return (
      <div className="app-frame" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div className="glass-card" style={{ width: '100%', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', marginBottom: '20px' }}>
            <ShieldAlert size={48} color="var(--danger-color)" />
          </div>
          <h2 style={{ fontSize: '20px', color: '#FFF', fontWeight: '800', marginBottom: '12px' }}>접근 권한 보안 제한 (보안 통제 구역)</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
            본 화면은 플랫폼 총괄 관리자(Admin)만 진입할 수 있는 통제구역입니다. 등록된 관리자 이메일(lemaiiisk@gmail.com)로 연동해 주십시오.
          </p>
          <button className="btn-secondary" onClick={() => navigate('/dashboard')} style={{ width: '100%', padding: '12px' }}>
            대시보드로 복귀
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-frame">

      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px', borderBottom: '1px solid var(--glass-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: 0 }}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#FFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
            👑 최고 관리자(Admin) 제어 센터
          </h1>
        </div>
      </header>

      <main style={{ flex: 1, padding: '20px', paddingBottom: '85px', overflowY: 'auto' }}>

        <div className="glass-card" style={{ padding: '16px', marginBottom: '20px', background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.1) 0%, transparent 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-gradient)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '16px', fontWeight: 'bold', color: '#FFF' }}>
              A
            </div>
            <div>
              <h4 style={{ fontSize: '15px', color: '#FFF', margin: 0 }}>이명학 총괄 관리자 (Platform Owner)</h4>
              <span style={{ fontSize: '11px', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontWeight: '700' }}>
                <ShieldCheck size={12} /> 보안 인증 가동 중
              </span>
            </div>
          </div>
        </div>

        {activeTab === 'home' && (
          <AdminHomeTab
            vaultSutBalance={vaultSutBalance}
            stats={stats}
            loading={loading}
            managers={managers}
            submittingDelete={submittingDelete}
            handleDeleteManager={handleDeleteManager}
            promoteWallet={promoteWallet}
            setPromoteWallet={setPromoteWallet}
            handlePromoteManager={handlePromoteManager}
            submittingPromote={submittingPromote}
          />
        )}

        {activeTab === 'settings' && (
          <AdminSettingsTab
            globalAiModel={globalAiModel}
            setGlobalAiModel={setGlobalAiModel}
            globalGeminiApiKey={globalGeminiApiKey}
            setGlobalGeminiApiKey={setGlobalGeminiApiKey}
            globalAiInterval={globalAiInterval}
            setGlobalAiInterval={setGlobalAiInterval}
            globalAiIntervalAuto={globalAiIntervalAuto}
            setGlobalAiIntervalAuto={setGlobalAiIntervalAuto}
            globalGeminiTimeoutMs={globalGeminiTimeoutMs}
            setGlobalGeminiTimeoutMs={setGlobalGeminiTimeoutMs}
            aidlContextMutationRate={aidlContextMutationRate}
            setAidlContextMutationRate={setAidlContextMutationRate}
            aidlStateMutationRate={aidlStateMutationRate}
            setAidlStateMutationRate={setAidlStateMutationRate}
            aidlProfileMutationRate={aidlProfileMutationRate}
            setAidlProfileMutationRate={setAidlProfileMutationRate}
            aidlCopyNumberMutationRate={aidlCopyNumberMutationRate}
            setAidlCopyNumberMutationRate={setAidlCopyNumberMutationRate}
            aidlWeightNudgeSize={aidlWeightNudgeSize}
            setAidlWeightNudgeSize={setAidlWeightNudgeSize}
            savingAiConfig={savingAiConfig}
            handleSaveAiConfig={handleSaveAiConfig}
            aisTrainingStats={aisTrainingStats}
            globalAiEngine={globalAiEngine}
            savingAiEngine={savingAiEngine}
            handleSaveAiEngine={handleSaveAiEngine}
            trainingDataCount={trainingDataCount}
            aisLastTrainedAt={aisLastTrainedAt}
            aisModelAccuracy={aisModelAccuracy}
            handleToggleAutomaticPromotion={handleToggleAutomaticPromotion}
            councilStats={councilStats}
            submittingAidlGeneState={submittingAidlGeneState}
            handleAidlGeneStateUpdate={handleAidlGeneStateUpdate}
            submittingAidlGeneContext={submittingAidlGeneContext}
            handleAidlGeneContextUpdate={handleAidlGeneContextUpdate}
            managerEmail={managerEmail}
            aiLogs={aiLogs}
          />
        )}

        {activeTab === 'evaluation' && (
          <AdminEvaluationTab aisTrainingStats={aisTrainingStats} />
        )}

        {activeTab === 'diagnostics' && (
          <AdminDiagnosticsTab
            diagnosticsData={diagnosticsData}
            loadingDiagnostics={loadingDiagnostics}
            runningDiagnostics={runningDiagnostics}
            runDiagnostics={runDiagnostics}
          />
        )}

        {activeTab === 'council' && (
          <AdminCouncilTab
            councilStats={councilStats}
            loadingCouncilStats={loadingCouncilStats}
          />
        )}

        {activeTab === 'scheduler' && (
          <AdminSchedulerTab
            schedulerData={schedulerData}
            loadingScheduler={loadingScheduler}
            fetchSchedulerHealth={fetchSchedulerHealth}
          />
        )}

      </main>

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        background: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '12px 0 24px 0',
        zIndex: 100
      }}>
        <button
          onClick={() => setActiveTab('home')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'home' ? '#8B5CF6' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Home size={20} />
          <span style={{ fontSize: '9px', fontWeight: 'bold' }}>자산관제</span>
        </button>

        <button
          onClick={() => setActiveTab('council')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'council' ? '#8B5CF6' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Users size={20} />
          <span style={{ fontSize: '9px', fontWeight: 'bold' }}>AI 의회</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'settings' ? '#8B5CF6' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Settings size={20} />
          <span style={{ fontSize: '9px', fontWeight: 'bold' }}>AI 제어</span>
        </button>

        <button
          onClick={() => setActiveTab('evaluation')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'evaluation' ? '#8B5CF6' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <BarChart3 size={20} />
          <span style={{ fontSize: '9px', fontWeight: 'bold' }}>AI 평가</span>
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'diagnostics' ? '#8B5CF6' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Activity size={20} />
          <span style={{ fontSize: '9px', fontWeight: 'bold' }}>자가 진단</span>
        </button>

        <button
          onClick={() => setActiveTab('scheduler')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'scheduler' ? '#8B5CF6' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Timer size={20} />
          <span style={{ fontSize: '9px', fontWeight: 'bold' }}>스케줄러</span>
        </button>
      </div>
    </div>
  );
}

export default AdminMobileDashboard;
