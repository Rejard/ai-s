import assert from 'node:assert/strict';
import { extractAidlAdminGenes } from './aidlAdminGenes.js';

const genes = extractAidlAdminGenes([
  {
    member_id: 'm1',
    name: 'Alpha',
    dna_json: JSON.stringify({
      strategy_genes: [
        {
          gene_id: 'sg1',
          state: 'A',
          context_mask: ['BULL_EXPANSION', 'BLACK_SWAN'],
          subgenes: [
            { gene_id: 'sub1', state: 'D' },
            { gene_id: 'sub2', state: 'I' },
          ],
        },
      ],
    }),
  },
]);

assert.deepEqual(genes, [
  {
    memberId: 'm1',
    memberName: 'Alpha',
    geneId: 'sg1',
    geneScope: 'strategy',
    parentGeneId: '',
    state: 'A',
    subgeneCount: 2,
    contextMaskSummary: ['BULL_EXPANSION', 'BLACK_SWAN'],
    blackSwanEnabled: true,
    contextOverrideEligible: true,
  },
  {
    memberId: 'm1',
    memberName: 'Alpha',
    geneId: 'sub1',
    geneScope: 'subgene',
    parentGeneId: 'sg1',
    state: 'D',
    subgeneCount: 0,
    contextMaskSummary: ['BULL_EXPANSION', 'BLACK_SWAN'],
    blackSwanEnabled: true,
    contextOverrideEligible: false,
  },
  {
    memberId: 'm1',
    memberName: 'Alpha',
    geneId: 'sub2',
    geneScope: 'subgene',
    parentGeneId: 'sg1',
    state: 'I',
    subgeneCount: 0,
    contextMaskSummary: ['BULL_EXPANSION', 'BLACK_SWAN'],
    blackSwanEnabled: true,
    contextOverrideEligible: false,
  },
]);

assert.deepEqual(extractAidlAdminGenes([{ member_id: 'm2', name: 'Broken', dna_json: '{}' }]), []);

console.log('aidlAdminGenes tests passed');
