import math


DECISIONS = ("BUY", "SELL", "HOLD")
FEATURE_COUNT = 5
FEATURE_ABS_LIMITS = (20.0, 2.0, 20.0, 20.0, 20.0)


def build_features(price, change_percent, rsi, sma5, sma20):
    safe_price = max(float(price), 1e-12)
    values = [
        float(change_percent),
        (float(rsi) - 50.0) / 50.0,
        ((float(sma5) - safe_price) / safe_price) * 100.0,
        ((float(sma20) - safe_price) / safe_price) * 100.0,
        ((float(sma5) - float(sma20)) / safe_price) * 100.0,
    ]
    if not all(math.isfinite(value) for value in values):
        raise ValueError("AiS features must be finite numbers")
    return values


def make_default_centroids():
    return {
        "BUY": [-0.5, -0.45, 0.5, 0.8, -0.3],
        "SELL": [0.5, 0.45, -0.5, -0.8, 0.3],
        "HOLD": [0.0, 0.0, 0.0, 0.0, 0.0],
    }


def validate_centroids(centroids):
    if not isinstance(centroids, dict) or set(centroids.keys()) != set(DECISIONS):
        return False
    for decision in DECISIONS:
        vector = centroids.get(decision)
        if not isinstance(vector, list) or len(vector) != FEATURE_COUNT:
            return False
        if not all(
            isinstance(value, (int, float))
            and math.isfinite(value)
            and abs(float(value)) <= FEATURE_ABS_LIMITS[index]
            for index, value in enumerate(vector)
        ):
            return False
    return True


def predict_from_centroids(features, centroids):
    if len(features) != FEATURE_COUNT or not validate_centroids(centroids):
        raise ValueError("Invalid AiS feature or centroid schema")
    return min(
        DECISIONS,
        key=lambda decision: sum(
            (float(feature) - float(center)) ** 2
            for feature, center in zip(features, centroids[decision])
        ),
    )


def chronological_split(rows, train_ratio=0.6, validation_ratio=0.2):
    items = list(rows)
    training_end = int(len(items) * train_ratio)
    validation_end = training_end + int(len(items) * validation_ratio)
    return (
        items[:training_end],
        items[training_end:validation_end],
        items[validation_end:],
    )


def fit_centroids(rows):
    defaults = make_default_centroids()
    centroids = {}
    for decision in DECISIONS:
        matching = [
            row["features"]
            for row in rows
            if row.get("target") == decision
            and isinstance(row.get("features"), list)
            and len(row["features"]) == FEATURE_COUNT
        ]
        if not matching:
            centroids[decision] = defaults[decision]
            continue
        centroids[decision] = [
            round(sum(vector[index] for vector in matching) / len(matching), 6)
            for index in range(FEATURE_COUNT)
        ]
    if not validate_centroids(centroids):
        raise ValueError("Training rows produced invalid AiS centroids")
    return centroids


def score_predictions(targets, predictions):
    actual = list(targets)
    predicted = list(predictions)
    if not actual or len(actual) != len(predicted):
        raise ValueError("Targets and predictions must be non-empty and equal length")

    correct = sum(left == right for left, right in zip(actual, predicted))
    accuracy = (correct / len(actual)) * 100.0

    recalls = {}
    for decision in DECISIONS:
        decision_total = sum(value == decision for value in actual)
        decision_correct = sum(
            left == decision and right == decision
            for left, right in zip(actual, predicted)
        )
        recalls[decision] = (
            (decision_correct / decision_total) * 100.0
            if decision_total
            else 0.0
        )

    balanced_accuracy = sum(recalls.values()) / len(DECISIONS)
    action_counts = {
        decision: sum(value == decision for value in predicted)
        for decision in DECISIONS
    }
    dominance = max(action_counts.values()) / len(predicted)
    collapse_penalty = max(0.0, dominance - 0.85) * 100.0
    utility_score = max(
        0.0,
        min(100.0, 0.4 * accuracy + 0.6 * balanced_accuracy - collapse_penalty),
    )

    return {
        "accuracy": round(accuracy, 4),
        "balanced_accuracy": round(balanced_accuracy, 4),
        "recall": {key: round(value, 4) for key, value in recalls.items()},
        "action_counts": action_counts,
        "collapse_penalty": round(collapse_penalty, 4),
        "utility_score": round(utility_score, 4),
    }
