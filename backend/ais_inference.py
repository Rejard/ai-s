import sys
import json

# Simple Mocking Inference Logic for AiS Model Bridge
# In real production, this script will load a model like:
# model = joblib.load('ais_model.pkl') or torch.load(...)
def main():
    try:
        current_price = 0.158
        rsi_value = 50.0
        sma_5 = 0.158
        sma_20 = 0.158
        
        # Parse inputs from CLI if provided (current_price, rsi_14, sma_5, sma_20)
        if len(sys.argv) > 1:
            try:
                current_price = float(sys.argv[1])
            except ValueError:
                pass
        if len(sys.argv) > 2:
            try:
                rsi_value = float(sys.argv[2])
            except ValueError:
                pass
        if len(sys.argv) > 3:
            try:
                sma_5 = float(sys.argv[3])
            except ValueError:
                pass
        if len(sys.argv) > 4:
            try:
                sma_20 = float(sys.argv[4])
            except ValueError:
                pass

        # Basic mock heuristic representing the AiS model logic
        # In real usage, you will replace this with:
        # features = [[current_price, rsi_value, sma_5, sma_20]]
        # prediction = model.predict(features)
        
        decision = "HOLD"
        reason = f"AiS 로컬 모델 분석: 현재가 {current_price} USDT, RSI {rsi_value:.1f}. 시장 횡보 가능성이 높아 관망(HOLD)을 추천합니다."
        
        if rsi_value < 30:
            decision = "BUY"
            reason = f"AiS 로컬 모델 분석: RSI가 {rsi_value:.1f}로 과매도(Oversold) 구간 진입. 반등 가능성으로 매수(BUY)를 제안합니다."
        elif rsi_value > 70:
            decision = "SELL"
            reason = f"AiS 로컬 모델 분석: RSI가 {rsi_value:.1f}로 과매수(Overbought) 구간 도달. 조정 가능성으로 매도(SELL)를 제안합니다."

        proposed_price = current_price
        amount_ratio = 0.1
        proposed_lower = round(current_price * 0.90, 4)
        proposed_upper = round(current_price * 1.15, 4)

        result = {
            "decision": decision,
            "reason": reason,
            "price": proposed_price,
            "amount_ratio": amount_ratio,
            "proposed_lower": proposed_lower,
            "proposed_upper": proposed_upper
        }
        
        # Print JSON output to stdout for Node.js bridge to capture
        print(json.dumps(result))
    except Exception as e:
        err_res = {
            "decision": "HOLD",
            "reason": f"AiS 로컬 모델 실행 중 예외 발생: {str(e)}",
            "price": 0.158,
            "amount_ratio": 0.1,
            "proposed_lower": 0.15,
            "proposed_upper": 0.30
        }
        print(json.dumps(err_res))

if __name__ == "__main__":
    main()
