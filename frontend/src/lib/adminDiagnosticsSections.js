export const TOTAL_DIAGNOSTIC_NODE_COUNT = 76;

export const ADMIN_DIAGNOSTIC_SECTIONS = Object.freeze([
  Object.freeze({ id: 'algorithm', count: 9, startIdx: 0, endIdx: 9 }),
  Object.freeze({ id: 'infrastructure', count: 5, startIdx: 9, endIdx: 14 }),
  Object.freeze({ id: 'security', count: 5, startIdx: 14, endIdx: 19 }),
  Object.freeze({ id: 'council', count: 19, startIdx: 19, endIdx: 38 }),
  Object.freeze({ id: 'shadow', count: 5, startIdx: 38, endIdx: 43 }),
  Object.freeze({ id: 'engine_protection', count: 4, startIdx: 43, endIdx: 47 }),
  Object.freeze({ id: 'db_training', count: 8, startIdx: 47, endIdx: 55 }),
  Object.freeze({ id: 'eval_security', count: 10, startIdx: 55, endIdx: 65 }),
  Object.freeze({ id: 'ops_monitoring', count: 11, startIdx: 65, endIdx: 76 }),
]);

export function getAdminDiagnosticSection(sectionId) {
  return ADMIN_DIAGNOSTIC_SECTIONS.find((section) => section.id === sectionId) || null;
}

export function sliceAdminDiagnosticItems(items, sectionId) {
  const source = Array.isArray(items) ? items : [];
  const section = getAdminDiagnosticSection(sectionId);
  if (!section) {
    return [];
  }
  return source.slice(section.startIdx, section.endIdx);
}
