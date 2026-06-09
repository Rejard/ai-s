import sys
import json
import base64

from ais_features import (
    build_features,
    predict_from_centroids,
    validate_centroids,
)

def main():
    try:
        current_price = 0.158
        rsi_value = 50.0
        sma_5 = 0.158
        sma_20 = 0.158
        price_change_ratio = 0.0
        members_data = []

        # 1. Parse standard market features
        if len(sys.argv) > 1:
            current_price = float(sys.argv[1])
        if len(sys.argv) > 2:
            rsi_value = float(sys.argv[2])
        if len(sys.argv) > 3:
            sma_5 = float(sys.argv[3])
        if len(sys.argv) > 4:
            sma_20 = float(sys.argv[4])
        if len(sys.argv) > 5:
            price_change_ratio = float(sys.argv[5])

        # 2. Parse Base64 encoded members array
        if len(sys.argv) > 6:
            try:
                b64_str = sys.argv[6]
                decoded_bytes = base64.b64decode(b64_str)
                members_data = json.loads(decoded_bytes.decode('utf-8'))
            except Exception as b64_err:
                # Fallback to empty if decoding fails
                members_data = []

        features = build_features(
            current_price,
            price_change_ratio,
            rsi_value,
            sma_5,
            sma_20,
        )
        votes_result = []

        if members_data:
            # Run inference for each member in the active council
            for member in members_data:
                member_id = member.get('member_id')
                name = member.get('name')
                weights_str = member.get('weights_json', '{}')
                
                try:
                    weights = json.loads(weights_str)
                except Exception:
                    weights = {}
                
                # Predict closest class (Centroid distance fallback heuristics)
                decision = "HOLD"
                if validate_centroids(weights):
                    decision = predict_from_centroids(features, weights)

                # Construct Korean reason reflecting individual member profile
                reason = f"[{name}] 분석: 현재가 {current_price} USDT, RSI {rsi_value:.1f} 기준으로 "
                if decision == "BUY":
                    reason += "시장 저평가 매수 진입 투표."
                elif decision == "SELL":
                    reason += "시장 고평가 분할 매도 투표."
                else:
                    reason += "뚜렷한 포지션 시그널 부재로 관망 투표."
                
                votes_result.append({
                    "member_id": member_id,
                    "name": name,
                    "decision": decision,
                    "reason": reason
                })
        else:
            # Fallback mock member vote if no database members provided
            mock_members = [
                {"id": "mock_01", "name": "General Heuristics (RSI)"}
            ]
            for m in mock_members:
                decision = "HOLD"
                if rsi_value < 35:
                    decision = "BUY"
                elif rsi_value > 65:
                    decision = "SELL"
                votes_result.append({
                    "member_id": m["id"],
                    "name": m["name"],
                    "decision": decision,
                    "reason": f"[{m['name']}] Heuristic Fallback 분석 완료."
                })

        output = {
            "success": True,
            "votes": votes_result
        }
        print(json.dumps(output))

    except Exception as e:
        err_res = {
            "success": False,
            "error": str(e),
            "votes": []
        }
        print(json.dumps(err_res))

if __name__ == "__main__":
    main()
