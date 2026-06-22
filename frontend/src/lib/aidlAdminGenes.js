export function extractAidlAdminGenes(activeMembers = []) {
  return activeMembers.flatMap((member) => {
    try {
      const dna = JSON.parse(member.dna_json || '{}');
      const strategyGenes = Array.isArray(dna.strategy_genes) ? dna.strategy_genes : [];
      return strategyGenes.flatMap((gene) => {
        const contextMaskSummary = Array.isArray(gene?.context_mask) ? gene.context_mask : [];
        const blackSwanEnabled = contextMaskSummary.includes('BLACK_SWAN');
        const strategyEntry = {
          memberId: member.member_id,
          memberName: member.name,
          geneId: gene?.gene_id || '',
          geneScope: 'strategy',
          parentGeneId: '',
          state: gene?.state || '',
          subgeneCount: Array.isArray(gene?.subgenes) ? gene.subgenes.length : 0,
          contextMaskSummary,
          blackSwanEnabled,
          contextOverrideEligible: true,
        };
        const subgeneEntries = Array.isArray(gene?.subgenes)
          ? gene.subgenes
              .filter((subgene) => subgene?.gene_id)
              .map((subgene) => ({
                memberId: member.member_id,
                memberName: member.name,
                geneId: subgene.gene_id,
                geneScope: 'subgene',
                parentGeneId: gene?.gene_id || '',
                state: subgene?.state || '',
                subgeneCount: 0,
                contextMaskSummary,
                blackSwanEnabled,
                contextOverrideEligible: false,
              }))
          : [];
        return strategyEntry.geneId ? [strategyEntry, ...subgeneEntries] : subgeneEntries;
      });
    } catch {
      return [];
    }
  });
}
