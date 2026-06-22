const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const tempDbPath = path.join(os.tmpdir(), `admin-aidl-policy-${process.pid}-${Date.now()}.db`);
  process.env.AIS_DB_PATH = tempDbPath;

  const database = require('./database');
  const adminRouter = require('./routes/admin');
  const gridBot = require('./gridBot');

  try {
    await database.initializeDatabase();

    const settings = await database.queries.all(`
      SELECT key, value
      FROM platform_settings
      WHERE key IN (
        'aidl_context_mutation_rate',
        'aidl_state_mutation_rate',
        'aidl_profile_mutation_rate',
        'aidl_copy_number_mutation_rate',
        'aidl_weight_nudge_size'
      )
      ORDER BY key
    `);

    const policy = adminRouter.__private__.buildAidlPolicyConfig(settings);

    assert.deepEqual(policy, {
      contextMutationRate: '0.10',
      stateMutationRate: '0.10',
      profileMutationRate: '0.08',
      copyNumberMutationRate: '0.06',
      weightNudgeSize: '0.02',
    });
    assert.deepEqual(
      adminRouter.__private__.normalizeAidlPolicyConfig({
        contextMutationRate: '1.7',
        stateMutationRate: '-1',
        profileMutationRate: 'abc',
        copyNumberMutationRate: '0.3333',
        weightNudgeSize: '9',
      }),
      {
        contextMutationRate: '1.00',
        stateMutationRate: '0.00',
        profileMutationRate: '0.08',
        copyNumberMutationRate: '0.33',
        weightNudgeSize: '1.00',
      }
    );

    assert.equal(adminRouter.__private__.buildGeminiTimeoutConfig([]), '30000');
    assert.equal(
      adminRouter.__private__.buildGeminiTimeoutConfig([{ key: 'global_gemini_timeout_ms', value: '45000' }]),
      '45000'
    );
    assert.equal(
      adminRouter.__private__.buildGeminiTimeoutConfig([{ key: 'global_gemini_timeout_ms', value: '2000' }]),
      '5000'
    );
    assert.equal(
      adminRouter.__private__.buildGeminiTimeoutConfig([{ key: 'global_gemini_timeout_ms', value: '999999' }]),
      '120000'
    );

    assert.equal(gridBot.__private__.resolveGeminiTimeoutMs([]), 30000);
    assert.equal(
      gridBot.__private__.resolveGeminiTimeoutMs([{ key: 'global_gemini_timeout_ms', value: '45000' }]),
      45000
    );

    const dna = {
      genome_id: 'AISG-G1-test0001',
      generation: 1,
      lineage: { parent_ids: [], ancestor_ids: ['seed'], innovation_ids: [1, 2] },
      regulatory_profile: {
        expression_budget: 12,
        dominance_bias: 1.0,
        decay_resistance: 0.3,
        reactivation_bias: 0.1,
      },
      strategy_genes: [
        {
          gene_id: 'sg_member_1',
          innovation_id: 1,
          state: 'A',
          dominance: 1.0,
          copy_number: 1,
          context_mask: ['BULL_EXPANSION', 'BULL_SQUEEZE', 'BEAR_EXPANSION', 'BEAR_SQUEEZE'],
          length: 1,
          subgenes: [
            {
              gene_id: 'buy_rsi',
              innovation_id: 2,
              state: 'A',
              feature: 'rsi_scaled',
              action: 'BUY',
              weight: -0.4,
              threshold: 0,
              priority: 1,
            },
          ],
        },
      ],
      mutation_log: [],
      fitness_history: [
        { validationScore: 49.5, holdoutScore: 47.2, runKey: 'seed-run' },
      ],
    };

    const overrideResult = adminRouter.__private__.applyAidlGeneStateOverride({
      dna,
      geneId: 'sg_member_1',
      nextState: 'L',
    });
    assert.equal(overrideResult.dna.strategy_genes[0].state, 'L');
    assert.equal(overrideResult.phenotype.BUY[1], 0);
    assert.equal(
      overrideResult.dna.mutation_log.at(-1).event,
      'admin_state_override'
    );
    assert.equal(
      overrideResult.dna.mutation_log.at(-1).pre_validation_score,
      49.5
    );
    assert.equal(
      overrideResult.dna.mutation_log.at(-1).pre_holdout_score,
      47.2
    );

    assert.throws(
      () => adminRouter.__private__.applyAidlGeneStateOverride({
        dna,
        geneId: 'missing_gene',
        nextState: 'I',
      }),
      /gene not found/i
    );

    const contextEnabled = adminRouter.__private__.applyAidlGeneContextOverride({
      dna,
      geneId: 'sg_member_1',
      contextKey: 'BLACK_SWAN',
      enabled: true,
    });
    assert.deepEqual(contextEnabled.dna.strategy_genes[0].context_mask, [
      'BULL_EXPANSION',
      'BULL_SQUEEZE',
      'BEAR_EXPANSION',
      'BEAR_SQUEEZE',
      'BLACK_SWAN',
    ]);
    assert.equal(
      contextEnabled.dna.mutation_log.at(-1).event,
      'admin_context_override'
    );
    assert.equal(
      contextEnabled.dna.mutation_log.at(-1).action,
      'added'
    );
    assert.equal(
      contextEnabled.dna.mutation_log.at(-1).pre_validation_score,
      49.5
    );
    assert.equal(
      contextEnabled.dna.mutation_log.at(-1).pre_holdout_score,
      47.2
    );

    const contextDisabled = adminRouter.__private__.applyAidlGeneContextOverride({
      dna: contextEnabled.dna,
      geneId: 'sg_member_1',
      contextKey: 'BLACK_SWAN',
      enabled: false,
    });
    assert.deepEqual(contextDisabled.dna.strategy_genes[0].context_mask, [
      'BULL_EXPANSION',
      'BULL_SQUEEZE',
      'BEAR_EXPANSION',
      'BEAR_SQUEEZE',
    ]);
    assert.equal(
      contextDisabled.dna.mutation_log.at(-1).action,
      'removed'
    );

    assert.throws(
      () => adminRouter.__private__.applyAidlGeneContextOverride({
        dna,
        geneId: 'buy_rsi',
        contextKey: 'BLACK_SWAN',
        enabled: true,
      }),
      /strategy gene not found/i
    );
  } finally {
    await new Promise((resolve) => database.db.close(resolve));
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    delete process.env.AIS_DB_PATH;
  }

  console.log('adminAidlPolicy tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
