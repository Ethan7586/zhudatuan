def same_set($x; $y): (($x | sort) == ($y | sort));

def controls_unchanged:
  ([$n[0].nodes[] |
    (.unchanged == true and
     .baseline_digest == .after_activation_digest and
     .baseline_digest == .after_rollback_digest)] | all);

def history_unchanged:
  ([$h[0].nodes[] |
    (.unchanged == true and
     .baseline.combined_digest == .after_activation.combined_digest and
     .baseline.combined_digest == .after_rollback.combined_digest)] | all);

{
  artifact_b_build_count: $m[0].artifacts.B.build_count,
  artifact_b_identity_count: $m[0].build_contract.candidate_b_artifact_identity_count,
  artifact_b_eligible_nodes: ($m[0].build_contract.eligible_nodes | sort),
  node_specific_source_count: $m[0].build_contract.node_specific_source_count,
  pointer_sequence_s_b: [$t[0].events[].state.nodes["s-b"].health.release],
  pointer_sequence_s_a: [$t[0].events[].state.nodes["s-a"].health.release],
  pointer_sequence_s_c: [$t[0].events[].state.nodes["s-c"].health.release],
  activation_selected_nodes: ($a[0].target_manifest.selected_nodes | sort),
  activation_excluded_nodes: ($a[0].target_manifest.excluded_nodes | sort),
  activation_release: $a[0].observed_after.health.release,
  activation_health: $a[0].observed_after.health.status,
  activation_control_processes_unchanged:
    ($a[0].agent_receipt.result.protectedProcesses.before ==
     $a[0].agent_receipt.result.protectedProcesses.after),
  rollback_selected_nodes: ($r[0].target_manifest.selected_nodes | sort),
  rollback_excluded_nodes: ($r[0].target_manifest.excluded_nodes | sort),
  rollback_release: $r[0].observed_after.health.release,
  rollback_health: $r[0].observed_after.health.status,
  rollback_control_processes_unchanged:
    ($r[0].agent_receipt.result.protectedProcesses.before ==
     $r[0].agent_receipt.result.protectedProcesses.after),
  non_target_total_change_count: $n[0].total_change_count,
  non_target_digests_unchanged: controls_unchanged,
  four_flow_total_change_count: $h[0].total_change_count,
  history_recalculation_or_overwrite_count: $h[0].history_recalculation_or_overwrite_count,
  four_flow_digests_unchanged: history_unchanged,
  all_thresholds_met: (
    $m[0].artifacts.B.build_count == 1 and
    $m[0].build_contract.candidate_b_artifact_identity_count == 1 and
    same_set($m[0].build_contract.eligible_nodes; ["s-a", "s-b", "s-c"]) and
    $m[0].build_contract.node_specific_source_count == 0 and
    [$t[0].events[].state.nodes["s-b"].health.release] == ["A", "B", "A"] and
    [$t[0].events[].state.nodes["s-a"].health.release] == ["A", "A", "A"] and
    [$t[0].events[].state.nodes["s-c"].health.release] == ["A", "A", "A"] and
    same_set($a[0].target_manifest.selected_nodes; ["s-b"]) and
    same_set($a[0].target_manifest.excluded_nodes; ["s-a", "s-c"]) and
    $a[0].observed_after.health.release == "B" and
    $a[0].observed_after.health.status == "ready" and
    $a[0].agent_receipt.result.protectedProcesses.before ==
      $a[0].agent_receipt.result.protectedProcesses.after and
    same_set($r[0].target_manifest.selected_nodes; ["s-b"]) and
    same_set($r[0].target_manifest.excluded_nodes; ["s-a", "s-c"]) and
    $r[0].observed_after.health.release == "A" and
    $r[0].observed_after.health.status == "ready" and
    $r[0].agent_receipt.result.protectedProcesses.before ==
      $r[0].agent_receipt.result.protectedProcesses.after and
    $n[0].total_change_count == 0 and
    controls_unchanged and
    $h[0].total_change_count == 0 and
    $h[0].history_recalculation_or_overwrite_count == 0 and
    history_unchanged
  )
}
