import sqlite3
import os
import json
import math
import urllib.request
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'platform.db')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'ais_model_weights.json')

def fetch_gateio_candles():
    """
    Fetch SUT/USDT 5m candlesticks from Gate.io REST API.
    Returns list of close prices, or empty list on failure.
    """
    url = "https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=SUT_USDT&limit=1000&interval=5m"
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            # Format: [[time, volume, close, high, low, open], ...]
            # Sort by timestamp ascending just in case
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
            
    # Initial averages
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

def load_db_training_data():
    if not os.path.exists(DB_PATH):
        return []
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Load real Gemini decision logs with feedback finalized
        cursor.execute("""
            SELECT current_price, price_change_ratio, rsi_14, sma_5, sma_20, gemini_decision 
            FROM ais_training_data 
            WHERE next_price_5m > 0.0
        """)
        rows = cursor.fetchall()
        return rows
    except Exception as e:
        print(f"[-] Database query error: {str(e)}")
        return []
    finally:
        conn.close()

def save_training_status(accuracy, count):
    if not os.path.exists(DB_PATH):
        return
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    try:
        cursor.execute("""
            INSERT OR REPLACE INTO platform_settings (key, value)
            VALUES ('ais_last_trained_at', ?)
        """, (now_str,))
        
        cursor.execute("""
            INSERT OR REPLACE INTO platform_settings (key, value)
            VALUES ('ais_model_accuracy', ?)
        """, (f"{accuracy:.2f}",))
        
        cursor.execute("""
            INSERT OR REPLACE INTO platform_settings (key, value)
            VALUES ('ais_training_data_count', ?)
        """, (str(count),))
        
        conn.commit()
        print(f"[+] Saved training metadata in DB settings. Accuracy: {accuracy:.2f}%, Count: {count}")
    except Exception as e:
        print(f"[-] Failed to save training status in DB: {str(e)}")
    finally:
        conn.close()

def main():
    print("[*] Starting SUT Hybrid AI Model Retraining...")
    
    # 1. Fetch historical candles from Gate.io
    candles = fetch_gateio_candles()
    historical_samples = []
    
    if len(candles) >= 30:
        close_prices = [float(c[2]) for c in candles]
        rsi_14 = calculate_rsi(close_prices, 14)
        sma_5 = calculate_sma(close_prices, 5)
        sma_20 = calculate_sma(close_prices, 20)
        
        # Build training samples from candles
        # Index starts from 20 to allow SMA_20 and RSI calculation warmup
        for i in range(20, len(close_prices)):
            price = close_prices[i]
            prev_price = close_prices[i-1]
            change_ratio = ((price - prev_price) / prev_price) * 100.0
            
            # Simple Heuristic Rule labeling for pre-training:
            # RSI low -> BUY, RSI high -> SELL, else -> HOLD
            rsi = rsi_14[i]
            decision = "HOLD"
            if rsi < 35:
                decision = "BUY"
            elif rsi > 65:
                decision = "SELL"
                
            historical_samples.append((
                price,
                change_ratio,
                rsi,
                sma_5[i],
                sma_20[i],
                decision
            ))
            
    print(f"[+] Fetched & built {len(historical_samples)} historical samples from Gate.io.")
    
    # 2. Load live Gemini decision history from SQLite DB
    db_samples = load_db_training_data()
    print(f"[+] Loaded {len(db_samples)} Gemini decision samples from SQLite.")
    
    # Require minimum samples for training
    total_samples_list = historical_samples + db_samples
    total_count = len(total_samples_list)
    
    if total_count < 10:
        print(f"[-] Not enough training data (Current: {total_count}/10). Training aborted.")
        return
    
    # 3. Model Training
    # Try importing scikit-learn for Random Forest training
    try:
        from sklearn.ensemble import RandomForestClassifier
        import joblib
        import numpy as np
        
        print("[*] scikit-learn detected. Training RandomForestClassifier...")
        X = np.array([r[0:5] for r in total_samples_list], dtype=np.float32)
        y = np.array([r[5] for r in total_samples_list])
        
        model = RandomForestClassifier(n_estimators=50, random_state=42)
        model.fit(X, y)
        
        predictions = model.predict(X)
        correct = np.sum(predictions == y)
        accuracy = (correct / total_count) * 100
        
        pkl_path = os.path.join(os.path.dirname(__file__), 'ais_model.pkl')
        joblib.dump(model, pkl_path)
        
        if os.path.exists(MODEL_PATH):
            os.remove(MODEL_PATH)
            
        print(f"[+] RandomForest model trained and saved to {pkl_path}")
        save_training_status(accuracy, total_count)
        
    except ImportError:
        # Fallback to Distance-based Prototype Classifier
        print("[*] scikit-learn not found. Training Distance-based Prototype Classifier...")
        
        class_stats = {}
        for r in total_samples_list:
            decision = r[5]
            features = [float(val) for val in r[0:5]]
            if decision not in class_stats:
                class_stats[decision] = []
            class_stats[decision].append(features)
            
        # Compute mean feature vector for each class
        model_weights = {}
        for decision, samples in class_stats.items():
            n = len(samples)
            sum_vector = [sum(x) for x in zip(*samples)]
            mean_vector = [s / n for s in sum_vector]
            model_weights[decision] = mean_vector
            
        # Predict on training samples to measure Accuracy
        correct = 0
        for r in total_samples_list:
            features = [float(val) for val in r[0:5]]
            target = r[5]
            
            best_decision = "HOLD"
            min_dist = float('inf')
            
            for dec, mean_vec in model_weights.items():
                dist = sum((f - m) ** 2 for f, m in zip(features, mean_vec))
                if dist < min_dist:
                    min_dist = dist
                    best_decision = dec
            
            if best_decision == target:
                correct += 1
                
        accuracy = (correct / total_count) * 100
        
        with open(MODEL_PATH, 'w', encoding='utf-8') as f:
            json.dump(model_weights, f, ensure_ascii=False, indent=2)
            
        pkl_path = os.path.join(os.path.dirname(__file__), 'ais_model.pkl')
        if os.path.exists(pkl_path):
            os.remove(pkl_path)
            
        print(f"[+] Lightweight model weights saved to {MODEL_PATH}")
        save_training_status(accuracy, total_count)

if __name__ == "__main__":
    main()
