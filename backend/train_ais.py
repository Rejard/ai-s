import sqlite3
import os
import json
import random
import urllib.request
import uuid
from datetime import datetime
from ais_features import (
    build_features,
    chronological_split,
    fit_centroids,
    predict_from_centroids,
    score_predictions,
    validate_centroids,
)

DB_PATH = os.environ.get(
    "AIS_DB_PATH",
    os.path.join(os.path.dirname(__file__), "platform.db"),
)

def fetch_gateio_candles(interval="15m"):
    url = f"https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=SUT_USDT&limit=1000&interval={interval}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            data.sort(key=lambda x: int(x[0]))
            return data
    except Exception as e:
        print(f"[-] Failed to fetch candlesticks from Gate.io with interval {interval}: {str(e)}")
        return []

def calculate_rsi(prices, period=14):
    if len(prices) < period + 1:
        return [50.0] * len(prices)
    rsi_values = []
    gains = []
    losses = []
    
    for i in range(1, len(prices)):
        diff = prices[i] - prices[i-1]
        if diff > 0:
            gains.append(diff)
            losses.append(0.0)
        else:
            gains.append(0.0)
            losses.append(-diff)
            
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    
    for _ in range(period):
        rsi_values.append(50.0)
        
    if avg_loss == 0:
        rsi_values.append(100.0 if avg_gain > 0 else 50.0)
    else:
        rs = avg_gain / avg_loss
        rsi_values.append(100.0 - (100.0 / (1.0 + rs)))
        
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        if avg_loss == 0:
            rsi_values.append(100.0 if avg_gain > 0 else 50.0)
        else:
            rs = avg_gain / avg_loss
            rsi_values.append(100.0 - (100.0 / (1.0 + rs)))
    return rsi_values

def calculate_sma(prices, period):
    sma = []
    for i in range(len(prices)):
        if i < period - 1:
            sma.append(prices[i])
        else:
            window = prices[i - period + 1 : i + 1]
            sma.append(sum(window) / period)
    return sma

def generate_random_weights():
    """
    Generate randomized weights (ideology) for a mutant candidate
    """
    return {
        "BUY": [
            round(random.uniform(-2.0, 0.2), 4),
            round(random.uniform(-1.0, -0.1), 4),
            round(random.uniform(0.0, 3.0), 4),
            round(random.uniform(0.0, 4.0), 4),
            round(random.uniform(-2.0, 1.0), 4)
        ],
        "SELL": [
            round(random.uniform(-0.2, 2.0), 4),
            round(random.uniform(0.1, 1.0), 4),
            round(random.uniform(-3.0, 0.0), 4),
            round(random.uniform(-4.0, 0.0), 4),
            round(random.uniform(-1.0, 2.0), 4)
        ],
        "HOLD": [
            round(random.uniform(-0.3, 0.3), 4),
            round(random.uniform(-0.2, 0.2), 4),
            round(random.uniform(-0.5, 0.5), 4),
            round(random.uniform(-0.5, 0.5), 4),
            round(random.uniform(-0.5, 0.5), 4)
        ]
    }

def mutate_weights(parent_weights):
    """
    Apply minor genetic mutation to parent weights
    """
    mutated = {}
    for action, vector in parent_weights.items():
        mutated_vec = []
        for i, val in enumerate(vector):
            # Apply 10% max mutation variation
            if i == 1:  # normalized RSI feature
                noise = random.uniform(-0.15, 0.15)
                new_val = max(-1.5, min(1.5, val + noise))
            elif i == 0:  # Price change ratio
                noise = random.uniform(-0.3, 0.3)
                new_val = val + noise
            else:  # Relative SMA features
                noise = random.uniform(-0.3, 0.3)
                new_val = val + noise
            mutated_vec.append(round(new_val, 4))
        mutated[action] = mutated_vec
    return mutated

def crossover_weights(w1, w2):
    """
    Blend two parent weights (crossover) to breed a new offspring
    """
    offspring = {}
    for action in ["BUY", "SELL", "HOLD"]:
        fallback = generate_random_weights()[action]
        vec1 = w1.get(action, fallback)
        vec2 = w2.get(action, fallback)
        offspring_vec = []
        for i in range(5):
            # 50% chance of inheriting from either parent, blended slightly
            blend = random.uniform(0.2, 0.8)
            val = vec1[i] * blend + vec2[i] * (1.0 - blend)
            offspring_vec.append(round(val, 4))
        offspring[action] = offspring_vec
    return offspring

def determine_faction_from_weights(weights, name_or_id):
    name_lower = name_or_id.lower()
    if 'trend' in name_lower or 'momentum' in name_lower or 'cross' in name_lower or 'specialist' in name_lower:
        return 'TREND_FOLLOWER'
    if 'value' in name_lower or 'contrarian' in name_lower:
        return 'VALUE_SEEKER'
    if 'conservative' in name_lower or 'shield' in name_lower or 'safety' in name_lower:
        return 'CONSERVATIVE_WATCHER'
    if 'alpha' in name_lower or 'beta' in name_lower or 'gamma' in name_lower:
        return 'MUTANT_ROOKIE'
        
    try:
        # BUY/SELL의 RSI(인덱스 2) 차이를 기반으로 판단
        buy_rsi = weights["BUY"][1]
        sell_rsi = weights["SELL"][1]
        if buy_rsi < -0.45 or sell_rsi > 0.45:
            return "VALUE_SEEKER"
            
        # 가격변화율(인덱스 1) 가중치 강도를 기반으로 판단
        buy_change = weights["BUY"][0]
        sell_change = weights["SELL"][0]
        if abs(buy_change) > 1.2 or abs(sell_change) > 1.2:
            return "TREND_FOLLOWER"
            
        # 극단적으로 안전 지향적인 과매수/과매도 rsi 범주
        if buy_rsi < -0.75 or sell_rsi > 0.75:
            return "CONSERVATIVE_WATCHER"
    except Exception:
        pass
        
    # 기본값
    return random.choice(["MUTANT_ROOKIE", "TREND_FOLLOWER", "VALUE_SEEKER", "CONSERVATIVE_WATCHER"])

def build_market_rows(prices, rsi, sma5, sma20):
    rows = []
    for i in range(20, len(prices) - 1):
        price = prices[i]
        prev_price = prices[i-1]
        next_price = prices[i+1]
        change_ratio = ((price - prev_price) / prev_price) * 100.0
        features = build_features(price, change_ratio, rsi[i], sma5[i], sma20[i])
        realized_change = ((next_price - price) / price) * 100.0
        target = "HOLD"
        if realized_change > 0.2:
            target = "BUY"
        elif realized_change < -0.2:
            target = "SELL"
        rows.append({"features": features, "target": target})
    return rows


def evaluate_candidate(candidate_weights, rows):
    if not rows or not validate_centroids(candidate_weights):
        return {
            "accuracy": 0.0,
            "balanced_accuracy": 0.0,
            "utility_score": 0.0,
            "collapse_penalty": 0.0,
            "recall": {"BUY": 0.0, "SELL": 0.0, "HOLD": 0.0},
            "action_counts": {"BUY": 0, "SELL": 0, "HOLD": 0},
        }
    targets = [row["target"] for row in rows]
    predictions = [
        predict_from_centroids(row["features"], candidate_weights)
        for row in rows
    ]
    return score_predictions(targets, predictions)

def main():
    print("[*] Initiating AI Council General Election & Culling 스케줄러...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    run_key = f"ais_run_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
    
    try:
        cursor.execute("""
            INSERT INTO ais_model_runs (run_key, status)
            VALUES (?, 'RUNNING')
        """, (run_key,))
        conn.commit()

        # Get global AI interval to fetch matching candles
        interval_str = "15m"
        try:
            cursor.execute("SELECT value FROM platform_settings WHERE key = 'global_ai_interval'")
            row = cursor.fetchone()
            if row and row[0]:
                val = int(row[0])
                if val == 5:
                    interval_str = "5m"
                elif val == 15:
                    interval_str = "15m"
                elif val == 30:
                    interval_str = "30m"
                else:
                    interval_str = f"{val}m"
        except Exception as db_ex:
            print(f"[-] Failed to read global_ai_interval from DB: {str(db_ex)}. Fallback to 15m")

        print(f"[*] Fetching Gate.io candles with interval: {interval_str}")

        # 1. Fetch SUT past candles from Gate.io for backtest exam
        candles = fetch_gateio_candles(interval_str)
        if len(candles) < 30:
            raise RuntimeError("Not enough Gate.io candlestick data for AiS evaluation")
            
        close_prices = [float(c[2]) for c in candles]
        rsi_14 = calculate_rsi(close_prices, 14)
        sma_5 = calculate_sma(close_prices, 5)
        sma_20 = calculate_sma(close_prices, 20)
        market_rows = build_market_rows(close_prices, rsi_14, sma_5, sma_20)
        training_rows, validation_rows, holdout_rows = chronological_split(market_rows)
        if min(len(training_rows), len(validation_rows), len(holdout_rows)) == 0:
            raise RuntimeError("Chronological AiS partitions are empty")
        training_seed = fit_centroids(training_rows)
        conn.execute("BEGIN IMMEDIATE")
        
        # 2. Check current total candidate count in DB
        cursor.execute("SELECT COUNT(*) FROM ais_council_members")
        total_in_db = cursor.fetchone()[0]
        print(f"[+] Current candidates pool size: {total_in_db}/500")
        
        # 3. If pool size < 500, populate it with mutants to reach 500
        if total_in_db < 500:
            needed = 500 - total_in_db
            print(f"[*] Populaton size is low. Spawning {needed} new mutant candidates...")
            
            # Fetch existing members to use as seed weights
            cursor.execute("SELECT weights_json, generation FROM ais_council_members")
            seed_rows = cursor.fetchall()
            seed_weights = [(training_seed, 1)]
            for r in seed_rows:
                try:
                    parsed = json.loads(r[0])
                    if validate_centroids(parsed):
                        seed_weights.append((parsed, r[1] if r[1] else 1))
                except Exception:
                    pass
            
            new_inserts = []
            for k in range(needed):
                new_id = f"ais_member_{uuid.uuid4().hex}"
                
                # Apply mutation to seeds if available, else generate fresh random
                if seed_weights and random.random() > 0.3:
                    parent, parent_gen = random.choice(seed_weights)
                    weights = mutate_weights(parent)
                    gen = parent_gen + 1
                else:
                    weights = generate_random_weights()
                    gen = 1
                    
                name = f"Mutant Challenger {total_in_db + k + 1} ({gen}세대)"
                faction = determine_faction_from_weights(weights, name)
                new_inserts.append((new_id, name, json.dumps(weights), 1.0, 'CANDIDATE', faction, gen))
                
            cursor.executemany("""
                INSERT OR IGNORE INTO ais_council_members (member_id, name, weights_json, voting_power, status, faction, generation)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, new_inserts)
            # Refresh total count
            cursor.execute("SELECT COUNT(*) FROM ais_council_members")
            total_in_db = cursor.fetchone()[0]
            print(f"[+] Spawning finished. Pool size is now {total_in_db}.")
            
        # 4. Fetch all 500 candidates for exam
        cursor.execute("SELECT member_id, name, weights_json, generation FROM ais_council_members")
        candidates_rows = cursor.fetchall()
        
        candidates_results = []
        print("[*] Grading all 500 candidates on SUT historical mock exam...")
        for r in candidates_rows:
            m_id, name, weights_str, gen = r
            try:
                weights = json.loads(weights_str)
                if not validate_centroids(weights):
                    weights = mutate_weights(training_seed)
            except Exception:
                weights = mutate_weights(training_seed)
                
            validation_metrics = evaluate_candidate(weights, validation_rows)
            candidates_results.append({
                "id": m_id,
                "name": name,
                "weights": weights,
                "validation_metrics": validation_metrics,
                "validation_score": validation_metrics["utility_score"],
                "generation": gen if gen else 1
            })
            
        # Sort by validation score. Holdout remains unseen until election is frozen.
        candidates_results.sort(key=lambda x: x["validation_score"], reverse=True)
        best_accuracy = candidates_results[0]["validation_score"]
        worst_accuracy = candidates_results[-1]["validation_score"]
        avg_accuracy = sum(c["validation_score"] for c in candidates_results) / len(candidates_results)
        
        print(f"[+] Grading complete. Max Acc: {best_accuracy:.2f}%, Min Acc: {worst_accuracy:.2f}%, Avg: {avg_accuracy:.2f}%")
        
        # Calculate dynamic culling ratio based on market volatility
        volatility = 0.2
        if validation_rows:
            change_ratios = [r["features"][0] for r in validation_rows]
            if len(change_ratios) > 1:
                mean_cr = sum(change_ratios) / len(change_ratios)
                variance_cr = sum((x - mean_cr) ** 2 for x in change_ratios) / len(change_ratios)
                volatility = variance_cr ** 0.5
        
        # Dynamic Cull logic (10% to 40% based on volatility threshold)
        if volatility < 0.15:
            cull_ratio = 0.10
        elif volatility < 0.35:
            cull_ratio = 0.30
        else:
            cull_ratio = 0.40
            
        cull_count = int(len(candidates_results) * cull_ratio)
        cull_count = max(50, min(200, cull_count))
        
        print(f"[+] Market Volatility: {volatility:.3f}%, Dynamic Culling Ratio: {cull_ratio*100:.0f}% (Target: {cull_count})")
        
        # 5. Culling: Delete worst candidates dynamically
        culled_targets = candidates_results[-cull_count:]
        culled_ids = [c["id"] for c in culled_targets]
        
        cursor.executemany("DELETE FROM ais_council_members WHERE member_id = ?", [(cid,) for cid in culled_ids])
        print(f"[x] Culled & Retired {cull_count} low-performing candidates from DB.")
        
        # Remaining survivors
        survivors = candidates_results[:-cull_count]
        
        # 6. Breeding Crossover & Fresh Mutants dynamically
        parents = survivors[:50]
        new_offspring_inserts = []
        
        offspring_count = cull_count // 2
        mutant_count = cull_count - offspring_count
        
        for idx in range(offspring_count):
            p1 = random.choice(parents)
            p2 = random.choice(parents)
            offspring_weights = crossover_weights(p1["weights"], p2["weights"])
            
            # Apply slight mutation to offspring
            if random.random() > 0.5:
                offspring_weights = mutate_weights(offspring_weights)
                
            offspring_gen = max(p1["generation"], p2["generation"]) + 1
            new_id = f"offspring_{uuid.uuid4().hex}"
            name = f"Offspring Gen-{idx+1} ({offspring_gen}세대)"
            faction = determine_faction_from_weights(offspring_weights, p1["name"])
            new_offspring_inserts.append((new_id, name, json.dumps(offspring_weights), 1.0, 'CANDIDATE', faction, offspring_gen))
            
        for idx in range(mutant_count):
            new_id = f"mutant_{uuid.uuid4().hex}"
            name = f"Mutant Rookie Gen-{idx+1} (1세대)"
            weights = generate_random_weights()
            faction = determine_faction_from_weights(weights, name)
            new_offspring_inserts.append((new_id, name, json.dumps(weights), 1.0, 'CANDIDATE', faction, 1))
            
        cursor.executemany("""
            INSERT OR IGNORE INTO ais_council_members (member_id, name, weights_json, voting_power, status, faction, generation)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, new_offspring_inserts)
        cursor.execute("SELECT COUNT(*) FROM ais_council_members")
        pool_count = cursor.fetchone()[0]
        while pool_count < 500:
            weights = generate_random_weights()
            name = f"Mutant Pool Refill {pool_count + 1} (1세대)"
            cursor.execute("""
                INSERT INTO ais_council_members
                (member_id, name, weights_json, voting_power, status, faction, generation)
                VALUES (?, ?, ?, 1.0, 'CANDIDATE', ?, 1)
            """, (
                f"mutant_{uuid.uuid4().hex}",
                name,
                json.dumps(weights),
                determine_faction_from_weights(weights, name)
            ))
            pool_count += 1
        print(f"[+] Spawned candidates and verified exact pool size: {pool_count}/500.")
        
        # 7. Election: Elect Top 11 best performers as ACTIVE Council Members
        # Downgrade all current active members to CANDIDATE status first
        cursor.execute("UPDATE ais_council_members SET status = 'CANDIDATE'")
        
        # Select best 11 from current survivors (excluding the newly spawned who haven't been backtested yet)
        elected = survivors[:11]
        elected_ids = [e["id"] for e in elected]
        
        print("\n=== NEWLY ELECTED AI COUNCIL MEMBERS ===")
        # Validation selects the council. Holdout remains report-only.
        avg_elected_accuracy = sum(e["validation_score"] for e in elected) / 11
        
        for idx, e in enumerate(elected):
            member_id = e["id"]
            name = e["name"]
            acc = e["validation_score"]
            
            # voting_power is centered around 1.0 based on relative performance
            v_power = round(acc / avg_elected_accuracy, 2) if avg_elected_accuracy > 0 else 1.0
            v_power = max(0.5, min(2.0, v_power)) # cap power between 0.5 and 2.0
            
            cursor.execute("""
                UPDATE ais_council_members 
                SET status = 'ACTIVE', voting_power = ?, correct_count = ?,
                    total_count = ?, weights_json = ?
                WHERE member_id = ?
            """, (v_power, int(acc), 100, json.dumps(e["weights"]), member_id))
            
            print(f"{idx+1}등. [{name}] - 정확도: {acc:.2f}%, 투표권 지분: {v_power:.2f}표")
            
        holdout_metrics = [
            evaluate_candidate(e["weights"], holdout_rows)
            for e in elected
        ]
        challenger_holdout_score = (
            sum(metric["utility_score"] for metric in holdout_metrics)
            / len(holdout_metrics)
        )
        holdout_targets = [row["target"] for row in holdout_rows]
        benchmark_score = score_predictions(
            holdout_targets,
            ["HOLD"] * len(holdout_targets),
        )["utility_score"]

        cursor.execute("""
            SELECT COUNT(*)
            FROM ais_training_data
            WHERE evaluation_status = 'LABELED' AND label_version = 2
        """)
        labeled_count = cursor.fetchone()[0]
        cursor.execute("""
            SELECT COUNT(*)
            FROM ais_training_data
            WHERE evaluation_status = 'INVALID' AND label_version = 2
        """)
        current_invalid_count = cursor.fetchone()[0]
        cursor.execute("""
            SELECT gemini_decision, COUNT(*)
            FROM ais_training_data
            WHERE evaluation_status = 'LABELED' AND label_version = 2
            GROUP BY gemini_decision
        """)
        class_counts = {row[0]: row[1] for row in cursor.fetchall()}

        promotion_reasons = []
        if labeled_count < 300:
            promotion_reasons.append("MIN_LABELED_OBSERVATIONS")
        if current_invalid_count > 0:
            promotion_reasons.append("LABEL_INTEGRITY_FAILURE")
        if challenger_holdout_score - benchmark_score < 3.0:
            promotion_reasons.append("MIN_BENCHMARK_MARGIN")
        if any(class_counts.get(decision, 0) < 10 for decision in ("BUY", "SELL", "HOLD")):
            promotion_reasons.append("MIN_CLASS_COVERAGE")
        promotion_eligible = 1 if not promotion_reasons else 0
        challenger_generation = max(e["generation"] for e in elected)
        
        # 8. Save overall training metadata in platform settings for Dashboard display
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('ais_last_trained_at', ?)", (now_str,))
        cursor.execute("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('ais_model_accuracy', ?)", (f"{challenger_holdout_score:.2f}",))
        cursor.execute("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('ais_training_data_count', ?)", (str(labeled_count),))

        # Check for automatic promotion settings and target active engine constraint
        cursor.execute("SELECT value FROM platform_settings WHERE key = 'automatic_promotion_enabled'")
        auto_promo_row = cursor.fetchone()
        auto_promotion = auto_promo_row[0] if auto_promo_row else 'OFF'

        cursor.execute("SELECT value FROM platform_settings WHERE key = 'global_ai_engine'")
        engine_row = cursor.fetchone()
        current_engine = engine_row[0] if engine_row else 'GEMINI_ONLY'

        if auto_promotion == 'ON' and promotion_eligible == 1 and current_engine in ('HYBRID_COOP', 'AIS_ONLY'):
            cursor.execute("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_engine', 'HYBRID_COOP')")
            print("[+] Automatic Promotion Triggered: global_ai_engine automatically promoted/bound to HYBRID_COOP")

        cursor.execute("""
            UPDATE ais_model_runs
            SET status = 'SHADOW_CHALLENGER',
                dataset_count = ?,
                train_count = ?,
                validation_count = ?,
                holdout_count = ?,
                validation_score = ?,
                holdout_score = ?,
                benchmark_score = ?,
                generation = ?,
                promotion_eligible = ?,
                promotion_reasons = ?,
                completed_at = ?
            WHERE run_key = ?
        """, (
            len(market_rows),
            len(training_rows),
            len(validation_rows),
            len(holdout_rows),
            round(avg_elected_accuracy, 4),
            round(challenger_holdout_score, 4),
            round(benchmark_score, 4),
            challenger_generation,
            promotion_eligible,
            json.dumps(promotion_reasons),
            now_str,
            run_key,
        ))
        conn.commit()
        
        print("\n[+] General Election and Culling complete. Saved platform metadata.")
        
    except Exception as ex:
        print(f"[-] Critical error during election: {str(ex)}")
        conn.rollback()
        try:
            cursor.execute("""
                UPDATE ais_model_runs
                SET status = 'FAILED',
                    error_message = ?,
                    completed_at = ?
                WHERE run_key = ?
            """, (
                str(ex),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                run_key,
            ))
            conn.commit()
        except Exception:
            conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main()
