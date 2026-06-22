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
REGULAR_AIDL_CONTEXTS = (
    "BULL_EXPANSION",
    "BULL_SQUEEZE",
    "BEAR_EXPANSION",
    "BEAR_SQUEEZE",
)
BLACK_SWAN_CONTEXT = "BLACK_SWAN"
AIDL_CONTEXTS = set(REGULAR_AIDL_CONTEXTS + (BLACK_SWAN_CONTEXT,))
ACTIONS = ("BUY", "SELL", "HOLD")
STATE_MUTATION_TRANSITIONS = {
    "I": "A",
    "A": "D",
    "D": "L",
    "L": "I",
}


def _new_genome_id(generation=1):
    return f"AISG-G{generation}-{uuid.uuid4().hex[:8]}"


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


def _collect_state_mutation_targets(dna):
    targets = []
    for strategy in dna.get("strategy_genes", []):
        if strategy.get("state") in STATE_MUTATION_TRANSITIONS:
            targets.append(strategy)
        for subgene in strategy.get("subgenes", []):
            if subgene.get("state") in STATE_MUTATION_TRANSITIONS:
                targets.append(subgene)
    return targets


def _choose_state_transition(current_state, profile, random_value):
    reactivation_bias = float(profile.get("reactivation_bias", 0.1))
    decay_resistance = float(profile.get("decay_resistance", 0.3))

    if current_state == "I":
        return "A" if random_value <= reactivation_bias else "D"
    if current_state == "A":
        return "D"
    if current_state == "D":
        return "I" if random_value <= decay_resistance else "L"
    if current_state == "L":
        return "I"
    return current_state


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
        context_mask = strategy.get("context_mask")
        if not isinstance(context_mask, list):
            return False
        if not all(c in AIDL_CONTEXTS for c in context_mask):
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
        "context_mask": list(REGULAR_AIDL_CONTEXTS),
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
        "genome_id": _new_genome_id(generation),
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


def build_expression_plan(dna, current_context=None):
    expressed = []
    profile = dna.get("regulatory_profile", {}) if isinstance(dna.get("regulatory_profile"), dict) else {}
    budget_remaining = float(profile.get("expression_budget", 12))
    dominance_bias = float(profile.get("dominance_bias", 1.0))
    for strategy in dna.get("strategy_genes", []):
        if strategy.get("state") in ("I", "L"):
            continue
        if current_context is not None:
            mask = strategy.get("context_mask", [])
            if current_context not in mask:
                continue
        strategy_length = max(1.0, float(strategy.get("length", 1)))
        copy_number = max(1.0, float(strategy.get("copy_number", 1)))
        strategy_cost = max(1, int(math.ceil(strategy_length / copy_number)))
        if budget_remaining < strategy_cost:
            continue
        budget_remaining -= strategy_cost
        strategy_factor = float(strategy.get("dominance", 1.0)) * dominance_bias
        for subgene in strategy.get("subgenes", []):
            state = subgene.get("state")
            if state not in ("A", "D"):
                continue
            expressed_subgene = copy.deepcopy(subgene)
            expression_factor = 0.5 if "D" in (strategy.get("state"), state) else 1.0
            expressed_subgene["weight"] = round(
                _clamp_feature_weight(
                    expressed_subgene["feature"],
                    float(expressed_subgene["weight"]) * expression_factor * strategy_factor,
                ),
                4,
            )
            expressed.append(expressed_subgene)
    return {
        "genome_id": dna.get("genome_id"),
        "expressed_subgenes": expressed,
    }


def build_phenotype_from_dna(dna, current_context=None):
    plan = build_expression_plan(dna, current_context)
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


def predict_variant_effect(dna):
    """
    AI-VEP (AI Variant Effect Predictor)
    Screen mutated DNA against context-specific lethal risk before it reaches the sandbox.
    """
    history = dna.get("fitness_history", [])
    has_recent_fitness_collapse = False
    if len(history) >= 3:
        recent = history[-3:]
        holdouts = [entry.get("holdoutScore") for entry in recent]
        if not any(score is None for score in holdouts):
            has_recent_fitness_collapse = (
                holdouts[0] > holdouts[1] > holdouts[2]
                and float(holdouts[2]) <= 40.0
            )

    for context in AIDL_CONTEXTS:
        phenotype = build_phenotype_from_dna(dna, context)
        for action in ACTIONS:
            weights = phenotype[action]
            for feature_index, w in enumerate(weights):
                feature_name = FEATURE_ORDER[feature_index]
                limit = FEATURE_ABS_LIMITS[feature_index]

                # 1. Global overfit guard near the canonical feature limit.
                if abs(w) >= limit * 0.95:
                    return "LETHAL"

                # 2. BLACK_SWAN directional chase guard.
                if context == BLACK_SWAN_CONTEXT and action in ("BUY", "SELL"):
                    if feature_name in ("price_change_pct", "sma5_to_sma20_spread_pct") and abs(w) > limit * 0.55:
                        return "LETHAL"
                    if has_recent_fitness_collapse and feature_name in ("price_change_pct", "rsi_scaled") and abs(w) > limit * 0.45:
                        return "LETHAL"

                # 3. BEAR_EXPANSION downside-catching guard.
                if context == "BEAR_EXPANSION" and action == "BUY":
                    if feature_name in ("rsi_scaled", "price_change_pct") and w > limit * 0.70:
                        return "LETHAL"
                    if has_recent_fitness_collapse and feature_name in ("rsi_scaled", "price_change_pct") and w > limit * 0.65:
                        return "LETHAL"
                if context == "BULL_EXPANSION" and action == "BUY":
                    if feature_name in ("price_change_pct", "sma5_to_sma20_spread_pct") and w > limit * 0.75:
                        return "LETHAL"

                # 4. Squeeze-regime timing guard.
                if context == "BEAR_SQUEEZE" and action == "BUY":
                    if feature_name == "sma5_to_sma20_spread_pct" and w > limit * 0.80:
                        return "LETHAL"
                if context == "BULL_SQUEEZE" and action == "SELL":
                    if feature_name in ("price_change_pct", "rsi_scaled") and w > limit * 0.75:
                        return "LETHAL"
    return "BENIGN"

def _resolve_runtime_policy(runtime_policy=None):
    policy = {
        "context_mutation_rate": 0.10,
        "state_mutation_rate": 0.10,
        "weight_nudge_size": 0.02,
    }
    if isinstance(runtime_policy, dict):
        for key in policy:
            value = runtime_policy.get(key)
            if _is_finite_number(value):
                policy[key] = float(value)
    return policy


def mutate_dna(dna, preserve_parent_ids=False, runtime_policy=None):
    import random
    parent_genome_id = dna.get("genome_id")
    existing_lineage = dna.get("lineage", {})
    existing_parents = list(existing_lineage.get("parent_ids", []))
    policy = _resolve_runtime_policy(runtime_policy)
    
    # Try up to five mutation attempts and keep only variants that pass AI-VEP.
    for attempt in range(5):
        mutated = copy.deepcopy(dna)
        mutated["genome_id"] = _new_genome_id(mutated.get("generation", 1))
        mutated["lineage"] = {
            "parent_ids": (
                existing_parents
                if preserve_parent_ids and existing_parents
                else ([parent_genome_id] if parent_genome_id else [])
            ),
            "ancestor_ids": list(existing_lineage.get("ancestor_ids", [])),
            "innovation_ids": list(existing_lineage.get("innovation_ids", [])),
        }

        # 10% chance of Context Mask Mutation
        context_mutated = False
        if random.random() < policy["context_mutation_rate"]:
            contexts = list(AIDL_CONTEXTS)
            for strategy in mutated.get("strategy_genes", []):
                mask = list(strategy.get("context_mask", []))
                target = random.choice(contexts)
                if target in mask:
                    if len(mask) > 1:
                        mask.remove(target)
                        context_mutated = True
                else:
                    mask.append(target)
                    context_mutated = True
                strategy["context_mask"] = mask
                if context_mutated:
                    mutated.setdefault("mutation_log", []).append(
                        {
                            "generation": mutated.get("generation", 1),
                            "event": "context_mask_mutation",
                            "gene_id": strategy.get("gene_id"),
                        }
                    )
                    break

        if random.random() < policy["state_mutation_rate"]:
            state_targets = _collect_state_mutation_targets(mutated)
            if state_targets:
                target_gene = random.choice(state_targets)
                from_state = target_gene["state"]
                to_state = _choose_state_transition(
                    from_state,
                    mutated.get("regulatory_profile", {}),
                    random.random(),
                )
                target_gene["state"] = to_state
                mutated.setdefault("mutation_log", []).append(
                    {
                        "generation": mutated.get("generation", 1),
                        "event": "state_mutation",
                        "gene_id": target_gene.get("gene_id"),
                        "from_state": from_state,
                        "to_state": to_state,
                    }
                )

        applied_nudge = False
        for strategy in mutated.get("strategy_genes", []):
            for subgene in strategy.get("subgenes", []):
                if subgene.get("state") == "A":
                    nudge_size = abs(policy["weight_nudge_size"])
                    nudge = nudge_size if random.random() > 0.5 else -nudge_size
                    subgene["weight"] = round(
                        _clamp_feature_weight(subgene["feature"], float(subgene["weight"]) + nudge),
                        4,
                    )
                    mutated.setdefault("mutation_log", []).append(
                        {
                            "generation": mutated.get("generation", 1),
                            "event": "weight_nudge",
                            "gene_id": subgene.get("gene_id"),
                        }
                    )
                    applied_nudge = True
                    break
            if applied_nudge:
                break
                
        if not applied_nudge:
            mutated.setdefault("mutation_log", []).append(
                {"generation": mutated.get("generation", 1), "event": "no_active_gene"}
            )
            
        # Return immediately when the mutation survives AI-VEP screening.
        if predict_variant_effect(mutated) != "LETHAL":
            return mutated
    # After five lethal attempts, keep a safe fallback copy and log the VEP rejection.
    fallback = copy.deepcopy(dna)
    fallback["genome_id"] = _new_genome_id(fallback.get("generation", 1))
    fallback.setdefault("mutation_log", []).append(
        {"generation": fallback.get("generation", 1), "event": "vep_filtered_deleterious_mutation"}
    )
    return fallback


def crossover_dna(first, second):
    parent_a = copy.deepcopy(first)
    parent_b = copy.deepcopy(second)
    child = copy.deepcopy(parent_a)
    child["generation"] = max(
        int(parent_a.get("generation", 1)),
        int(parent_b.get("generation", 1)),
    ) + 1
    child["genome_id"] = _new_genome_id(child["generation"])
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

        if "L" in (strategy.get("state"), sibling.get("state")):
            strategy["state"] = "I"

        # Combine context masks (union)
        parent_a_mask = strategy.get("context_mask", [])
        parent_b_mask = sibling.get("context_mask", [])
        combined_mask = sorted(list(set(parent_a_mask + parent_b_mask)))
        strategy["context_mask"] = combined_mask

        sibling_subgenes = sibling.get("subgenes", [])
        for subgene_index, subgene in enumerate(strategy.get("subgenes", [])):
            if subgene_index >= len(sibling_subgenes):
                continue
            sibling_subgene = sibling_subgenes[subgene_index]
            if "L" in (subgene.get("state"), sibling_subgene.get("state")):
                subgene["state"] = "I"
            blended = (float(subgene["weight"]) + float(sibling_subgene["weight"])) / 2
            subgene["weight"] = round(_clamp_feature_weight(subgene["feature"], blended), 4)
    child["mutation_log"] = []
    return child

