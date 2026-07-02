import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import ManagerAiDecisionHistory from '../components/ManagerAiDecisionHistory';
import ManagerTradeExecutions from '../components/ManagerTradeExecutions';

function ManagerTradingTab({
  gridSettings, setGridSettings, handleToggleAutoRangePreview, handleToggleAiStatus,
  handleTriggerAIProfit, handleSaveGridSettings, hasUnsavedChanges,
  gateioBalance, vaultSutBalance, walletSutBalance, stats,
  localApiKey, setLocalApiKey, localApiSecret, setLocalApiSecret,
  localDepositAddress, setLocalDepositAddress,
  handleSaveApiKeys, isSavingCredentials, handleClearApiKeys, setShowSendSutModal,
  aiLogs, tradeExecutions, openOrders,
  orderAmount, orderPrice, orderTotal,
  handleOrderAmountChange, handleOrderPriceChange, handleOrderTotalChange,
  handleGateIoOrderClick, confirmMode, submittingOrder,
  handleCancelOrder, sutPrice,
  ManagerAiConfigSection,
  handleApproveOperator, approvingOperator, operatorApproved
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      <ManagerAiConfigSection
        gridSettings={gridSettings}
        setGridSettings={setGridSettings}
        handleToggleAutoRangePreview={handleToggleAutoRangePreview}
        handleToggleAiStatus={handleToggleAiStatus}
        handleTriggerAIProfit={handleTriggerAIProfit}
        handleSaveGridSettings={handleSaveGridSettings}
        hasUnsavedChanges={hasUnsavedChanges}
        gateioBalance={gateioBalance}
        vaultSutBalance={vaultSutBalance}
        walletSutBalance={walletSutBalance}
        stats={stats}
        localApiKey={localApiKey}
        setLocalApiKey={setLocalApiKey}
        localApiSecret={localApiSecret}
        setLocalApiSecret={setLocalApiSecret}
        localDepositAddress={localDepositAddress}
        setLocalDepositAddress={setLocalDepositAddress}
        handleSaveApiKeys={handleSaveApiKeys}
        isSavingCredentials={isSavingCredentials}
        handleClearApiKeys={handleClearApiKeys}
        setShowSendSutModal={setShowSendSutModal}
        handleApproveOperator={handleApproveOperator}
        approvingOperator={approvingOperator}
        operatorApproved={operatorApproved}
      />

      <ManagerAiDecisionHistory logs={aiLogs} isMobile />
      <ManagerTradeExecutions executions={tradeExecutions} isMobile />

      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '15px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>⏳</span>
          실거래 미체결 대기 주문 (Open Orders)
        </h3>

        {!openOrders || openOrders.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>
            현재 거래소 호가창에 대기 중인 주문이 없습니다. (체결 완료 혹은 미접수)
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {openOrders.map((order, idx) => {
              const isBuy = order.side === 'buy';
              const formattedTime = (() => {
                try {
                  const ts = parseFloat(order.create_time_ms || (order.create_time * 1000));
                  return new Date(ts).toLocaleString();
                } catch (e) { return '-'; }
              })();
              const amount = parseFloat(order.amount).toFixed(2);
              const price = parseFloat(order.price).toFixed(4);
              const left = parseFloat(order.left || 0).toFixed(2);
              const total = (parseFloat(order.amount) * parseFloat(order.price)).toFixed(4);

              return (
                <div key={order.id || idx} style={{ background: 'rgba(59, 130, 246, 0.03)', border: '1px solid rgba(59, 130, 246, 0.1)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      color: isBuy ? 'var(--success-color)' : 'var(--danger-color)',
                      background: isBuy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px'
                    }}>
                      {isBuy ? '🟢 매수 대기' : '🔴 매도 대기'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-dark)' }}>{formattedTime}</span>
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#EF4444', padding: '2px 6px', borderRadius: '4px',
                          fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
                        }}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                    <div>수량: <span style={{ color: '#FFF', fontWeight: 'bold' }}>{amount} SUT</span></div>
                    <div>가격: <span style={{ color: '#FFF', fontWeight: 'bold' }}>{price} USDT</span></div>
                    <div>남은수량: <span style={{ color: 'var(--warning-color)', fontWeight: 'bold' }}>{left} SUT</span></div>
                    <div>총액: <span style={{ color: '#10B981', fontWeight: 'bold' }}>{total} USDT</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.04) 0%, rgba(20, 16, 45, 0.4) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <h4 style={{ fontSize: '15px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowUpDown size={18} color="#8B5CF6" />
          Gate.io SUT 직접 수동 주문
        </h4>

        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
          Gate.io 거래소에 실제 주문을 전송합니다. 아래 입력한 가격과 수량으로 호가에 주문이 등록됩니다.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>단가 (USDT)</label>
            <input
              type="number"
              className="form-input"
              placeholder={`현재가: ${sutPrice}`}
              value={orderPrice}
              onChange={(e) => handleOrderPriceChange(e.target.value)}
              step="0.0001"
              style={{ fontSize: '13px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>수량 (SUT)</label>
            <input
              type="number"
              className="form-input"
              placeholder="예: 100"
              value={orderAmount}
              onChange={(e) => handleOrderAmountChange(e.target.value)}
              step="0.01"
              style={{ fontSize: '13px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>총액 (USDT)</label>
            <input
              type="number"
              className="form-input"
              placeholder="자동 계산"
              value={orderTotal}
              onChange={(e) => handleOrderTotalChange(e.target.value)}
              step="0.0001"
              style={{ fontSize: '13px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleGateIoOrderClick('buy')}
            disabled={submittingOrder}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px', fontWeight: '800', fontSize: '13px',
              cursor: 'pointer', border: 'none', transition: 'all 0.2s',
              background: confirmMode === 'BUY' ? '#059669' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFF',
              animation: confirmMode === 'BUY' ? 'pulse 0.5s ease' : 'none'
            }}
          >
            {submittingOrder ? '주문중...' : (confirmMode === 'BUY' ? '🟢 다시 누르면 매수 주문' : '🟢 매수 (BUY)')}
          </button>
          <button
            onClick={() => handleGateIoOrderClick('sell')}
            disabled={submittingOrder}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px', fontWeight: '800', fontSize: '13px',
              cursor: 'pointer', border: 'none', transition: 'all 0.2s',
              background: confirmMode === 'SELL' ? '#DC2626' : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              color: '#FFF',
              animation: confirmMode === 'SELL' ? 'pulse 0.5s ease' : 'none'
            }}
          >
            {submittingOrder ? '주문중...' : (confirmMode === 'SELL' ? '🔴 다시 누르면 매도 주문' : '🔴 매도 (SELL)')}
          </button>
        </div>

        {sutPrice > 0 && (
          <div style={{ fontSize: '10px', color: 'var(--text-dark)', textAlign: 'center' }}>
            현재 SUT 시세: {sutPrice.toFixed(4)} USDT
          </div>
        )}
      </div>
    </div>
  );
}

export default ManagerTradingTab;
