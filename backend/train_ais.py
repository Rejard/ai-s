import sqlite3
import os
import json
import random
import urllib.request
import uuid
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'platform.db')

def fetch_gateio_candles():
    url = "https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=SUT_USDT&limit=1000&interval=5m"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            data.sort(key=lambda x: int(x[0]))
            return data
    except Exception as e:
        print(f"[-] Failed to fetch candlesticks from Gate.io: {str(e)}")
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
            round(random.uniform(0.13, 0.16), 4),
            round(random.uniform(-2.0, 0.5), 4),
            round(random.uniform(15.0, 40.0), 1),
            round(random.uniform(0.13, 0.16), 4),
            round(random.uniform(0.13, 0.16), 4)
        ],
        "SELL": [
            round(random.uniform(0.15, 0.19), 4),
            round(random.uniform(-0.5, 2.0), 4),
            round(random.uniform(60.0, 85.0), 1),
            round(random.uniform(0.15, 0.19), 4),
            round(random.uniform(0.15, 0.19), 4)
        ],
        "HOLD": [
            round(random.uniform(0.14, 0.17), 4),
            round(random.uniform(-0.2, 0.2), 4),
            round(random.uniform(45.0, 55.0), 1),
            round(random.uniform(0.14, 0.17), 4),
            round(random.uniform(0.14, 0.17), 4)
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
            if i == 2:  # RSI feature
                noise = random.uniform(-5.0, 5.0)
                new_val = max(0.0, min(100.0, val + noise))
            elif i == 1:  # Price change ratio
                noise = random.uniform(-0.3, 0.3)
                new_val = val + noise
            else:  # Prices features
                noise = random.uniform(-0.01, 0.01)
                new_val = max(0.001, val + noise)
            mutated_vec.append(round(new_val, 4))
        mutated[action] = mutated_vec
    return mutated

def crossover_weights(w1, w2):
    """
    Blend two parent weights (crossover) to breed a new offspring
    """
    offspring = {}
    for action in ["BUY", "SELL", "HOLD"]:
        vec1 = w1.get(action, [0.15, 0, 50, 0.15, 0.15])
        vec2 = w2.get(action, [0.15, 0, 50, 0.15, 0.15])
        offspring_vec = []
        for i in range(5):
            # 50% chance of inheriting from either parent, blended slightly
            blend = random.uniform(0.2, 0.8)
            val = vec1[i] * blend + vec2[i] * (1.0 - blend)
            if i == 2:
                offspring_vec.append(round(val, 1))
            else:
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
        buy_rsi = weights["BUY"][2]
        sell_rsi = weights["SELL"][2]
        if buy_rsi < 32.0 or sell_rsi > 68.0:
            return "VALUE_SEEKER"
            
        # 가격변화율(인덱스 1) 가중치 강도를 기반으로 판단
        buy_change = weights["BUY"][1]
        sell_change = weights["SELL"][1]
        if abs(buy_change) > 1.2 or abs(sell_change) > 1.2:
            return "TREND_FOLLOWER"
            
        # 극단적으로 안전 지향적인 과매수/과매도 rsi 범주
        if buy_rsi < 22.0 or sell_rsi > 78.0:
            return "CONSERVATIVE_WATCHER"
    except Exception:
        pass
        
    # 기본값
    return random.choice(["MUTANT_ROOKIE", "TREND_FOLLOWER", "VALUE_SEEKER", "CONSERVATIVE_WATCHER"])

def run_backtest_for_candidate(candidate_weights, prices, rsi, sma5, sma20):
    """
    Run simulation on historical prices to count correct predictions
    """
    correct_count = 0
    total_predictions = 0
    
    # Run loop through historical data (excluding warmup padding)
    for i in range(20, len(prices) - 1):
        price = prices[i]
        prev_price = prices[i-1]
        next_price = prices[i+1] # 5m future price
        
        change_ratio = ((price - prev_price) / prev_price) * 100.0
        features = [price, change_ratio, rsi[i], sma5[i], sma20[i]]
        
        # Predict decision by closest centroid distance
        best_decision = "HOLD"
        min_dist = float('inf')
        for dec, mean_vec in candidate_weights.items():
            dist = sum((f - m) ** 2 for f, m in zip(features, mean_vec))
            if dist < min_dist:
                min_dist = dist
                best_decision = dec
                
        # Label actual future movement as correct target
        realized_change = ((next_price - price) / price) * 100.0
        target = "HOLD"
        if realized_change > 0.2:
            target = "BUY"
        elif realized_change < -0.2:
            target = "SELL"
            
        if best_decision == target:
            correct_count += 1
        total_predictions += 1
        
    if total_predictions == 0:
        return 0.0
    return (correct_count / total_predictions) * 100.0

def main():
    print("[*] Initiating AI Council General Election & Culling 스케줄러...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 1. Fetch SUT past candles from Gate.io for backtest exam
        candles = fetch_gateio_candles()
        if len(candles) < 30:
            print("[-] Not enough candlestick data from Gate.io. Culling aborted.")
            return
            
        close_prices = [float(c[2]) for c in candles]
        rsi_14 = calculate_rsi(close_prices, 14)
        sma_5 = calculate_sma(close_prices, 5)
        sma_20 = calculate_sma(close_prices, 20)
        
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
            seed_weights = []
            for r in seed_rows:
                try:
                    seed_weights.append((json.loads(r[0]), r[1] if r[1] else 1))
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
            conn.commit()
            
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
            except Exception:
                weights = generate_random_weights()
                
            # Run simulation
            accuracy = run_backtest_for_candidate(weights, close_prices, rsi_14, sma_5, sma_20)
            candidates_results.append({
                "id": m_id,
                "name": name,
                "weights": weights,
                "accuracy": accuracy,
                "generation": gen if gen else 1
            })
            
        # Sort by accuracy descending (Best to Worst)
        candidates_results.sort(key=lambda x: x["accuracy"], reverse=True)
        best_accuracy = candidates_results[0]["accuracy"]
        worst_accuracy = candidates_results[-1]["accuracy"]
        avg_accuracy = sum(c["accuracy"] for c in candidates_results) / len(candidates_results)
        
        print(f"[+] Grading complete. Max Acc: {best_accuracy:.2f}%, Min Acc: {worst_accuracy:.2f}%, Avg: {avg_accuracy:.2f}%")
        
        # 5. Culling: Delete worst 150 candidates (30% cull)
        culled_targets = candidates_results[-150:]
        culled_ids = [c["id"] for c in culled_targets]
        
        cursor.executemany("DELETE FROM ais_council_members WHERE member_id = ?", [(cid,) for cid in culled_ids])
        conn.commit()
        print(f"[x] Culled & Retired 150 low-performing candidates from DB.")
        
        # Remaining survivors
        survivors = candidates_results[:-150]
        
        # 6. Breeding Crossover (75 offsprings) & Fresh Mutants (75 newcomers)
        # Select from top 50 survivors as parents
        parents = survivors[:50]
        new_offspring_inserts = []
        
        for idx in range(75):
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
            
        for idx in range(75):
            new_id = f"mutant_{uuid.uuid4().hex}"
            name = f"Mutant Rookie Gen-{idx+1} (1세대)"
            weights = generate_random_weights()
            faction = determine_faction_from_weights(weights, name)
            new_offspring_inserts.append((new_id, name, json.dumps(weights), 1.0, 'CANDIDATE', faction, 1))
            
        cursor.executemany("""
            INSERT OR IGNORE INTO ais_council_members (member_id, name, weights_json, voting_power, status, faction, generation)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, new_offspring_inserts)
        conn.commit()

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
        conn.commit()
        print(f"[+] Spawned candidates and verified exact pool size: {pool_count}/500.")
        
        # 7. Election: Elect Top 11 best performers as ACTIVE Council Members
        # Downgrade all current active members to CANDIDATE status first
        cursor.execute("UPDATE ais_council_members SET status = 'CANDIDATE'")
        
        # Select best 11 from current survivors (excluding the newly spawned who haven't been backtested yet)
        elected = survivors[:11]
        elected_ids = [e["id"] for e in elected]
        
        print("\n=== NEWLY ELECTED AI COUNCIL MEMBERS ===")
        # Calculate voting power proportionally to accuracy score (mean relative)
        avg_elected_accuracy = sum(e["accuracy"] for e in elected) / 11
        
        for idx, e in enumerate(elected):
            member_id = e["id"]
            name = e["name"]
            acc = e["accuracy"]
            
            # voting_power is centered around 1.0 based on relative performance
            v_power = round(acc / avg_elected_accuracy, 2) if avg_elected_accuracy > 0 else 1.0
            v_power = max(0.5, min(2.0, v_power)) # cap power between 0.5 and 2.0
            
            cursor.execute("""
                UPDATE ais_council_members 
                SET status = 'ACTIVE', voting_power = ?, correct_count = ?, total_count = ?
                WHERE member_id = ?
            """, (v_power, int(acc), 100, member_id))
            
            print(f"{idx+1}등. [{name}] - 정확도: {acc:.2f}%, 투표권 지분: {v_power:.2f}표")
            
        conn.commit()
        
        # 8. Save overall training metadata in platform settings for Dashboard display
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('ais_last_trained_at', ?)", (now_str,))
        cursor.execute("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('ais_model_accuracy', ?)", (f"{avg_accuracy:.2f}",))
        cursor.execute("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('ais_training_data_count', ?)", ("500",))
        conn.commit()
        
        print("\n[+] General Election and Culling complete. Saved platform metadata.")
        
    except Exception as ex:
        print(f"[-] Critical error during election: {str(ex)}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main()
