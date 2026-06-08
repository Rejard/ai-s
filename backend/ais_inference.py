import sys
import json
import os
import math

MODEL_PKL_PATH = os.path.join(os.path.dirname(__file__), 'ais_model.pkl')
MODEL_JSON_PATH = os.path.join(os.path.dirname(__file__), 'ais_model_weights.json')

def predict_by_sklearn(features):
    import joblib
    model = joblib.load(MODEL_PKL_PATH)
    pred = model.predict([features])
    return str(pred[0])

def predict_by_lightweight(features):
    with open(MODEL_JSON_PATH, 'r', encoding='utf-8') as f:
        weights = json.load(f)
        
    best_decision = "HOLD"
    min_dist = float('inf')
    
    # Predict closest prototype vector by Euclidean distance
    for dec, mean_vec in weights.items():
        dist = sum((f - m) ** 2 for f, m in zip(features, mean_vec))
        if dist < min_dist:
            min_dist = dist
            best_decision = dec
            
    return best_decision

def main():
    try:
        current_price = 0.158
        rsi_value = 50.0
        sma_5 = 0.158
        sma_20 = 0.158
        price_change_ratio = 0.0
        
        # Parse arguments from Node.js child_process
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
        if len(sys.argv) > 5:
            try:
                price_change_ratio = float(sys.argv[5])
            except ValueError:
                pass

        features = [current_price, price_change_ratio, rsi_value, sma_5, sma_20]
        decision = None
        model_type = "Fallback Heuristics"

        # 1. Try loading Scikit-learn Random Forest model
        if os.path.exists(MODEL_PKL_PATH):
            try:
                decision = predict_by_sklearn(features)
                model_type = "RandomForest Model"
            except Exception as e:
                # Fallback on load error
                pass
                
        # 2. Try loading Lightweight Distance-based Prototype model
        if not decision and os.path.exists(MODEL_JSON_PATH):
            try:
                decision = predict_by_lightweight(features)
                model_type = "Lightweight Model"
            except Exception as e:
                pass

        # 3. Fallback to heuristic rules if no models are available or load failed
        if not decision:
            decision = "HOLD"
            if rsi_value < 30:
                decision = "BUY"
            elif rsi_value > 70:
                decision = "SELL"

        reason = f"AiS [{model_type}] 분석 완료. 현재가 {current_price} USDT, RSI {rsi_value:.1f}, SMA_5/20이 분석에 사용되었습니다."
        if decision == "BUY":
            reason += " 시장 저평가 매수 신호가 감지되어 매수(BUY)를 제안합니다."
        elif decision == "SELL":
            reason += " 시장 고평가 매도 신호가 감지되어 매도(SELL)를 제안합니다."
        else:
            reason += " 뚜렷한 추세 전환 지표가 확인되지 않아 관망(HOLD)을 권장합니다."

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
        
        print(json.dumps(result))
    except Exception as e:
        err_res = {
            "decision": "HOLD",
            "reason": f"AiS 로컬 추론 실행 중 예외 발생: {str(e)}",
            "price": 0.158,
            "amount_ratio": 0.1,
            "proposed_lower": 0.15,
            "proposed_upper": 0.30
        }
        print(json.dumps(err_res))

if __name__ == "__main__":
    main()
