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
from train_ais import append_fitness_history, detect_market_context, load_candidate_dna


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

    def test_validate_dna_accepts_black_swan_context_mask(self):
        dna = self._valid_dna()
        dna["strategy_genes"][0]["context_mask"] = ["BLACK_SWAN"]

        self.assertTrue(validate_dna(dna))

    def test_detect_market_context_returns_black_swan_for_extreme_shock_bar(self):
        base_prices = [100.0 + (index * 0.05) for index in range(260)]
        close_prices = list(base_prices)
        close_prices[258] = 100.0
        close_prices[259] = 92.0
        high_prices = [price + 0.4 for price in close_prices]
        low_prices = [price - 0.4 for price in close_prices]
        high_prices[259] = 108.0
        low_prices[259] = 88.0

        context = detect_market_context(close_prices, high_prices, low_prices, 259)

        self.assertEqual(context, "BLACK_SWAN")

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

    def test_expression_plan_applies_dominance_bias_to_weight(self):
        dna = {
            "genome_id": "g2b",
            "generation": 1,
            "lineage": {"parent_ids": [], "ancestor_ids": ["seed"], "innovation_ids": [1, 2]},
            "regulatory_profile": {
                "expression_budget": 12,
                "dominance_bias": 1.5,
                "decay_resistance": 0.3,
                "reactivation_bias": 0.1,
            },
            "strategy_genes": [
                {
                    "gene_id": "sg1",
                    "innovation_id": 1,
                    "state": "A",
                    "dominance": 2.0,
                    "copy_number": 1,
                    "context_mask": ["BULL_EXPANSION"],
                    "length": 1,
                    "subgenes": [
                        {
                            "gene_id": "buy_weighted",
                            "innovation_id": 2,
                            "state": "A",
                            "feature": "rsi_scaled",
                            "action": "BUY",
                            "weight": -0.4,
                            "threshold": 0.0,
                            "priority": 1.0,
                        }
                    ],
                }
            ],
            "mutation_log": [],
        }

        plan = build_expression_plan(dna, "BULL_EXPANSION")

        self.assertEqual(len(plan["expressed_subgenes"]), 1)
        self.assertEqual(plan["expressed_subgenes"][0]["weight"], -1.2)

    def test_expression_plan_respects_expression_budget(self):
        dna = {
            "genome_id": "g2c",
            "generation": 1,
            "lineage": {"parent_ids": [], "ancestor_ids": ["seed"], "innovation_ids": [1, 2, 3]},
            "regulatory_profile": {
                "expression_budget": 1,
                "dominance_bias": 1.0,
                "decay_resistance": 0.3,
                "reactivation_bias": 0.1,
            },
            "strategy_genes": [
                {
                    "gene_id": "sg_high_cost",
                    "innovation_id": 1,
                    "state": "A",
                    "dominance": 1.0,
                    "copy_number": 1,
                    "context_mask": ["BULL_EXPANSION"],
                    "length": 3,
                    "subgenes": [
                        {
                            "gene_id": "skipped_gene",
                            "innovation_id": 2,
                            "state": "A",
                            "feature": "price_change_pct",
                            "action": "BUY",
                            "weight": 0.5,
                            "threshold": 0.0,
                            "priority": 1.0,
                        }
                    ],
                },
                {
                    "gene_id": "sg_low_cost",
                    "innovation_id": 3,
                    "state": "A",
                    "dominance": 1.0,
                    "copy_number": 1,
                    "context_mask": ["BULL_EXPANSION"],
                    "length": 1,
                    "subgenes": [
                        {
                            "gene_id": "expressed_gene",
                            "innovation_id": 4,
                            "state": "A",
                            "feature": "rsi_scaled",
                            "action": "SELL",
                            "weight": 0.6,
                            "threshold": 0.0,
                            "priority": 1.0,
                        }
                    ],
                },
            ],
            "mutation_log": [],
        }

        plan = build_expression_plan(dna, "BULL_EXPANSION")
        gene_ids = [gene["gene_id"] for gene in plan["expressed_subgenes"]]

        self.assertIn("expressed_gene", gene_ids)
        self.assertNotIn("skipped_gene", gene_ids)

    def test_expression_plan_uses_copy_number_to_reduce_budget_cost(self):
        dna = {
            "genome_id": "g2d",
            "generation": 1,
            "lineage": {"parent_ids": [], "ancestor_ids": ["seed"], "innovation_ids": [1, 2]},
            "regulatory_profile": {
                "expression_budget": 1,
                "dominance_bias": 1.0,
                "decay_resistance": 0.3,
                "reactivation_bias": 0.1,
            },
            "strategy_genes": [
                {
                    "gene_id": "sg_copy_gain",
                    "innovation_id": 1,
                    "state": "A",
                    "dominance": 1.0,
                    "copy_number": 3,
                    "context_mask": ["BULL_EXPANSION"],
                    "length": 3,
                    "subgenes": [
                        {
                            "gene_id": "copy_supported_gene",
                            "innovation_id": 2,
                            "state": "A",
                            "feature": "sma5_distance_pct",
                            "action": "HOLD",
                            "weight": 0.3,
                            "threshold": 0.0,
                            "priority": 1.0,
                        }
                    ],
                }
            ],
            "mutation_log": [],
        }

        plan = build_expression_plan(dna, "BULL_EXPANSION")
        gene_ids = [gene["gene_id"] for gene in plan["expressed_subgenes"]]

        self.assertIn("copy_supported_gene", gene_ids)

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
            mutated = mutate_dna(dna, runtime_policy={"profile_mutation_rate": 0.0, "copy_number_mutation_rate": 0.0})
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
        
        # 1. Extreme weight over the canonical feature limit.
        bad_dna_1 = copy.deepcopy(dna)
        bad_dna_1["strategy_genes"][0]["subgenes"][0]["weight"] = 19.8
        self.assertEqual(predict_variant_effect(bad_dna_1), "LETHAL")
        
        # 2. Aggressive BUY weight in BEAR_EXPANSION on RSI/price-change cues.
        bad_dna_2 = copy.deepcopy(dna)
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

    def test_predict_variant_effect_flags_bull_expansion_chase_bias(self):
        from ais_dna import predict_variant_effect

        dna = self._valid_dna()
        for sub in dna["strategy_genes"][0]["subgenes"]:
            if sub["action"] == "BUY" and sub["feature"] == "price_change_pct":
                sub["weight"] = 15.5
            if sub["action"] == "BUY" and sub["feature"] == "sma5_to_sma20_spread_pct":
                sub["weight"] = 16.4

        self.assertEqual(predict_variant_effect(dna), "LETHAL")

    def test_predict_variant_effect_flags_bull_squeeze_premature_sell_bias(self):
        from ais_dna import predict_variant_effect

        dna = self._valid_dna()
        for sub in dna["strategy_genes"][0]["subgenes"]:
            if sub["action"] == "SELL" and sub["feature"] == "price_change_pct":
                sub["weight"] = 15.2
            if sub["action"] == "SELL" and sub["feature"] == "rsi_scaled":
                sub["weight"] = 1.6

        self.assertEqual(predict_variant_effect(dna), "LETHAL")

    def test_predict_variant_effect_flags_black_swan_directional_chase_bias(self):
        from ais_dna import predict_variant_effect

        dna = self._valid_dna()
        dna["strategy_genes"][0]["context_mask"] = ["BLACK_SWAN"]
        for sub in dna["strategy_genes"][0]["subgenes"]:
            if sub["action"] == "BUY" and sub["feature"] == "price_change_pct":
                sub["weight"] = 11.2
            if sub["action"] == "BUY" and sub["feature"] == "sma5_to_sma20_spread_pct":
                sub["weight"] = 12.4

        self.assertEqual(predict_variant_effect(dna), "LETHAL")

    def test_predict_variant_effect_allows_black_swan_defensive_bias(self):
        from ais_dna import predict_variant_effect

        dna = self._valid_dna()
        dna["strategy_genes"][0]["context_mask"] = ["BLACK_SWAN"]
        for sub in dna["strategy_genes"][0]["subgenes"]:
            if sub["action"] == "BUY" and sub["feature"] == "price_change_pct":
                sub["weight"] = 4.0
            if sub["action"] == "BUY" and sub["feature"] == "sma5_to_sma20_spread_pct":
                sub["weight"] = 4.5

        self.assertEqual(predict_variant_effect(dna), "BENIGN")

    def test_predict_variant_effect_flags_profile_overexpression_runaway(self):
        from ais_dna import predict_variant_effect

        dna = self._valid_dna()
        dna["regulatory_profile"]["expression_budget"] = 19
        dna["regulatory_profile"]["dominance_bias"] = 1.7

        self.assertEqual(predict_variant_effect(dna), "LETHAL")

    def test_predict_variant_effect_flags_copy_number_duplication_runaway(self):
        from ais_dna import predict_variant_effect

        dna = self._valid_dna()
        strategy = dna["strategy_genes"][0]
        strategy["copy_number"] = 4
        strategy["dominance"] = 1.5
        strategy["subgenes"].append(
            {
                "gene_id": "duplication_probe",
                "innovation_id": 999,
                "state": "A",
                "feature": "sma20_distance_pct",
                "action": "BUY",
                "weight": 0.6,
                "threshold": 0.0,
                "priority": 1.0,
            }
        )
        strategy["length"] = len(strategy["subgenes"])

        self.assertEqual(predict_variant_effect(dna), "LETHAL")

    def test_mutation_filters_out_deleterious_effects(self):
        dna = self._valid_dna()
        # Force every mutation attempt to stay lethal so the VEP fallback path is exercised.
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
        
        # 5????嶺뚮㉡??????嚥▲굧????????꾣뤃????⑤슢堉???????꾣뤃?饔낃퀣????좏뀯???꿸쑨?????????繹먮냱踰????怨뺤퓡 ?汝뷴젆??癒?씀?vep_filtered_deleterious_mutation) ??嶺???????癲ル슢캉????        self.assertIn("vep_filtered_deleterious_mutation", log_events)


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
            mutated = mutate_dna(dna, runtime_policy={"profile_mutation_rate": 0.0, "copy_number_mutation_rate": 0.0})

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
            mutated = mutate_dna(dna, runtime_policy={"profile_mutation_rate": 0.0, "copy_number_mutation_rate": 0.0})

        self.assertEqual(mutated["strategy_genes"][0]["subgenes"][0]["state"], "A")

    def test_state_mutation_can_skip_lethal_promotion_when_decay_resistance_is_high(self):
        dna = self._valid_dna()
        dna["regulatory_profile"]["decay_resistance"] = 1.0
        dna["strategy_genes"][0]["subgenes"][0]["state"] = "D"

        with patch("random.random", side_effect=[0.99, 0.05, 0.99, 0.99]), patch(
            "random.choice",
            side_effect=lambda seq: next(item for item in seq if item.get("state") == "D"),
        ):
            mutated = mutate_dna(dna, runtime_policy={"profile_mutation_rate": 0.0, "copy_number_mutation_rate": 0.0})

        self.assertNotEqual(mutated["strategy_genes"][0]["subgenes"][0]["state"], "L")

    def test_mutate_dna_uses_runtime_configured_state_mutation_rate(self):
        dna = self._valid_dna()

        mutated = mutate_dna(dna, runtime_policy={"state_mutation_rate": 0.0})

        self.assertNotIn("state_mutation", [entry["event"] for entry in mutated["mutation_log"]])

    def test_mutation_can_adjust_expression_budget_profile(self):
        dna = self._valid_dna()
        original_budget = dna["regulatory_profile"]["expression_budget"]

        with patch("random.random", side_effect=[0.99, 0.99, 0.01, 0.99, 0.99, 0.99]), patch(
            "random.choice",
            side_effect=lambda seq: "expression_budget" if "expression_budget" in seq else seq[0],
        ):
            mutated = mutate_dna(
                dna,
                runtime_policy={
                    "context_mutation_rate": 0.0,
                    "state_mutation_rate": 0.0,
                    "profile_mutation_rate": 1.0,
                    "copy_number_mutation_rate": 0.0,
                },
            )

        self.assertGreater(mutated["regulatory_profile"]["expression_budget"], original_budget)
        self.assertIn("profile_mutation", [entry["event"] for entry in mutated["mutation_log"]])

    def test_mutation_can_adjust_strategy_copy_number(self):
        dna = self._valid_dna()
        original_copy_number = dna["strategy_genes"][0]["copy_number"]

        with patch("random.random", side_effect=[0.99, 0.99, 0.99, 0.01, 0.99, 0.99]), patch(
            "random.choice",
            side_effect=lambda seq: (
                next(item for item in seq if isinstance(item, dict) and item.get("gene_id") == dna["strategy_genes"][0]["gene_id"])
                if seq and isinstance(seq[0], dict)
                else seq[0]
            ),
        ):
            mutated = mutate_dna(
                dna,
                runtime_policy={
                    "context_mutation_rate": 0.0,
                    "state_mutation_rate": 0.0,
                    "profile_mutation_rate": 0.0,
                    "copy_number_mutation_rate": 1.0,
                },
            )

        self.assertGreater(mutated["strategy_genes"][0]["copy_number"], original_copy_number)
        self.assertIn("copy_number_mutation", [entry["event"] for entry in mutated["mutation_log"]])

    def test_mutation_can_add_black_swan_context(self):
        dna = self._valid_dna()

        with patch("random.random", side_effect=[0.01, 0.99, 0.99]), patch(
            "random.choice",
            side_effect=lambda seq: "BLACK_SWAN" if "BLACK_SWAN" in seq else seq[0],
        ):
            mutated = mutate_dna(dna, runtime_policy={"profile_mutation_rate": 0.0, "copy_number_mutation_rate": 0.0})

        self.assertIn("BLACK_SWAN", mutated["strategy_genes"][0]["context_mask"])

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

    def test_load_candidate_dna_self_healing_keeps_black_swan_opt_in(self):
        broken = self._valid_dna()
        del broken["strategy_genes"][0]["context_mask"]

        healed = load_candidate_dna(
            member_id="member-3",
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
        self.assertNotIn("BLACK_SWAN", healed["strategy_genes"][0]["context_mask"])

    def test_load_candidate_dna_records_runtime_repair_events(self):
        broken = self._valid_dna()
        broken["genome_id"] = "legacy-member-without-accession"
        del broken["strategy_genes"][0]["context_mask"]
        broken["regulatory_profile"] = {"expression_budget": 12}

        repair_stats = {}
        healed = load_candidate_dna(
            member_id="member-2",
            dna_json=json.dumps(broken),
            phenotype_json=None,
            weights_json=None,
            faction="MUTANT_ROOKIE",
            generation=3,
            fallback_weights=self._legacy_centroids(),
            repair_stats=repair_stats,
        )

        events = [entry["event"] for entry in healed.get("mutation_log", [])]
        self.assertIn("runtime_accession_repair", events)
        self.assertIn("runtime_context_mask_repair", events)
        self.assertIn("runtime_profile_repair", events)
        self.assertTrue(healed["genome_id"].startswith("AISG-G"))
        self.assertEqual(repair_stats["accessionRepairCount"], 1)
        self.assertEqual(repair_stats["contextMaskRepairCount"], 1)
        self.assertEqual(repair_stats["profileRepairCount"], 1)

    def test_append_fitness_history_returns_updated_copy(self):
        dna = self._valid_dna()

        updated = append_fitness_history(dna, 51.25, 48.75, "run-123")

        self.assertIsNot(updated, dna)
        self.assertEqual(dna.get("fitness_history"), None)
        self.assertEqual(len(updated["fitness_history"]), 1)
        self.assertEqual(updated["fitness_history"][0]["validationScore"], 51.25)
        self.assertEqual(updated["fitness_history"][0]["holdoutScore"], 48.75)
        self.assertEqual(updated["fitness_history"][0]["runKey"], "run-123")


if __name__ == "__main__":
    unittest.main()

