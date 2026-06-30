import React, { useState } from 'react';
import { Loader2, Receipt } from 'lucide-react';
import { API_BASE } from '../../App';
import AisTrainingEvidence from '../../components/AisTrainingEvidence';
import SimulationPanel from '../../components/SimulationPanel';
import { formatKoreanDateTime } from '../../lib/dateTime';
import { downloadAuthenticatedFile } from '../../lib/authSession';

function AdminSettingsTab({
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
  handleSaveAiConfig,
  aisTrainingStats,
  globalAiEngine,
  savingAiEngine,
  handleSaveAiEngine,
  trainingDataCount,
  aisLastTrainedAt,
  aisModelAccuracy,
  handleToggleAutomaticPromotion,
  councilStats,
  submittingAidlGeneState,
  handleAidlGeneStateUpdate,
  submittingAidlGeneContext,
  handleAidlGeneContextUpdate,
  managerEmail,
  aiLogs
}) {
  const [historyFilter, setHistoryFilter] = useState('ALL');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
        <h4 style={{ fontSize: '15px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>AI</span> 글로벌 AI 엔진 제어
        </h4>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
          플랫폼 전체에서 공통으로 사용하는 AI 모델, API Key, 분석 주기, 응답 대기시간, AIDL 변이 정책을 설정합니다.
        </p>

        <form onSubmit={handleSaveAiConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>사용 AI 모델</label>
            <select
              className="form-select"
              value={globalAiModel}
              onChange={(e) => setGlobalAiModel(e.target.value)}
              style={{ padding: '14px', fontSize: '13px' }}
            >
              <option value="Gemini 3.5 Flash">Gemini 3.5 Flash (입력 $0.075 / 출력 $0.30 / 100만 토큰)</option>
              <option value="Gemini 2.5 Pro">Gemini 2.5 Pro (입력 $1.25 / 출력 $5.00 / 100만 토큰)</option>
              <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (입력 $0.075 / 출력 $0.30 / 100만 토큰)</option>
              <option value="Gemini 3.1 Flash Lite">Gemini 3.1 Flash Lite (입력 $0.0375 / 출력 $0.15 / 100만 토큰)</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Gemini API Key</label>
            <input
              type="password"
              value={globalGeminiApiKey}
              onChange={(e) => setGlobalGeminiApiKey(e.target.value)}
              placeholder="AI Studio에서 발급받은 API Key를 입력해 주세요"
              className="form-input"
              style={{ padding: '14px', fontSize: '13px' }}
            />
            <div style={{ fontSize: '10px', color: 'var(--danger-color)', marginTop: '6px' }}>
              * 보안을 위해 서버 운영 설정에 저장됩니다.
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>AI 분석 주기 (분)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', opacity: globalAiIntervalAuto === 'ON' ? 0.4 : 1, pointerEvents: globalAiIntervalAuto === 'ON' ? 'none' : 'auto' }}>
              {['1', '3', '5', '10', '15', '30', '60'].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  disabled={globalAiIntervalAuto === 'ON'}
                  onClick={() => setGlobalAiInterval(mins)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: globalAiIntervalAuto === 'ON' ? 'not-allowed' : 'pointer',
                    border: globalAiInterval === mins ? '1px solid #3B82F6' : '1px solid rgba(255,255,255,0.1)',
                    background: globalAiInterval === mins ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.2)',
                    color: globalAiInterval === mins ? '#60A5FA' : '#9CA3AF',
                    transition: 'all 0.2s'
                  }}
                >
                  {mins}분
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '12px' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '12px', color: '#FFF', fontWeight: 'bold' }}>AI 분석 주기 자동 최적화</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>시장 변동성에 맞춰 5분, 15분, 30분 간격으로 자동 전환합니다.</div>
              </div>
              <input
                type="checkbox"
                checked={globalAiIntervalAuto === 'ON'}
                onChange={(e) => setGlobalAiIntervalAuto(e.target.checked ? 'ON' : 'OFF')}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3B82F6' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '12px' }}>Gemini 응답 대기시간 (ms)</label>
              <input
                type="number"
                min="5000"
                max="120000"
                step="1000"
                value={globalGeminiTimeoutMs}
                onChange={(e) => setGlobalGeminiTimeoutMs(e.target.value)}
                className="form-input"
                style={{ padding: '14px', fontSize: '13px' }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
                5000~120000ms 범위에서 설정합니다. Gemini 호출이 너무 빨리 끊기거나 너무 오래 대기하지 않도록 조정하는 값입니다.
              </div>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '12px' }}>AIDL 상황 마스크 변이율</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={aidlContextMutationRate}
                onChange={(e) => setAidlContextMutationRate(e.target.value)}
                className="form-input"
                style={{ padding: '14px', fontSize: '13px' }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-dark)', marginTop: '4px', textAlign: 'left', lineHeight: '1.4' }}>
                * 장세 판단 필터 변경 빈도 (▲ 민감 대처 / ▼ 안정성)
              </div>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '12px' }}>AIDL 노드 활성 변이율</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={aidlStateMutationRate}
                onChange={(e) => setAidlStateMutationRate(e.target.value)}
                className="form-input"
                style={{ padding: '14px', fontSize: '13px' }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-dark)', marginTop: '4px', textAlign: 'left', lineHeight: '1.4' }}>
                * 의원 유전자 세대교체 주기 (▲ 빠른 수혈 / ▼ 에이스 유지)
              </div>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '12px' }}>AIDL 생체 특성 변이율</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={aidlProfileMutationRate}
                onChange={(e) => setAidlProfileMutationRate(e.target.value)}
                className="form-input"
                style={{ padding: '14px', fontSize: '13px' }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-dark)', marginTop: '4px', textAlign: 'left', lineHeight: '1.4' }}>
                * 기본 예산/규격 변동 빈도 (▲ 혁신 변칙 / ▼ 안전 튜닝)
              </div>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '12px' }}>AIDL 유전자 복제수 변이율</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={aidlCopyNumberMutationRate}
                onChange={(e) => setAidlCopyNumberMutationRate(e.target.value)}
                className="form-input"
                style={{ padding: '14px', fontSize: '13px' }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-dark)', marginTop: '4px', textAlign: 'left', lineHeight: '1.4' }}>
                * 의석 지분율 조정 빈도 (▲ 특정 전략 몰빵 / ▼ 다수 합의)
              </div>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '12px' }}>AIDL 가중치 미세 조정 폭</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={aidlWeightNudgeSize}
                onChange={(e) => setAidlWeightNudgeSize(e.target.value)}
                className="form-input"
                style={{ padding: '14px', fontSize: '13px' }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-dark)', marginTop: '4px', textAlign: 'left', lineHeight: '1.4' }}>
                * 매수·매도 타점 변경 보폭 (▲ 시점 변형 / ▼ 정밀 조준)
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={savingAiConfig}
            style={{ width: '100%', padding: '14px', fontSize: '14px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
          >
            {savingAiConfig ? <Loader2 size={16} className="spin" /> : '글로벌 AI 설정 저장'}
          </button>
        </form>
      </div>


      {aisTrainingStats && (
      <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(0,200,255,0.25)', marginTop: '20px' }}>
        <h4 style={{ fontSize: '15px', color: '#FFF', margin: '0 0 4px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🏎️</span> Shadow Racing — 모드별 적중률 비교
        </h4>
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '14px' }}>
          마지막 분석: {aisTrainingStats.byModeLastUpdated?.GEMINI || aisTrainingStats.byModeLastUpdated?.AIS_ONLY || '---'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '6px 14px', fontSize: 12 }}>
          <div style={{ fontWeight: 600, color: '#888' }}></div>
          <div style={{ fontWeight: 600, color: '#4dabf7', textAlign: 'center' }}>GEMINI</div>
          <div style={{ fontWeight: 600, color: '#69db7c', textAlign: 'center' }}>AiS</div>
          <div style={{ fontWeight: 600, color: '#ffa94d', textAlign: 'center' }}>HYBRID</div>

          {['BUY', 'SELL', 'HOLD'].map(dec => {
            const label = dec === 'BUY' ? '매수(BUY)' : dec === 'SELL' ? '매도(SELL)' : '관망(HOLD)';
            return (
              <React.Fragment key={dec}>
                <div style={{ color: '#aaa', fontWeight: 500 }}>{label}</div>
                {['GEMINI', 'AIS_ONLY', 'HYBRID_COOP'].map(mode => {
                  const d = aisTrainingStats.byModeDecision?.[mode]?.[dec];
                  return (
                    <div key={mode} style={{ textAlign: 'center', color: d && d.total > 0 ? '#e0e0e0' : '#555' }}>
                      {d && d.total > 0 ? `${d.accuracy}%` : '---'}
                      {d && d.total > 0 && <span style={{ color: '#666', fontSize: 10 }}> ({d.total})</span>}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          <div style={{ color: '#e0e0e0', fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6, marginTop: 4 }}>총합</div>
          {['GEMINI', 'AIS_ONLY', 'HYBRID_COOP'].map(mode => {
            const m = aisTrainingStats.byMode?.[mode];
            return (
              <div key={mode} style={{ textAlign: 'center', fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6, marginTop: 4,
                color: m && m.total > 0 ? (mode === 'GEMINI' ? '#4dabf7' : mode === 'AIS_ONLY' ? '#69db7c' : '#ffa94d') : '#555' }}>
                {m && m.total > 0 ? `${m.accuracy}%` : '---'}
                {m && m.total > 0 && <span style={{ color: '#666', fontSize: 10 }}> ({m.total}건)</span>}
              </div>
            );
          })}
        </div>
      </div>
      )}

      <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(139, 92, 246, 0.25)', marginTop: '20px' }}>
        <h4 style={{ fontSize: '15px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🧠</span> AiS 엔진 모드 및 학습 관리
        </h4>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 16px 0', textAlign: 'left' }}>
          매매를 집행할 메인 AI 엔진 모드를 지정하고 백그라운드 학습용 데이터셋(SQLite 및 CSV) 상태를 모니터링합니다.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>작동 엔진 선택</label>
            <select
              value={globalAiEngine}
              onChange={(e) => handleSaveAiEngine(e.target.value)}
              disabled={savingAiEngine}
              style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#FFF', outline: 'none' }}
            >
              <option value="GEMINI" style={{ background: '#1A1825', color: '#FFF' }}>Gemini 매매 모드</option>
              <option value="HYBRID_COOP" style={{ background: '#1A1825', color: '#FFF' }}>Gemini + AiS 공동 합의 매매 모드</option>
              <option value="AIS_ONLY" style={{ background: '#1A1825', color: '#FFF' }}>AiS 독자 매매 모드</option>
            </select>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><b>학습 데이터셋 누적 건수:</b></span>
              <span style={{ color: '#A78BFA', fontWeight: 'bold', fontSize: '12px' }}>{trainingDataCount.toLocaleString()} 건</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><b>최근 자동 학습 완료 시각:</b></span>
              <span style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: '11px' }}>{aisLastTrainedAt ? aisLastTrainedAt : '학습 전 (대기 중)'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><b>AiS 모델 검증 정확도:</b></span>
              <span style={{ color: '#10B981', fontWeight: 'bold', fontSize: '11px' }}>{aisModelAccuracy}%</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dark)', marginTop: '4px' }}>
              * 매 5분 틱마다 시장 지표(RSI_14, SMA_5/20) 및 사후 채점(next_price) 피드백이 실시간 자동 빌드되어 SQLite DB에 무제한 누적됩니다.
            </div>
          </div>

          <AisTrainingEvidence
            stats={aisTrainingStats}
            globalAiEngine={globalAiEngine}
            handleToggleAutomaticPromotion={handleToggleAutomaticPromotion}
            aidlPolicy={{
              contextMutationRate: aidlContextMutationRate,
              stateMutationRate: aidlStateMutationRate,
              profileMutationRate: aidlProfileMutationRate,
              copyNumberMutationRate: aidlCopyNumberMutationRate,
              weightNudgeSize: aidlWeightNudgeSize,
            }}
            councilStats={councilStats}
            submittingAidlGeneState={submittingAidlGeneState}
            handleAidlGeneStateUpdate={handleAidlGeneStateUpdate}
            submittingAidlGeneContext={submittingAidlGeneContext}
            handleAidlGeneContextUpdate={handleAidlGeneContextUpdate}
          />

          <SimulationPanel managerEmail={managerEmail} />

          <button
            type="button"
            onClick={() => downloadAuthenticatedFile(
              `${API_BASE}/admin/export-training-csv`,
              'ais_training_dataset.csv'
            )}
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '6px',
              width: '100%',
              padding: '14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              color: '#FFF',
              textDecoration: 'none',
              textAlign: 'center',
              cursor: 'pointer',
              border: 'none',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)'
            }}
          >
            📥 AI 학습용 CSV 데이터셋 다운로드
          </button>
        </div>
      </div>


      <div className="glass-card" style={{ padding: '16px', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.02) 0%, rgba(20, 16, 45, 0.3) 100%)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '6px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)' }}>
              <Receipt size={16} color="#A78BFA" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <h3 style={{ fontSize: '13px', color: '#F3F4F6', margin: 0, fontWeight: '700' }}>🤖 AI 틱별 결정 히스토리 (최대 50개)</h3>
              <p style={{ fontSize: '9px', color: 'var(--text-muted)', margin: '1px 0 0 0' }}>AI 엔진이 매 틱마다 판단한 세부 의사결정 이력입니다.</p>
            </div>
          </div>

          <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.3)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            {['ALL', 'BUY', 'SELL', 'HOLD'].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setHistoryFilter(filter)}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: historyFilter === filter ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                  color: historyFilter === filter ? '#A78BFA' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                {filter === 'ALL' ? '전체' : filter === 'BUY' ? '매수' : filter === 'SELL' ? '매도' : '관망'}
              </button>
            ))}
          </div>
        </div>

        {(() => {
          const filteredLogs = aiLogs.filter(log => {
            if (historyFilter === 'ALL') return true;
            return log.decision === historyFilter;
          });

          if (filteredLogs.length === 0) {
            return (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '11px' }}>
                📭 선택한 필터 조건에 해당하는 AI 결정 내역이 없습니다.
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredLogs.map((log, index) => {
                let badgeColor = 'var(--text-muted)';
                let badgeBg = 'rgba(255,255,255,0.05)';
                let borderCol = 'rgba(255,255,255,0.05)';

                if (log.decision === 'BUY') {
                  badgeColor = 'var(--success-color)';
                  badgeBg = 'rgba(16, 185, 129, 0.1)';
                  borderCol = 'rgba(16, 185, 129, 0.15)';
                } else if (log.decision === 'SELL') {
                  badgeColor = 'var(--danger-color)';
                  badgeBg = 'rgba(239, 68, 68, 0.1)';
                  borderCol = 'rgba(239, 68, 68, 0.15)';
                } else if (log.decision === 'HOLD') {
                  badgeColor = '#F59E0B';
                  badgeBg = 'rgba(245, 158, 11, 0.1)';
                  borderCol = 'rgba(245, 158, 11, 0.15)';
                }

                return (
                  <div
                    key={log.id || index}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: `1px solid ${borderCol}`,
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      textAlign: 'left',
                      transition: 'transform 0.2s, background 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 'bold',
                          color: badgeColor,
                          background: badgeBg,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          border: `1px solid ${borderCol}`
                        }}>
                          {log.decision === 'BUY' ? '🟢 매수' : log.decision === 'SELL' ? '🔴 매도' : '🟡 관망'}
                        </span>

                        {log.decision !== 'HOLD' && (
                          <span style={{ fontSize: '10px', color: '#E5E7EB', fontWeight: 'bold' }}>
                            {log.proposed_price.toFixed(4)} USDT / {log.proposed_amount.toFixed(2)} SUT 추천
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: '8px', color: 'var(--text-dark)', fontFamily: 'monospace' }}>
                        {formatKoreanDateTime(log.created_at)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px', fontSize: '10px' }}>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '9px' }}>
                        <div>추천 밴드 범위: <span style={{ color: '#E5E7EB', fontWeight: '600' }}>{(log.proposed_lower || 0.15).toFixed(4)} ~ {(log.proposed_upper || 0.30).toFixed(4)} USDT</span></div>
                      </div>
                      <div style={{ fontSize: '10px', color: '#D1D5DB', lineHeight: '1.4', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '6px' }}>
                        {log.reason}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

    </div>
  );
}

export default AdminSettingsTab;
