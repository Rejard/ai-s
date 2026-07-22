const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const backendPath = path.resolve(__dirname, '../../backend');

module.exports = {
  id: 'ais-python-ten-feature-contract',
  name: 'AiS Python 10특징량 계약',
  layer: 'TASK',
  linkedTask: 'TASK-AIS-PYTHON-TEN-FEATURES',

  async run() {
    const featureSource = fs.readFileSync(path.join(backendPath, 'ais_features.py'), 'utf8');
    if (!featureSource.includes('FEATURE_COUNT = 10')) return { status: 'ERROR', details: 'Python 특징량이 10개로 고정되어 있지 않습니다.' };
    try {
      execFileSync('py', ['-3', 'test_ais_features.py'], { cwd: backendPath, stdio: 'pipe' });
      execFileSync('py', ['-3', 'test_ais_dna.py'], { cwd: backendPath, stdio: 'pipe' });
    } catch (error) {
      return { status: 'ERROR', details: `Python 10특징량 검증 실패: ${error.message}` };
    }
    return { status: 'OK', details: 'Python 특징량·DNA 테스트가 10특징량 계약으로 통과했습니다.' };
  },
};
