async function applyManagerAutoRangeSettings({
  queries,
  proposedLower,
  proposedUpper,
}) {
  const lower = parseFloat(proposedLower);
  const upper = parseFloat(proposedUpper);

  if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
    return 0;
  }

  const result = await queries.run(`
    UPDATE manager_ai_settings
    SET
      ai_grid_lower = ?,
      ai_grid_upper = ?,
      updated_at = datetime('now')
    WHERE ai_grid_status = 'ON'
      AND ai_grid_auto_range = 'ON'
  `, [lower, upper]);

  return result?.changes || 0;
}

module.exports = {
  applyManagerAutoRangeSettings,
};
