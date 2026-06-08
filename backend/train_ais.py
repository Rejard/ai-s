import sqlite3
import os
import json
import math
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'platform.db')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'ais_model_weights.json')

def load_data():
    if not os.path.exists(DB_PATH):
        print("[-] Database file does not exist.")
        return []
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Load only feedback-completed records
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
    print("[*] Starting AiS Model Auto-Retraining...")
    rows = load_data()
    total_samples = len(rows)
    
    # Require at least 10 samples for a valid learning cycle
    if total_samples < 10:
        print(f"[-] Not enough training data (Current: {total_samples}/10). Training aborted.")
        return
    
    # Features index mapping:
    # 0: current_price, 1: price_change_ratio, 2: rsi_14, 3: sma_5, 4: sma_20, 5: decision (Target)
    
    # Try importing scikit-learn for advanced model training
    try:
        from sklearn.ensemble import RandomForestClassifier
        import joblib
        import numpy as np
        
        print("[*] scikit-learn detected. Training RandomForestClassifier...")
        X = np.array([r[0:5] for r in rows], dtype=np.float32)
        y = np.array([r[5] for r in rows])
        
        # Train simple Random Forest
        model = RandomForestClassifier(n_estimators=50, random_state=42)
        model.fit(X, y)
        
        # Calculate accuracy on training data (Self-Accuracy)
        predictions = model.predict(X)
        correct = np.sum(predictions == y)
        accuracy = (correct / total_samples) * 100
        
        # Save Scikit-learn model
        pkl_path = os.path.join(os.path.dirname(__file__), 'ais_model.pkl')
        joblib.dump(model, pkl_path)
        
        # Also remove json weights to clean up fallback state
        if os.path.exists(MODEL_PATH):
            os.remove(MODEL_PATH)
            
        print(f"[+] RandomForest model trained and saved to {pkl_path}")
        save_training_status(accuracy, total_samples)
        
    except ImportError:
        # Fallback to Lightweight Weight Learner (Distance-based prototype classifier)
        # Calculates mean feature vectors for each class: BUY, SELL, HOLD
        print("[*] scikit-learn not found. Falling back to Lightweight Weight Learner...")
        
        class_stats = {}
        for r in rows:
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
        for r in rows:
            features = [float(val) for val in r[0:5]]
            target = r[5]
            
            # Find closest class vector by Euclidean distance
            best_decision = "HOLD"
            min_dist = float('inf')
            
            for dec, mean_vec in model_weights.items():
                # Compute distance
                dist = sum((f - m) ** 2 for f, m in zip(features, mean_vec))
                if dist < min_dist:
                    min_dist = dist
                    best_decision = dec
            
            if best_decision == target:
                correct += 1
                
        accuracy = (correct / total_samples) * 100
        
        # Save weights to json file
        with open(MODEL_PATH, 'w', encoding='utf-8') as f:
            json.dump(model_weights, f, ensure_ascii=False, indent=2)
            
        # Clean up legacy scikit-learn file if exists to prevent model collision
        pkl_path = os.path.join(os.path.dirname(__file__), 'ais_model.pkl')
        if os.path.exists(pkl_path):
            os.remove(pkl_path)
            
        print(f"[+] Lightweight model weights saved to {MODEL_PATH}")
        save_training_status(accuracy, total_samples)

if __name__ == "__main__":
    main()
