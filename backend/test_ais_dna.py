import unittest

from ais_dna import (
    bootstrap_dna_from_legacy,
    build_expression_plan,
    build_phenotype_from_dna,
    validate_dna,
)
from ais_features import validate_centroids


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


if __name__ == "__main__":
    unittest.main()
