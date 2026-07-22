import unittest

from ais_features import FEATURE_COUNT, build_features, fit_centroids, make_default_centroids, validate_centroids


class AiSFeatureTests(unittest.TestCase):
    def test_feature_vector_has_ten_finite_values(self):
        features = build_features(0.002, 0.1, 0.001, 0.2, 0.01, 0.003, 0.55, 0.002, 0.004, -0.1)
        self.assertEqual(FEATURE_COUNT, 10)
        self.assertEqual(len(features), 10)
        self.assertTrue(all(-1.0 <= value <= 1.0 for value in features))

    def test_centroids_require_three_ten_value_vectors(self):
        self.assertTrue(validate_centroids(make_default_centroids()))
        self.assertFalse(validate_centroids({'BUY': [0] * 9, 'SELL': [0] * 9, 'HOLD': [0] * 9}))

    def test_fit_centroids_keeps_ten_vector_schema(self):
        rows = [
            {'features': [0.1] * 10, 'target': 'BUY'},
            {'features': [-0.1] * 10, 'target': 'SELL'},
            {'features': [0.0] * 10, 'target': 'HOLD'},
        ]
        centroids = fit_centroids(rows)
        self.assertTrue(validate_centroids(centroids))
        self.assertEqual(centroids['BUY'], [0.1] * 10)


if __name__ == '__main__':
    unittest.main()
