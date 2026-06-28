export const TOTAL_DIAGNOSTIC_NODE_COUNT = 43;

export const ADMIN_DIAGNOSTIC_SECTIONS = Object.freeze([
  Object.freeze({ id: 'algorithm', count: 9, startIdx: 0, endIdx: 9 }),
  Object.freeze({ id: 'infrastructure', count: 5, startIdx: 9, endIdx: 14 }),
  Object.freeze({ id: 'security', count: 5, startIdx: 14, endIdx: 19 }),
  Object.freeze({ id: 'council', count: 19, startIdx: 19, endIdx: 38 }),
  Object.freeze({ id: 'shadow', count: 5, startIdx: 38, endIdx: 43 }),
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
