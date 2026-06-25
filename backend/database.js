const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { encryptText } = require('./secureCredentials');
const { migrateAisEvaluationSchema } = require('./aisEvaluation');
const { ensureCouncilBriefingHistorySchema } = require('./councilBriefingHistory');

const defaultDbName = process.env.NODE_ENV === 'development' ? 'platform_dev.db' : 'platform.db';
const dbPath = process.env.AIS_DB_PATH
  ? path.resolve(process.env.AIS_DB_PATH)
  : path.resolve(__dirname, defaultDbName);
const db = new sqlite3.Database(dbPath);

const AIDL_FEATURE_ORDER = [
  'price_change_pct',
  'rsi_scaled',
  'sma5_distance_pct',
  'sma20_distance_pct',
  'sma5_to_sma20_spread_pct',
];
const AIDL_ACTIONS = ['BUY', 'SELL', 'HOLD'];

function normalizePositiveInteger(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isCanonicalCentroidShape(weights) {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) return false;
  if (!AIDL_ACTIONS.every((action) => Object.prototype.hasOwnProperty.call(weights, action))) return false;
  if (Object.keys(weights).some((key) => !AIDL_ACTIONS.includes(key))) return false;
  return AIDL_ACTIONS.every((action) => (
    Array.isArray(weights[action])
    && weights[action].length === AIDL_FEATURE_ORDER.length
    && weights[action].every((value) => Number.isFinite(Number(value)))
  ));
}

function buildDeterministicCouncilDna(weights, memberId, faction, generation) {
  const normalizedGeneration = normalizePositiveInteger(generation);
  const baseKey = JSON.stringify({
    memberId,
    faction: faction || 'MUTANT_ROOKIE',
    generation: normalizedGeneration,
    weights,
  });
  const genomeHash = crypto.createHash('sha256').update(baseKey).digest('hex').slice(0, 24);
  let innovationId = 2;
  const subgenes = [];

  for (const action of AIDL_ACTIONS) {
    weights[action].forEach((weight, index) => {
      subgenes.push({
        gene_id: `${memberId}_${action}_${AIDL_FEATURE_ORDER[index]}`,
        innovation_id: innovationId,
        state: 'A',
        feature: AIDL_FEATURE_ORDER[index],
        action,
        weight: Number(weight),
        threshold: 0.0,
        priority: 1.0,
      });
      innovationId += 1;
    });
  }

  return {
    genome_id: `AISG-G${normalizedGeneration}-${genomeHash.slice(0, 8)}`,
    generation: normalizedGeneration,
    faction_hint: faction || 'MUTANT_ROOKIE',
    lineage: {
      parent_ids: [],
      ancestor_ids: [memberId],
      innovation_ids: Array.from({ length: innovationId - 1 }, (_, index) => index + 1),
    },
    regulatory_profile: {
      expression_budget: 12,
      dominance_bias: 1.0,
      decay_resistance: 0.3,
      reactivation_bias: 0.1,
    },
    strategy_genes: [
      {
        gene_id: `sg_${memberId}`,
        innovation_id: 1,
        state: 'A',
        dominance: 1.0,
        copy_number: 1,
        context_mask: ['BULL_EXPANSION', 'BULL_SQUEEZE', 'BEAR_EXPANSION', 'BEAR_SQUEEZE'],
        length: AIDL_FEATURE_ORDER.length,
        subgenes,
      },
    ],
    mutation_log: [],
  };
}

function bootstrapCouncilDnaPayload(weights, memberId, faction, generation) {
  if (!isCanonicalCentroidShape(weights)) {
    throw new Error('weights_json is not canonical BUY/SELL/HOLD 5-vector centroid shape');
  }
  const dna = buildDeterministicCouncilDna(weights, memberId, faction, generation);
  return {
    dna_json: JSON.stringify(dna),
    phenotype_json: JSON.stringify(weights),
  };
}

function addAisCouncilDnaColumns(callback) {
  db.run("ALTER TABLE ais_council_members ADD COLUMN dna_json TEXT", (dnaErr) => {
    if (dnaErr && !dnaErr.message.includes("duplicate column name")) {
      return callback(dnaErr);
    }
    db.run("ALTER TABLE ais_council_members ADD COLUMN phenotype_json TEXT", (phenotypeErr) => {
      if (phenotypeErr && !phenotypeErr.message.includes("duplicate column name")) {
        return callback(phenotypeErr);
      }
      callback();
    });
  });
}

function addAisCouncilCompatibilityColumns(callback) {
  db.run("ALTER TABLE ais_council_members ADD COLUMN faction TEXT DEFAULT 'MUTANT_ROOKIE'", (factionErr) => {
    if (factionErr && !factionErr.message.includes("duplicate column name")) {
      return callback(factionErr);
    }
    if (!factionErr) {
      db.run("UPDATE ais_council_members SET faction = 'TREND_FOLLOWER' WHERE member_id IN ('ais_member_01', 'ais_member_04', 'ais_member_08', 'ais_member_10')");
      db.run("UPDATE ais_council_members SET faction = 'VALUE_SEEKER' WHERE member_id IN ('ais_member_02', 'ais_member_07')");
      db.run("UPDATE ais_council_members SET faction = 'CONSERVATIVE_WATCHER' WHERE member_id IN ('ais_member_03', 'ais_member_11')");
      db.run("UPDATE ais_council_members SET faction = 'MUTANT_ROOKIE' WHERE member_id IN ('ais_member_05', 'ais_member_06', 'ais_member_09')");
    }
    db.run("ALTER TABLE ais_council_members ADD COLUMN generation INTEGER DEFAULT 1", (generationErr) => {
      if (generationErr && !generationErr.message.includes("duplicate column name")) {
        return callback(generationErr);
      }
      callback();
    });
  });
}

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {

      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wallet_address TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          country TEXT NOT NULL,
          id_card_path TEXT,
          referrer_address TEXT NOT NULL DEFAULT 'none',
          status TEXT NOT NULL CHECK (status IN ('PENDING_KYC', 'APPROVED', 'REJECTED')),
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          approved_at DATETIME,
          selected_coins TEXT DEFAULT '{"POL":50,"USDT":50}',
          manager_address TEXT DEFAULT 'none'
        )
      `, (err) => { if (err) return reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wallet_address TEXT NOT NULL,
          amount REAL NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAW_REQUEST', 'AI_TRADING_PROFIT')),
          status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
          tx_hash TEXT,
          distributed_amount REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (wallet_address) REFERENCES users (wallet_address)
        )
      `, (err) => { if (err) return reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS platform_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `, (err) => {
        if (err) return reject(err);
        db.run(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('global_mock_profit_percent', '0.0')`);
        db.run(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('global_ai_engine', 'GEMINI_ONLY')`);
        db.run(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('global_ai_interval_auto', 'OFF')`);
        db.run(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('automatic_promotion_enabled', 'OFF')`);
        db.run(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('aidl_context_mutation_rate', '0.10')`);
        db.run(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('aidl_state_mutation_rate', '0.10')`);
        db.run(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('aidl_profile_mutation_rate', '0.08')`);
        db.run(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('aidl_copy_number_mutation_rate', '0.06')`);
        db.run(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('aidl_weight_nudge_size', '0.02')`);
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS manager_yield_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          yield_percent REAL NOT NULL,
          recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => { if (err) return reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS manager_ai_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          decision TEXT NOT NULL,
          reason TEXT NOT NULL,
          proposed_price REAL NOT NULL,
          proposed_amount REAL NOT NULL,
          proposed_lower REAL DEFAULT 0.15,
          proposed_upper REAL DEFAULT 0.30,
          engine_mode TEXT DEFAULT 'GEMINI',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => { if (err) return reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS manager_gateio_credentials (
          manager_email TEXT PRIMARY KEY,
          encrypted_api_key TEXT NOT NULL,
          encrypted_api_secret TEXT NOT NULL,
          deposit_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => { if (err) return reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS manager_ai_settings (
          manager_email TEXT PRIMARY KEY,
          ai_grid_status TEXT NOT NULL DEFAULT 'OFF',
          ai_grid_lower TEXT NOT NULL DEFAULT '0.15',
          ai_grid_upper TEXT NOT NULL DEFAULT '0.30',
          ai_grid_auto_range TEXT NOT NULL DEFAULT 'OFF',
          ai_grid_count TEXT NOT NULL DEFAULT '5',
          ai_grid_frequency TEXT NOT NULL DEFAULT '5',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => { if (err) return reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS manager_trade_executions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          manager_email TEXT NOT NULL,
          ai_log_id INTEGER NOT NULL,
          side TEXT NOT NULL,
          amount REAL NOT NULL,
          price REAL NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'SKIPPED')),
          gateio_order_id TEXT,
          message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(manager_email, ai_log_id)
        )
      `, (err) => { if (err) return reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS manager_gateio_trades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          manager_email TEXT NOT NULL,
          trade_id TEXT NOT NULL,
          order_id TEXT,
          side TEXT NOT NULL,
          price REAL NOT NULL,
          amount REAL NOT NULL,
          deal REAL NOT NULL,
          fee TEXT DEFAULT '0',
          fee_currency TEXT DEFAULT 'USDT',
          create_time TEXT,
          create_time_ms TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(manager_email, trade_id)
        )
      `, (err) => { if (err) return reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS manager_gateio_transfers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          manager_email TEXT NOT NULL,
          transfer_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAW')),
          currency TEXT NOT NULL,
          amount REAL NOT NULL,
          txid TEXT,
          status TEXT,
          create_time TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(manager_email, transfer_id, type)
        )
      `, (err) => { if (err) return reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS ais_training_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          current_price REAL NOT NULL,
          price_change_ratio REAL NOT NULL,
          rsi_14 REAL NOT NULL,
          sma_5 REAL NOT NULL,
          sma_20 REAL NOT NULL,
          gemini_decision TEXT NOT NULL,
          gemini_proposed_price REAL NOT NULL,
          gemini_amount_ratio REAL NOT NULL,
          gemini_reason TEXT,
          next_price_5m REAL DEFAULT 0.0,
          realized_price_change REAL DEFAULT 0.0,
          is_correct_decision INTEGER DEFAULT -1,
          evaluation_due_at TEXT,
          evaluation_status TEXT DEFAULT 'PENDING',
          label_version INTEGER DEFAULT 2,
          engine_mode TEXT NOT NULL DEFAULT 'GEMINI'
        )
      `, (err) => {
        if (err) return reject(err);
        db.run(`CREATE INDEX IF NOT EXISTS IDX_AIS_TRAINING_TIME ON ais_training_data(timestamp)`);
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS manager_one_time_trade_tests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          manager_email TEXT NOT NULL,
          side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
          spend_usdt REAL NOT NULL,
          dry_run INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL CHECK (status IN ('PENDING', 'USED', 'CANCELLED')) DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          used_at DATETIME,
          used_ai_log_id INTEGER
        )
      `, (err) => { if (err) return reject(err); });

      db.get("SELECT value FROM platform_settings WHERE key = 'gateio_api_key'", (keyErr, keyRow) => {
        if (keyErr || !keyRow || !keyRow.value) return;
        db.get("SELECT value FROM platform_settings WHERE key = 'gateio_api_secret'", (secretErr, secretRow) => {
          if (secretErr || !secretRow || !secretRow.value) return;
          db.get("SELECT value FROM platform_settings WHERE key = 'gateio_deposit_address'", (depositErr, depositRow) => {
            if (depositErr) return;
            try {
              db.run(`
                INSERT OR IGNORE INTO manager_gateio_credentials
                  (manager_email, encrypted_api_key, encrypted_api_secret, deposit_address, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'))
              `, [
                'lemaiiisk@gmail.com',
                encryptText(keyRow.value),
                encryptText(secretRow.value),
                depositRow ? depositRow.value : ''
              ]);
            } catch (migrationErr) {
              console.error("Gate.io credential encryption migration failed:", migrationErr.message);
            }
          });
        });
      });

      const rootReferrerAddress = '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987';

      db.run(`
        INSERT OR IGNORE INTO users (
          wallet_address, email, name, phone, country, status, joined_at, approved_at
        ) VALUES (
          ?, 'lemaiiisk@gmail.com', '이명학', '010-1234-5678', 'Korea', 'APPROVED', datetime('now'), datetime('now')
        )
      `, [rootReferrerAddress]);

      db.run("ALTER TABLE users ADD COLUMN is_manager INTEGER DEFAULT 0", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error("❌ users 테이블 is_manager 컬럼 마이그레이션 실패:", err.message);
        }
      });

      db.run("ALTER TABLE manager_ai_logs ADD COLUMN proposed_lower REAL DEFAULT 0.15", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error("❌ manager_ai_logs 테이블 proposed_lower 컬럼 마이그레이션 실패:", err.message);
        }
      });

      db.run("ALTER TABLE manager_ai_logs ADD COLUMN proposed_upper REAL DEFAULT 0.30", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error("❌ manager_ai_logs 테이블 proposed_upper 컬럼 마이그레이션 실패:", err.message);
        }
      });

      db.run("ALTER TABLE manager_ai_settings ADD COLUMN ai_grid_auto_range TEXT NOT NULL DEFAULT 'OFF'", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error("manager_ai_settings table ai_grid_auto_range column migration failed:", err.message);
        }
      });

      db.run("ALTER TABLE ais_training_data ADD COLUMN engine_mode TEXT NOT NULL DEFAULT 'GEMINI'", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error("❌ ais_training_data engine_mode 컬럼 마이그레이션 실패:", err.message);
        }
      });

      db.run("ALTER TABLE manager_ai_logs ADD COLUMN engine_mode TEXT DEFAULT 'GEMINI'", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error("❌ manager_ai_logs engine_mode 컬럼 마이그레이션 실패:", err.message);
        }
      });

      db.run("UPDATE platform_settings SET value = 'GEMINI' WHERE key = 'global_ai_engine' AND value IN ('GEMINI_ONLY', 'GEMINI_AIS_SHADOW')", (err) => {
        if (err) console.error("❌ platform_settings 엔진 모드 통합 마이그레이션 실패:", err.message);
      });

      db.serialize(() => {
        db.all("PRAGMA table_info(users)", (pragmaErr, columns) => {
          if (!pragmaErr && columns && columns.length > 0) {
            const hasTier = columns.some(col => col.name === 'tier');
            if (hasTier) {
              console.log("[MIGRATION] users 테이블 스키마 갱신을 시작합니다. (tier, trial_ends_at 컬럼 삭제)");
              db.serialize(() => {
                db.run(`
                  CREATE TABLE IF NOT EXISTS users_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    wallet_address TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    country TEXT NOT NULL,
                    id_card_path TEXT,
                    referrer_address TEXT NOT NULL DEFAULT 'none',
                    status TEXT NOT NULL CHECK (status IN ('PENDING_KYC', 'APPROVED', 'REJECTED')),
                    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    approved_at DATETIME,
                    selected_coins TEXT DEFAULT '{"POL":50,"USDT":50}',
                    manager_address TEXT DEFAULT 'none',
                    is_manager INTEGER DEFAULT 0
                  )
                `);
                db.run(`
                  INSERT INTO users_new (id, wallet_address, email, name, phone, country, id_card_path, referrer_address, status, joined_at, approved_at, selected_coins, manager_address, is_manager)
                  SELECT id, wallet_address, email, name, phone, country, id_card_path, referrer_address, status, joined_at, approved_at, selected_coins, manager_address, is_manager FROM users
                `);
                db.run(`DROP TABLE users`);
                db.run(`ALTER TABLE users_new RENAME TO users`);
                console.log("✔ [MIGRATION SUCCESS] users 테이블 스키마 갱신 및 컬럼 삭제가 완료되었습니다.");
              });
            }
          }
        });
      });

      db.run(`
        UPDATE users
        SET email = 'lemaiiisk@gmail.com',
            name = '이명학',
            status = 'APPROVED',
            is_manager = 1,
            manager_address = 'none',
            referrer_address = 'none'
        WHERE wallet_address = ?
      `, [rootReferrerAddress]);

      db.run(`
        UPDATE users
        SET manager_address = 'none',
            referrer_address = 'none'
        WHERE is_manager = 1
      `);

      db.serialize(() => {
        db.all("SELECT id, type FROM payments WHERE type IN ('MONTHLY_SUBSCRIPTION', 'MEMBERSHIP_FEE')", (selErr, selRows) => {
          if (!selErr && selRows && selRows.length > 0) {
            console.log(`[MIGRATION] Migrating payments table schema. Deleting ${selRows.length} old billing rows.`);
            db.serialize(() => {
              db.run(`
                CREATE TABLE IF NOT EXISTS payments_new (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  wallet_address TEXT NOT NULL,
                  amount REAL NOT NULL,
                  type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAW_REQUEST', 'AI_TRADING_PROFIT')),
                  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
                  tx_hash TEXT,
                  distributed_amount REAL DEFAULT 0,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (wallet_address) REFERENCES users (wallet_address)
                )
              `);
              db.run(`
                INSERT INTO payments_new (id, wallet_address, amount, type, status, tx_hash, distributed_amount, created_at)
                SELECT id, wallet_address, amount, type, status, tx_hash, distributed_amount, created_at
                FROM payments
                WHERE type NOT IN ('MONTHLY_SUBSCRIPTION', 'MEMBERSHIP_FEE')
              `);
              db.run(`DROP TABLE payments`);
              db.run(`ALTER TABLE payments_new RENAME TO payments`);
              console.log('✔ [MIGRATION SUCCESS] payments table updated and old billing data purged successfully.');
            });
          } else {
            db.run("INSERT INTO payments (wallet_address, amount, type, status, tx_hash) VALUES ('0x0000000000000000000000000000000000000000', 0, 'DEPOSIT', 'FAILED', '0xSchemaTest')", (insErr) => {
              if (insErr && insErr.message.includes("CHECK constraint failed")) {
                console.log("[MIGRATION] CHECK constraint test failed. Migrating payments table schema.");
                db.serialize(() => {
                  db.run(`CREATE TABLE IF NOT EXISTS payments_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    wallet_address TEXT NOT NULL,
                    amount REAL NOT NULL,
                    type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAW_REQUEST', 'AI_TRADING_PROFIT')),
                    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
                    tx_hash TEXT,
                    distributed_amount REAL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (wallet_address) REFERENCES users (wallet_address)
                  )`);
                  db.run(`INSERT INTO payments_new (id, wallet_address, amount, type, status, tx_hash, distributed_amount, created_at)
                          SELECT id, wallet_address, amount, type, status, tx_hash, distributed_amount, created_at
                          FROM payments
                          WHERE type NOT IN ('MONTHLY_SUBSCRIPTION', 'MEMBERSHIP_FEE')`);
                  db.run(`DROP TABLE payments`);
                  db.run(`ALTER TABLE payments_new RENAME TO payments`);
                  console.log('✔ [MIGRATION SUCCESS] payments table CHECK constraint updated and purged.');
                });
              } else {
                db.run("DELETE FROM payments WHERE tx_hash = '0xSchemaTest'");
              }
            });
          }
        });
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS ais_council_members (
          member_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          weights_json TEXT NOT NULL,
          dna_json TEXT,
          phenotype_json TEXT,
          voting_power REAL DEFAULT 1.0,
          correct_count INTEGER DEFAULT 0,
          total_count INTEGER DEFAULT 0,
          status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'CANDIDATE', 'RETIRED')) DEFAULT 'ACTIVE',
          faction TEXT DEFAULT 'MUTANT_ROOKIE',
          generation INTEGER DEFAULT 1,
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) return reject(err);
        
        const initialMembers = [
          {
            id: 'ais_member_01',
            name: 'Trend Follower (SMA)',
            faction: 'TREND_FOLLOWER',
            weights: {
              BUY: [0.155, 0.2, 50.0, 0.156, 0.154],
              SELL: [0.155, -0.2, 50.0, 0.154, 0.156],
              HOLD: [0.155, 0.0, 50.0, 0.155, 0.155]
            }
          },
          {
            id: 'ais_member_02',
            name: 'Value Seeker (RSI)',
            faction: 'VALUE_SEEKER',
            weights: {
              BUY: [0.150, 0.0, 28.0, 0.150, 0.150],
              SELL: [0.165, 0.0, 72.0, 0.165, 0.165],
              HOLD: [0.158, 0.0, 50.0, 0.158, 0.158]
            }
          },
          {
            id: 'ais_member_03',
            name: 'Conservative Watcher (Safety)',
            faction: 'CONSERVATIVE_WATCHER',
            weights: {
              BUY: [0.140, -1.5, 20.0, 0.138, 0.142],
              SELL: [0.180, 1.5, 80.0, 0.182, 0.178],
              HOLD: [0.158, 0.0, 50.0, 0.158, 0.158]
            }
          },
          {
            id: 'ais_member_04',
            name: 'Short Specialist (Bear)',
            faction: 'TREND_FOLLOWER',
            weights: {
              BUY: [0.145, 0.0, 25.0, 0.145, 0.145],
              SELL: [0.155, -0.1, 60.0, 0.154, 0.156],
              HOLD: [0.158, 0.0, 48.0, 0.158, 0.158]
            }
          },
          {
            id: 'ais_member_05',
            name: 'Mutant Alpha (Genetics)',
            faction: 'MUTANT_ROOKIE',
            weights: {
              BUY: [0.152, -0.8, 33.0, 0.150, 0.153],
              SELL: [0.162, 0.8, 67.0, 0.164, 0.161],
              HOLD: [0.156, 0.1, 52.0, 0.156, 0.156]
            }
          },
          {
            id: 'ais_member_06',
            name: 'Mutant Beta (Aggressive)',
            faction: 'MUTANT_ROOKIE',
            weights: {
              BUY: [0.157, 1.2, 40.0, 0.158, 0.155],
              SELL: [0.160, 1.2, 75.0, 0.162, 0.159],
              HOLD: [0.156, 0.0, 50.0, 0.156, 0.156]
            }
          },
          {
            id: 'ais_member_07',
            name: 'RSI Contrarian (Reversal)',
            faction: 'VALUE_SEEKER',
            weights: {
              BUY: [0.160, 0.5, 22.0, 0.158, 0.159],
              SELL: [0.148, -0.5, 78.0, 0.150, 0.149],
              HOLD: [0.155, 0.0, 50.0, 0.155, 0.155]
            }
          },
          {
            id: 'ais_member_08',
            name: 'SMA Slow Cross (Long-term)',
            faction: 'TREND_FOLLOWER',
            weights: {
              BUY: [0.158, 0.1, 52.0, 0.162, 0.154],
              SELL: [0.152, -0.1, 48.0, 0.148, 0.156],
              HOLD: [0.155, 0.0, 50.0, 0.155, 0.155]
            }
          },
          {
            id: 'ais_member_09',
            name: 'Mutant Gamma (Volatility)',
            faction: 'MUTANT_ROOKIE',
            weights: {
              BUY: [0.149, -1.0, 31.0, 0.147, 0.151],
              SELL: [0.166, 1.0, 69.0, 0.168, 0.164],
              HOLD: [0.157, 0.0, 50.0, 0.157, 0.157]
            }
          },
          {
            id: 'ais_member_10',
            name: 'Price Momentum Seeker',
            faction: 'TREND_FOLLOWER',
            weights: {
              BUY: [0.159, 1.5, 55.0, 0.160, 0.157],
              SELL: [0.151, -1.5, 45.0, 0.150, 0.153],
              HOLD: [0.155, 0.0, 50.0, 0.155, 0.155]
            }
          },
          {
            id: 'ais_member_11',
            name: 'Volatility Shield (Safety)',
            faction: 'CONSERVATIVE_WATCHER',
            weights: {
              BUY: [0.135, -2.0, 18.0, 0.133, 0.137],
              SELL: [0.185, 2.0, 82.0, 0.187, 0.183],
              HOLD: [0.158, 0.0, 50.0, 0.158, 0.158]
            }
          }
        ];
        
        addAisCouncilCompatibilityColumns((compatErr) => {
          if (compatErr) return reject(compatErr);
          addAisCouncilDnaColumns((columnErr) => {
            if (columnErr) return reject(columnErr);
            db.get("SELECT COUNT(*) AS count FROM ais_council_members", (countErr, row) => {
              if (countErr) return reject(countErr);
              if (row.count > 0) return;

              initialMembers.forEach(m => {
                const dnaPayload = bootstrapCouncilDnaPayload(m.weights, m.id, m.faction, 1);
                db.run(`
                  INSERT INTO ais_council_members
                    (member_id, name, weights_json, dna_json, phenotype_json, voting_power, status, faction, generation)
                  VALUES (?, ?, ?, ?, ?, 1.0, 'ACTIVE', ?, 1)
                `, [m.id, m.name, JSON.stringify(m.weights), dnaPayload.dna_json, dnaPayload.phenotype_json, m.faction]);
              });
            });
          });
        });
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS ais_council_voting_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          member_id TEXT NOT NULL,
          decision_vote TEXT NOT NULL,
          weight_at_vote REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (member_id) REFERENCES ais_council_members (member_id)
        )
      `, async (err) => {
        if (err) return reject(err);
        db.run(`
          CREATE TABLE IF NOT EXISTS ais_genome_archive (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id TEXT NOT NULL,
            genome_id TEXT NOT NULL,
            generation INTEGER NOT NULL,
            archive_reason TEXT NOT NULL,
            dna_json TEXT NOT NULL,
            archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, async (archiveErr) => {
          if (archiveErr) return reject(archiveErr);
          try {
            await ensureCouncilBriefingHistorySchema(queries);
            await migrateAisEvaluationSchema(db);
            await bootstrapLegacyCouncilDna();
            console.log('✔ SQLite Database initialized successfully with Root Referrers.');
            resolve();
          } catch (migrationError) {
            reject(migrationError);
          }
        });
      });
    });
  });
}

const queries = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
};

async function bootstrapLegacyCouncilDna() {
  const rows = await queries.all(`
    SELECT member_id, weights_json, faction, generation
    FROM ais_council_members
    WHERE (dna_json IS NULL OR dna_json = '' OR phenotype_json IS NULL OR phenotype_json = '')
      AND weights_json IS NOT NULL
      AND weights_json != ''
  `);

  for (const row of rows) {
    try {
      const weights = JSON.parse(row.weights_json);
      const payload = bootstrapCouncilDnaPayload(
        weights,
        row.member_id,
        row.faction || 'MUTANT_ROOKIE',
        row.generation || 1
      );
      await queries.run(`
        UPDATE ais_council_members
        SET dna_json = ?, phenotype_json = ?
        WHERE member_id = ?
      `, [payload.dna_json, payload.phenotype_json, row.member_id]);
    } catch (error) {
      console.warn(`[DNA BOOTSTRAP] ${row.member_id} skipped: ${error.message}`);
    }
  }
}

async function repairAiCouncilState() {
  const totalRow = await queries.get("SELECT COUNT(*) AS count FROM ais_council_members");
  let total = totalRow ? totalRow.count : 0;
  if (total <= 11) return { total, active: total, repaired: false };

  const initialIds = Array.from(
    { length: 11 },
    (_, index) => `ais_member_${String(index + 1).padStart(2, '0')}`
  );
  const placeholders = initialIds.map(() => '?').join(',');
  await queries.run(
    `UPDATE ais_council_members
     SET status = 'CANDIDATE'
     WHERE status = 'ACTIVE'
       AND total_count = 0
       AND member_id IN (${placeholders})`,
    initialIds
  );

  while (total < 500) {
    const seed = await queries.get(`
      SELECT weights_json, faction, generation
      FROM ais_council_members
      ORDER BY RANDOM()
      LIMIT 1
    `);
    const memberId = `mutant_refill_${crypto.randomUUID().replace(/-/g, '')}`;
    const weights = JSON.parse(seed.weights_json);
    const dnaPayload = bootstrapCouncilDnaPayload(
      weights,
      memberId,
      seed.faction || 'MUTANT_ROOKIE',
      seed.generation || 1
    );
    await queries.run(`
      INSERT INTO ais_council_members
        (member_id, name, weights_json, dna_json, phenotype_json, voting_power, status, faction, generation)
      VALUES (?, ?, ?, ?, ?, 1.0, 'CANDIDATE', ?, ?)
    `, [
      memberId,
      `Mutant Pool Refill ${total + 1}`,
      seed.weights_json,
      dnaPayload.dna_json,
      dnaPayload.phenotype_json,
      seed.faction || 'MUTANT_ROOKIE',
      seed.generation || 1
    ]);
    total += 1;
  }

  const activeRow = await queries.get(
    "SELECT COUNT(*) AS count FROM ais_council_members WHERE status = 'ACTIVE'"
  );
  return { total, active: activeRow.count, repaired: true };
}

module.exports = {
  db,
  bootstrapCouncilDnaPayload,
  buildDeterministicCouncilDna,
  initializeDatabase,
  queries,
  repairAiCouncilState
};
