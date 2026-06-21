import unittest
import copy
import json
from unittest.mock import patch

from ais_dna import (
    bootstrap_dna_from_legacy,
    build_expression_plan,
    build_phenotype_from_dna,
    crossover_dna,
    mutate_dna,
    validate_dna,
)
from ais_features import validate_centroids
from train_ais import load_candidate_dna


class AiSDnaTests(unittest.TestCase):
    def _legacy_centroids(self):
        return {
            "BUY": [-0.5, -0.4, 0.1, 0.0, 0.05],
            "SELL": [0.4, 0.3, -0.1, -0.05, 0.02],
            "HOLD": [0.0, 0.0, 0.0, 0.0, 0.0],
        }

    def _valid_dna(self):
        return bootstrap_dna_from_legacy(
            self._legacy_centroids(),
            member_id="legacy_member_03",
            faction="VALUE_SEEKER",
            generation=1,
        )

    def test_bootstrap_from_legacy_centroids_builds_valid_dna(self):
        legacy = self._legacy_centroids()

        dna = bootstrap_dna_from_legacy(
            legacy,
            member_id="legacy_member_01",
            faction="VALUE_SEEKER",
            generation=2,
        )

        self.assertTrue(validate_dna(dna))
        self.assertEqual(dna["generation"], 2)
        self.assertGreaterEqual(len(dna["strategy_genes"]), 1)

    def test_bootstrap_preserves_legacy_centroid_values_in_phenotype(self):
        legacy = self._legacy_centroids()

        dna = bootstrap_dna_from_legacy(
            legacy,
            member_id="legacy_member_01",
            faction="VALUE_SEEKER",
            generation=2,
        )
        phenotype = build_phenotype_from_dna(dna)

        self.assertEqual(phenotype, legacy)

    def test_bootstrap_rejects_short_legacy_vector(self):
        legacy = self._legacy_centroids()
        legacy["BUY"] = legacy["BUY"][:4]

        with self.assertRaises(ValueError):
            bootstrap_dna_from_legacy(legacy, "legacy_member_01", "VALUE_SEEKER", 1)

    def test_bootstrap_rejects_missing_legacy_action(self):
        legacy = self._legacy_centroids()
        del legacy["SELL"]

        with self.assertRaises(ValueError):
            bootstrap_dna_from_legacy(legacy, "legacy_member_01", "VALUE_SEEKER", 1)

    def test_bootstrap_rejects_non_finite_legacy_weight(self):
        for invalid_weight in (float("nan"), float("inf")):
            with self.subTest(invalid_weight=invalid_weight):
                legacy = self._legacy_centroids()
                legacy["HOLD"][2] = invalid_weight

                with self.assertRaises(ValueError):
                    bootstrap_dna_from_legacy(legacy, "legacy_member_01", "VALUE_SEEKER", 1)

    def test_bootstrap_rejects_out_of_range_legacy_weight(self):
        legacy = self._legacy_centroids()
        legacy["BUY"][0] = 999.0

        with self.assertRaises(ValueError):
            bootstrap_dna_from_legacy(legacy, "legacy_member_01", "VALUE_SEEKER", 1)

    def test_bootstrap_rejects_invalid_generation_values(self):
        for invalid_generation in (True, False, "2", -1, 0):
            with self.subTest(invalid_generation=invalid_generation):
                with self.assertRaises(ValueError):
                    bootstrap_dna_from_legacy(
                        self._legacy_centroids(),
                        "legacy_member_01",
                        "VALUE_SEEKER",
                        invalid_generation,
                    )

    def test_validate_dna_rejects_boolean_generation(self):
        dna = self._valid_dna()
        dna["generation"] = True

        self.assertFalse(validate_dna(dna))

    def test_validate_dna_rejects_non_positive_generation(self):
        dna = self._valid_dna()
        dna["generation"] = 0

        self.assertFalse(validate_dna(dna))

    def test_validate_dna_rejects_non_string_lineage_ids(self):
        dna = self._valid_dna()
        dna["lineage"]["ancestor_ids"] = [123]

        self.assertFalse(validate_dna(dna))

    def test_validate_dna_rejects_malformed_strategy_gene(self):
        dna = self._valid_dna()
        del dna["strategy_genes"][0]["innovation_id"]

        self.assertFalse(validate_dna(dna))

    def test_validate_dna_rejects_empty_lineage(self):
        dna = self._valid_dna()
        dna["lineage"] = {}

        self.assertFalse(validate_dna(dna))

    def test_validate_dna_rejects_empty_regulatory_profile(self):
        dna = self._valid_dna()
        dna["regulatory_profile"] = {}

        self.assertFalse(validate_dna(dna))

    def test_validate_dna_rejects_strategy_missing_copy_number(self):
        dna = self._valid_dna()
        del dna["strategy_genes"][0]["copy_number"]

        self.assertFalse(validate_dna(dna))

    def test_validate_dna_rejects_empty_strategy_subgenes(self):
        dna = self._valid_dna()
        dna["strategy_genes"][0]["subgenes"] = []

        self.assertFalse(validate_dna(dna))

    def test_validate_dna_rejects_malformed_subgene(self):
        dna = self._valid_dna()
        dna["strategy_genes"][0]["subgenes"][0]["weight"] = float("inf")

        self.assertFalse(validate_dna(dna))

    def test_validate_dna_rejects_subgene_missing_threshold(self):
        dna = self._valid_dna()
        del dna["strategy_genes"][0]["subgenes"][0]["threshold"]

        self.assertFalse(validate_dna(dna))

    def test_expression_plan_excludes_inactive_and_lethal_genes(self):
        dna = {
            "genome_id": "g1",
            "generation": 1,
            "lineage": {
                "parent_ids": [],
                "ancestor_ids": ["seed"],
                "innovation_ids": [1, 2, 3, 4],
            },
            "regulatory_profile": {
                "expression_budget": 12,
                "dominance_bias": 1.0,
                "decay_resistance": 0.3,
                "reactivation_bias": 0.1,
            },
            "strategy_genes": [
                {
                    "gene_id": "sg1",
                    "innovation_id": 1,
                    "state": "A",
                    "dominance": 1.0,
                    "copy_number": 1,
                    "length": 3,
                    "subgenes": [
                        {
                            "gene_id": "buy_active",
                            "innovation_id": 2,
                            "state": "A",
                            "feature": "rsi_scaled",
                            "action": "BUY",
                            "weight": -0.6,
                            "threshold": -0.4,
                            "priority": 1.0,
                        },
                        {
                            "gene_id": "buy_inactive",
                            "innovation_id": 3,
                            "state": "I",
                            "feature": "price_change_pct",
                            "action": "BUY",
                            "weight": 0.5,
                            "threshold": 0.0,
                            "priority": 1.0,
                        },
                        {
                            "gene_id": "buy_lethal",
                            "innovation_id": 4,
                            "state": "L",
                            "feature": "sma5_distance_pct",
                            "action": "BUY",
                            "weight": 0.9,
                            "threshold": 0.0,
                            "priority": 1.0,
                        },
                    ],
                }
            ],
            "mutation_log": [],
        }

        plan = build_expression_plan(dna)
        gene_ids = [gene["gene_id"] for gene in plan["expressed_subgenes"]]

        self.assertIn("buy_active", gene_ids)
        self.assertNotIn("buy_inactive", gene_ids)
        self.assertNotIn("buy_lethal", gene_ids)

    def test_expression_plan_weakens_deprecated_subgenes(self):
        dna = {
            "genome_id": "g2",
            "generation": 1,
            "lineage": {"parent_ids": [], "ancestor_ids": ["seed"], "innovation_ids": [1, 2]},
            "regulatory_profile": {
                "expression_budget": 12,
                "dominance_bias": 1.0,
                "decay_resistance": 0.3,
                "reactivation_bias": 0.1,
            },
            "strategy_genes": [
                {
                    "gene_id": "sg1",
                    "innovation_id": 1,
                    "state": "A",
                    "dominance": 1.0,
                    "copy_number": 1,
                    "length": 1,
                    "subgenes": [
                        {
                            "gene_id": "sell_deprecated",
                            "innovation_id": 2,
                            "state": "D",
                            "feature": "rsi_scaled",
                            "action": "SELL",
                            "weight": 0.8,
                            "threshold": 0.0,
                            "priority": 1.0,
                        }
                    ],
                }
            ],
            "mutation_log": [],
        }

        plan = build_expression_plan(dna)

        self.assertEqual(plan["expressed_subgenes"][0]["weight"], 0.4)

    def test_ribosome_output_stays_centroid_compatible(self):
        legacy = {
            "BUY": [-0.5, -0.4, 0.1, 0.0, 0.05],
            "SELL": [0.4, 0.3, -0.1, -0.05, 0.02],
            "HOLD": [0.0, 0.0, 0.0, 0.0, 0.0],
        }
        dna = bootstrap_dna_from_legacy(
            legacy,
            member_id="legacy_member_02",
            faction="VALUE_SEEKER",
            generation=1,
        )

        phenotype = build_phenotype_from_dna(dna)

        self.assertTrue(validate_centroids(phenotype))

    def test_mutation_keeps_phenotype_centroid_compatible_at_feature_limit(self):
        legacy = {
            "BUY": [20.0, -0.4, 0.1, 0.0, 0.05],
            "SELL": [0.4, 0.3, -0.1, -0.05, 0.02],
            "HOLD": [0.0, 0.0, 0.0, 0.0, 0.0],
        }
        dna = bootstrap_dna_from_legacy(
            legacy,
            member_id="limit_member",
            faction="TREND_FOLLOWER",
            generation=1,
        )

        with patch("random.random", side_effect=[0.99, 0.99, 0.99] * 5):
            mutated = mutate_dna(dna)
        phenotype = build_phenotype_from_dna(mutated)

        self.assertTrue(validate_centroids(phenotype))

    def test_mutation_records_parent_lineage(self):
        dna = self._valid_dna()

        mutated = mutate_dna(
            dna,
            runtime_policy={
                "context_mutation_rate": 0.0,
                "state_mutation_rate": 0.0,
                "weight_nudge_size": 0.02,
            },
        )

        self.assertEqual(mutated["lineage"]["parent_ids"], [dna["genome_id"]])
        self.assertEqual(mutated["lineage"]["ancestor_ids"], dna["lineage"]["ancestor_ids"])

    def test_mutation_after_crossover_preserves_real_parent_lineage(self):
        first = self._valid_dna()
        second = bootstrap_dna_from_legacy(
            self._legacy_centroids(),
            member_id="legacy_member_04",
            faction="TREND_FOLLOWER",
            generation=2,
        )
        child = crossover_dna(first, second)

        mutated = mutate_dna(child, preserve_parent_ids=True)

        self.assertEqual(
            mutated["lineage"]["parent_ids"],
            [first["genome_id"], second["genome_id"]],
        )

    def test_mutation_of_stored_crossover_child_records_child_as_parent(self):
        first = self._valid_dna()
        second = bootstrap_dna_from_legacy(
            self._legacy_centroids(),
            member_id="legacy_member_05",
            faction="TREND_FOLLOWER",
            generation=2,
        )
        stored_child = crossover_dna(first, second)

        mutated = mutate_dna(stored_child)

        self.assertEqual(mutated["lineage"]["parent_ids"], [stored_child["genome_id"]])

    def test_new_genome_id_format_matches_aisg_accession(self):
        legacy = self._legacy_centroids()
        dna = bootstrap_dna_from_legacy(
            legacy,
            member_id="legacy_member_01",
            faction="VALUE_SEEKER",
            generation=4,
        )
        self.assertTrue(dna["genome_id"].startswith("AISG-G4-"))
        self.assertEqual(len(dna["genome_id"].split("-")), 3) # ['AISG', 'G4', 'suffix']

    def test_predict_variant_effect_identifies_lethal_weights(self):
        from ais_dna import predict_variant_effect
        dna = self._valid_dna()
        
        # 1. 극단적 가중치 임계 한도 초과
        bad_dna_1 = copy.deepcopy(dna)
        # FEATURE_ABS_LIMITS[0] is price_change_pct, limit is 20.0
        bad_dna_1["strategy_genes"][0]["subgenes"][0]["weight"] = 19.8
        self.assertEqual(predict_variant_effect(bad_dna_1), "LETHAL")
        
        # 2. BEAR_EXPANSION 상황에서 RSI 과매도 기준 과도한 매수(BUY) 가중치
        bad_dna_2 = copy.deepcopy(dna)
        # rsi_scaled (limit 2.0) BUY weight
        for sub in bad_dna_2["strategy_genes"][0]["subgenes"]:
            if sub["feature"] == "rsi_scaled" and sub["action"] == "BUY":
                sub["weight"] = 1.8
        self.assertEqual(predict_variant_effect(bad_dna_2), "LETHAL")

    def test_predict_variant_effect_flags_bear_buy_bias_after_three_generation_collapse(self):
        from ais_dna import predict_variant_effect

        dna = self._valid_dna()
        dna["fitness_history"] = [
            {"validationScore": 54.0, "holdoutScore": 51.0, "runKey": "run-1"},
            {"validationScore": 49.0, "holdoutScore": 45.0, "runKey": "run-2"},
            {"validationScore": 43.0, "holdoutScore": 39.0, "runKey": "run-3"},
        ]
        for sub in dna["strategy_genes"][0]["subgenes"]:
            if sub["action"] == "BUY" and sub["feature"] in ("price_change_pct", "rsi_scaled"):
                sub["weight"] = 1.38 if sub["feature"] == "rsi_scaled" else 13.5

        self.assertEqual(predict_variant_effect(dna), "LETHAL")

    def test_predict_variant_effect_keeps_without_collapse_history(self):
        from ais_dna import predict_variant_effect

        dna = self._valid_dna()
        dna["fitness_history"] = [
            {"validationScore": 54.0, "holdoutScore": 53.0, "runKey": "run-1"},
            {"validationScore": 55.0, "holdoutScore": 54.0, "runKey": "run-2"},
            {"validationScore": 56.0, "holdoutScore": 55.0, "runKey": "run-3"},
        ]

        self.assertEqual(predict_variant_effect(dna), "BENIGN")

    def test_mutation_filters_out_deleterious_effects(self):
        dna = self._valid_dna()
        # 모든 돌연변이 시도가 LETHAL을 유도하도록 부모 가중치를 극단적인 경계값 근처로 세팅
        for sub in dna["strategy_genes"][0]["subgenes"]:
            sub["weight"] = 19.2 if sub["feature"] == "price_change_pct" else sub["weight"]
            
        mutated = mutate_dna(
            dna,
            runtime_policy={
                "context_mutation_rate": 0.0,
                "state_mutation_rate": 0.0,
                "weight_nudge_size": 0.02,
            },
        )
        log_events = [log["event"] for log in mutated.get("mutation_log", [])]
        
        # 5회 시도 후 결국 위험 변이 필터링에 걸려 안전하게 롤백(vep_filtered_deleterious_mutation) 되었음을 확인
        self.assertIn("vep_filtered_deleterious_mutation", log_events)


    def test_mutation_can_reactivate_inactive_subgene(self):
        dna = self._valid_dna()
        target_gene_id = dna["strategy_genes"][0]["subgenes"][0]["gene_id"]
        dna["strategy_genes"][0]["subgenes"][0]["state"] = "I"

        with patch("random.random", side_effect=[0.99, 0.05, 0.01, 0.99]), patch(
            "random.choice",
            side_effect=lambda seq: next(
                item for item in seq if item.get("gene_id") == target_gene_id
            ),
        ):
            mutated = mutate_dna(dna)

        mutated_gene = mutated["strategy_genes"][0]["subgenes"][0]
        log_events = [log["event"] for log in mutated.get("mutation_log", [])]

        self.assertEqual(mutated_gene["state"], "A")
        self.assertIn("state_mutation", log_events)

    def test_crossover_inherits_lethal_subgene_as_inactive(self):
        first = self._valid_dna()
        second = bootstrap_dna_from_legacy(
            self._legacy_centroids(),
            member_id="legacy_member_06",
            faction="TREND_FOLLOWER",
            generation=2,
        )
        first["strategy_genes"][0]["subgenes"][0]["state"] = "L"
        second["strategy_genes"][0]["subgenes"][0]["state"] = "A"

        child = crossover_dna(first, second)

        self.assertEqual(child["strategy_genes"][0]["subgenes"][0]["state"], "I")

    def test_state_mutation_prefers_reactivation_when_reactivation_bias_is_high(self):
        dna = self._valid_dna()
        dna["regulatory_profile"]["reactivation_bias"] = 1.0
        dna["strategy_genes"][0]["subgenes"][0]["state"] = "I"

        with patch("random.random", side_effect=[0.99, 0.05, 0.01, 0.99]), patch(
            "random.choice",
            side_effect=lambda seq: next(item for item in seq if item.get("state") == "I"),
        ):
            mutated = mutate_dna(dna)

        self.assertEqual(mutated["strategy_genes"][0]["subgenes"][0]["state"], "A")

    def test_state_mutation_can_skip_lethal_promotion_when_decay_resistance_is_high(self):
        dna = self._valid_dna()
        dna["regulatory_profile"]["decay_resistance"] = 1.0
        dna["strategy_genes"][0]["subgenes"][0]["state"] = "D"

        with patch("random.random", side_effect=[0.99, 0.05, 0.99, 0.99]), patch(
            "random.choice",
            side_effect=lambda seq: next(item for item in seq if item.get("state") == "D"),
        ):
            mutated = mutate_dna(dna)

        self.assertNotEqual(mutated["strategy_genes"][0]["subgenes"][0]["state"], "L")

    def test_mutate_dna_uses_runtime_configured_state_mutation_rate(self):
        dna = self._valid_dna()

        mutated = mutate_dna(dna, runtime_policy={"state_mutation_rate": 0.0})

        self.assertNotIn("state_mutation", [entry["event"] for entry in mutated["mutation_log"]])

    def test_load_candidate_dna_self_heals_missing_context_mask_and_profile_fields(self):
        broken = self._valid_dna()
        del broken["strategy_genes"][0]["context_mask"]
        broken["regulatory_profile"] = {"expression_budget": 12}

        healed = load_candidate_dna(
            member_id="member-1",
            dna_json=json.dumps(broken),
            phenotype_json=None,
            weights_json=None,
            faction="MUTANT_ROOKIE",
            generation=1,
            fallback_weights=self._legacy_centroids(),
        )

        self.assertEqual(
            healed["strategy_genes"][0]["context_mask"],
            ["BULL_EXPANSION", "BULL_SQUEEZE", "BEAR_EXPANSION", "BEAR_SQUEEZE"],
        )
        self.assertEqual(healed["genome_id"], broken["genome_id"])
        self.assertEqual(
            healed["lineage"]["ancestor_ids"],
            broken["lineage"]["ancestor_ids"],
        )
        self.assertEqual(healed["regulatory_profile"]["dominance_bias"], 1.0)
        self.assertEqual(healed["regulatory_profile"]["decay_resistance"], 0.3)
        self.assertEqual(healed["regulatory_profile"]["reactivation_bias"], 0.1)


if __name__ == "__main__":
    unittest.main()
