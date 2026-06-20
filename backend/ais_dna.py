import copy
import math
import uuid

from ais_features import FEATURE_ABS_LIMITS, validate_centroids


FEATURE_ORDER = [
    "price_change_pct",
    "rsi_scaled",
    "sma5_distance_pct",
    "sma20_distance_pct",
    "sma5_to_sma20_spread_pct",
]

AIDL_STATES = {"A", "I", "D", "L"}
ACTIONS = ("BUY", "SELL", "HOLD")


def _new_genome_id():
    return f"gen_{uuid.uuid4().hex}"


def _base_profile():
    return {
        "expression_budget": 12,
        "dominance_bias": 1.0,
        "decay_resistance": 0.3,
        "reactivation_bias": 0.1,
    }


def _is_finite_number(value):
    return type(value) in (int, float) and math.isfinite(float(value))


def _is_non_empty_string(value):
    return isinstance(value, str) and bool(value)


def _is_int(value):
    return type(value) is int


def _is_positive_int(value):
    return _is_int(value) and value > 0


def _is_positive_finite_number(value):
    return _is_finite_number(value) and float(value) > 0


def _validate_legacy_centroids(legacy_centroids):
    if not validate_centroids(legacy_centroids):
        raise ValueError("Legacy centroids must match the canonical AiS centroid schema")


def _clamp_feature_weight(feature, weight):
    limit = FEATURE_ABS_LIMITS[FEATURE_ORDER.index(feature)]
    return max(-limit, min(limit, float(weight)))


def validate_dna(dna):
    if not isinstance(dna, dict):
        return False
    if not isinstance(dna.get("genome_id"), str) or not dna["genome_id"]:
        return False
    if not _is_positive_int(dna.get("generation")):
        return False
    lineage = dna.get("lineage")
    if not isinstance(lineage, dict):
        return False
    if not {"parent_ids", "ancestor_ids", "innovation_ids"}.issubset(lineage):
        return False
    if not isinstance(lineage.get("parent_ids"), list):
        return False
    if not all(isinstance(value, str) and value for value in lineage.get("parent_ids")):
        return False
    if not isinstance(lineage.get("ancestor_ids"), list):
        return False
    if not all(isinstance(value, str) and value for value in lineage.get("ancestor_ids")):
        return False
    innovation_ids = lineage.get("innovation_ids")
    if not isinstance(innovation_ids, list) or not all(_is_int(value) for value in innovation_ids):
        return False

    regulatory_profile = dna.get("regulatory_profile")
    if not isinstance(regulatory_profile, dict):
        return False
    profile_keys = {
        "expression_budget",
        "dominance_bias",
        "decay_resistance",
        "reactivation_bias",
    }
    if not profile_keys.issubset(regulatory_profile):
        return False
    if not _is_positive_finite_number(regulatory_profile.get("expression_budget")):
        return False
    for key in ("dominance_bias", "decay_resistance", "reactivation_bias"):
        if not _is_finite_number(regulatory_profile.get(key)):
            return False

    if not isinstance(dna.get("strategy_genes"), list) or not dna["strategy_genes"]:
        return False

    for strategy in dna["strategy_genes"]:
        if not isinstance(strategy, dict):
            return False
        if not _is_non_empty_string(strategy.get("gene_id")):
            return False
        if not _is_int(strategy.get("innovation_id")):
            return False
        if strategy.get("state") not in AIDL_STATES:
            return False
        if not _is_finite_number(strategy.get("dominance")):
            return False
        if not _is_positive_finite_number(strategy.get("copy_number")):
            return False
        if not _is_positive_finite_number(strategy.get("length")):
            return False
        if not isinstance(strategy.get("subgenes"), list) or not strategy["subgenes"]:
            return False
        for subgene in strategy["subgenes"]:
            if not isinstance(subgene, dict):
                return False
            if not _is_non_empty_string(subgene.get("gene_id")):
                return False
            if not _is_int(subgene.get("innovation_id")):
                return False
            if subgene.get("state") not in AIDL_STATES:
                return False
            if subgene.get("feature") not in FEATURE_ORDER:
                return False
            if subgene.get("action") not in ACTIONS:
                return False
            if not _is_finite_number(subgene.get("weight")):
                return False
            if not _is_finite_number(subgene.get("threshold")):
                return False
            if not _is_finite_number(subgene.get("priority")):
                return False
    return True


def bootstrap_dna_from_legacy(legacy_centroids, member_id, faction, generation):
    _validate_legacy_centroids(legacy_centroids)
    if not _is_positive_int(generation):
        raise ValueError("Generation must be a positive integer")

    strategy_gene = {
        "gene_id": f"sg_{member_id}",
        "innovation_id": 1,
        "state": "A",
        "dominance": 1.0,
        "copy_number": 1,
        "length": len(FEATURE_ORDER),
        "subgenes": [],
    }

    innovation_id = 2
    for action in ACTIONS:
        vector = legacy_centroids[action]
        for feature, weight in zip(FEATURE_ORDER, vector):
            strategy_gene["subgenes"].append(
                {
                    "gene_id": f"{member_id}_{action}_{feature}",
                    "innovation_id": innovation_id,
                    "state": "A",
                    "feature": feature,
                    "action": action,
                    "weight": float(weight),
                    "threshold": 0.0,
                    "priority": 1.0,
                }
            )
            innovation_id += 1

    return {
        "genome_id": _new_genome_id(),
        "generation": generation,
        "faction_hint": faction,
        "lineage": {
            "parent_ids": [],
            "ancestor_ids": [member_id],
            "innovation_ids": list(range(1, innovation_id)),
        },
        "regulatory_profile": _base_profile(),
        "strategy_genes": [strategy_gene],
        "mutation_log": [],
    }


def build_expression_plan(dna):
    expressed = []
    for strategy in dna.get("strategy_genes", []):
        if strategy.get("state") in ("I", "L"):
            continue
        for subgene in strategy.get("subgenes", []):
            state = subgene.get("state")
            if state not in ("A", "D"):
                continue
            expressed_subgene = copy.deepcopy(subgene)
            expression_factor = 0.5 if "D" in (strategy.get("state"), state) else 1.0
            expressed_subgene["weight"] = float(expressed_subgene["weight"]) * expression_factor
            expressed.append(expressed_subgene)
    return {
        "genome_id": dna.get("genome_id"),
        "expressed_subgenes": expressed,
    }


def build_phenotype_from_dna(dna):
    plan = build_expression_plan(dna)
    phenotype = {action: [0.0] * len(FEATURE_ORDER) for action in ACTIONS}
    counts = {action: [0] * len(FEATURE_ORDER) for action in ACTIONS}

    for subgene in plan["expressed_subgenes"]:
        action = subgene["action"]
        feature_index = FEATURE_ORDER.index(subgene["feature"])
        phenotype[action][feature_index] += float(subgene["weight"])
        counts[action][feature_index] += 1

    for action in ACTIONS:
        for index in range(len(FEATURE_ORDER)):
            if counts[action][index]:
                phenotype[action][index] = phenotype[action][index] / counts[action][index]

    return phenotype


def mutate_dna(dna, preserve_parent_ids=False):
    parent_genome_id = dna.get("genome_id")
    existing_lineage = dna.get("lineage", {})
    existing_parents = list(existing_lineage.get("parent_ids", []))
    mutated = copy.deepcopy(dna)
    mutated["genome_id"] = _new_genome_id()
    mutated["lineage"] = {
        "parent_ids": (
            existing_parents
            if preserve_parent_ids and existing_parents
            else ([parent_genome_id] if parent_genome_id else [])
        ),
        "ancestor_ids": list(existing_lineage.get("ancestor_ids", [])),
        "innovation_ids": list(existing_lineage.get("innovation_ids", [])),
    }
    for strategy in mutated.get("strategy_genes", []):
        for subgene in strategy.get("subgenes", []):
            if subgene.get("state") == "A":
                subgene["weight"] = round(
                    _clamp_feature_weight(subgene["feature"], float(subgene["weight"]) + 0.02),
                    4,
                )
                mutated.setdefault("mutation_log", []).append(
                    {
                        "generation": mutated.get("generation", 1),
                        "event": "weight_nudge",
                        "gene_id": subgene.get("gene_id"),
                    }
                )
                return mutated
    mutated.setdefault("mutation_log", []).append(
        {"generation": mutated.get("generation", 1), "event": "no_active_gene"}
    )
    return mutated


def crossover_dna(first, second):
    parent_a = copy.deepcopy(first)
    parent_b = copy.deepcopy(second)
    child = copy.deepcopy(parent_a)
    child["genome_id"] = _new_genome_id()
    child["generation"] = max(
        int(parent_a.get("generation", 1)),
        int(parent_b.get("generation", 1)),
    ) + 1
    child["lineage"] = {
        "parent_ids": [
            parent_a.get("genome_id"),
            parent_b.get("genome_id"),
        ],
        "ancestor_ids": list(
            dict.fromkeys(
                parent_a.get("lineage", {}).get("ancestor_ids", [])
                + parent_b.get("lineage", {}).get("ancestor_ids", [])
            )
        ),
        "innovation_ids": list(
            dict.fromkeys(
                parent_a.get("lineage", {}).get("innovation_ids", [])
                + parent_b.get("lineage", {}).get("innovation_ids", [])
            )
        ),
    }

    sibling_strategies = parent_b.get("strategy_genes", [])
    for strategy_index, strategy in enumerate(child.get("strategy_genes", [])):
        if strategy_index >= len(sibling_strategies):
            continue
        sibling = sibling_strategies[strategy_index]
        sibling_subgenes = sibling.get("subgenes", [])
        for subgene_index, subgene in enumerate(strategy.get("subgenes", [])):
            if subgene_index >= len(sibling_subgenes):
                continue
            sibling_subgene = sibling_subgenes[subgene_index]
            blended = (float(subgene["weight"]) + float(sibling_subgene["weight"])) / 2
            subgene["weight"] = round(_clamp_feature_weight(subgene["feature"], blended), 4)
    child["mutation_log"] = []
    return child
