import math
import json
import random
import unittest

from ais_features import (
    build_features,
    chronological_split,
    fit_centroids,
    make_default_centroids,
    score_predictions,
    validate_centroids,
)
from ais_dna import bootstrap_dna_from_legacy, build_phenotype_from_dna
from ais_dna import crossover_dna
from train_ais import (
    build_council_member_insert_payload,
    crossover_weights,
    generate_random_weights,
    mutate_weights,
)


class AiSFeatureTests(unittest.TestCase):
    def test_rsi_midpoint_maps_to_zero(self):
        features = build_features(100, 0, 50, 100, 100)
        self.assertEqual(features[1], 0.0)

    def test_relative_features_are_scale_invariant(self):
        first = build_features(100, 1.5, 60, 102, 98)
        second = build_features(200, 1.5, 60, 204, 196)
        for left, right in zip(first, second):
            self.assertTrue(math.isclose(left, right, abs_tol=1e-9))

    def test_centroid_schema_requires_three_five_value_vectors(self):
        self.assertTrue(validate_centroids(make_default_centroids()))
        self.assertFalse(validate_centroids({"BUY": [1, 2, 3]}))
        self.assertFalse(validate_centroids({
            "BUY": [0, 0, 0, 0, 0],
            "SELL": [0, 0, 0, 0, 0],
        }))

    def test_chronological_split_preserves_order(self):
        training, validation, holdout = chronological_split(list(range(10)))
        self.assertEqual(training, [0, 1, 2, 3, 4, 5])
        self.assertEqual(validation, [6, 7])
        self.assertEqual(holdout, [8, 9])

    def test_fit_centroids_uses_training_partition_targets(self):
        rows = [
            {"features": [1, 1, 1, 1, 1], "target": "BUY"},
            {"features": [3, 3, 3, 3, 3], "target": "BUY"},
            {"features": [-1, -1, -1, -1, -1], "target": "SELL"},
            {"features": [0, 0, 0, 0, 0], "target": "HOLD"},
        ]
        centroids = fit_centroids(rows)
        self.assertEqual(centroids["BUY"], [2.0] * 5)

    def test_single_action_collapse_is_penalized(self):
        targets = ["BUY", "SELL", "HOLD"] * 10
        collapsed = score_predictions(targets, ["HOLD"] * 30)
        perfect = score_predictions(targets, targets)
        self.assertGreater(collapsed["collapse_penalty"], 0)
        self.assertLess(collapsed["utility_score"], perfect["utility_score"])
        self.assertEqual(perfect["utility_score"], 100.0)

    def test_generated_mutated_and_crossed_candidates_share_schema(self):
        random.seed(7)
        first = generate_random_weights()
        second = generate_random_weights()
        self.assertTrue(validate_centroids(first))
        self.assertTrue(validate_centroids(mutate_weights(first)))
        self.assertTrue(validate_centroids(crossover_weights(first, second)))

    def test_dna_bootstrap_and_expression_produce_valid_centroids(self):
        legacy = {
            "BUY": [-0.4, -0.3, 0.1, 0.0, 0.02],
            "SELL": [0.3, 0.2, -0.1, -0.02, 0.01],
            "HOLD": [0.0, 0.0, 0.0, 0.0, 0.0],
        }

        dna = bootstrap_dna_from_legacy(legacy, "legacy_member_x", "VALUE_SEEKER", 1)
        phenotype = build_phenotype_from_dna(dna)

        self.assertEqual(phenotype, legacy)
        self.assertTrue(validate_centroids(phenotype))

    def test_council_member_insert_payload_includes_dna_and_phenotype(self):
        weights = {
            "BUY": [-0.4, -0.3, 0.1, 0.0, 0.02],
            "SELL": [0.3, 0.2, -0.1, -0.02, 0.01],
            "HOLD": [0.0, 0.0, 0.0, 0.0, 0.0],
        }

        payload = build_council_member_insert_payload(
            member_id="candidate_1",
            name="Candidate 1",
            weights=weights,
            voting_power=1.0,
            status="CANDIDATE",
            faction="VALUE_SEEKER",
            generation=3,
        )

        dna = json.loads(payload[3])
        phenotype = json.loads(payload[4])
        self.assertEqual(json.loads(payload[2]), weights)
        self.assertEqual(phenotype, weights)
        self.assertEqual(dna["generation"], 3)
        self.assertTrue(validate_centroids(phenotype))

    def test_dna_offspring_expression_stays_schema_compatible(self):
        first = bootstrap_dna_from_legacy({
            "BUY": [-0.4, -0.2, 0.1, 0.0, 0.02],
            "SELL": [0.4, 0.2, -0.1, 0.0, -0.02],
            "HOLD": [0.0, 0.0, 0.0, 0.0, 0.0],
        }, "a", "VALUE_SEEKER", 1)
        second = bootstrap_dna_from_legacy({
            "BUY": [-0.5, -0.3, 0.2, 0.0, 0.03],
            "SELL": [0.5, 0.3, -0.2, 0.0, -0.03],
            "HOLD": [0.0, 0.0, 0.0, 0.0, 0.0],
        }, "b", "VALUE_SEEKER", 2)

        child = crossover_dna(first, second)
        phenotype = build_phenotype_from_dna(child)

        self.assertTrue(validate_centroids(phenotype))


if __name__ == "__main__":
    unittest.main()
