import unittest

from ais_dna import bootstrap_dna_from_legacy, build_phenotype_from_dna, mutate_dna, validate_dna
from ais_features import make_default_centroids, validate_centroids


class AiSDnaTests(unittest.TestCase):
    def setUp(self):
        self.centroids = make_default_centroids()

    def test_bootstrap_accepts_ten_feature_centroids(self):
        dna = bootstrap_dna_from_legacy(self.centroids, 'ais_test_member', 'VALUE_SEEKER', 1)
        self.assertTrue(validate_dna(dna))

    def test_expression_returns_ten_feature_centroids(self):
        dna = bootstrap_dna_from_legacy(self.centroids, 'ais_test_member', 'VALUE_SEEKER', 1)
        phenotype = build_phenotype_from_dna(dna, 'BULL_SQUEEZE')
        self.assertTrue(validate_centroids(phenotype))
        self.assertEqual(len(phenotype['BUY']), 10)

    def test_mutation_preserves_ten_feature_schema(self):
        dna = bootstrap_dna_from_legacy(self.centroids, 'ais_test_member', 'VALUE_SEEKER', 1)
        mutated = mutate_dna(dna)
        self.assertTrue(validate_dna(mutated))
        self.assertTrue(validate_centroids(build_phenotype_from_dna(mutated, 'BEAR_EXPANSION')))


if __name__ == '__main__':
    unittest.main()
