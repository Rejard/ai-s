const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const FONT_REGULAR = path.join(__dirname, 'fonts', 'NotoSansKR-Regular.otf');
const FONT_BOLD = path.join(__dirname, 'fonts', 'NotoSansKR-Bold.otf');

function generateLedgerPdf(res, { managerName, managerEmail, managerPhone, memberName, memberWallet, periodStart, periodEnd, entries, summary }) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  const safeName = encodeURIComponent(memberName || memberWallet.slice(0, 8));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}_${periodStart}_${periodEnd}.pdf`);
  doc.pipe(res);

  const hasKoreanFont = fs.existsSync(FONT_REGULAR) && fs.existsSync(FONT_BOLD);
  if (hasKoreanFont) {
    doc.registerFont('Regular', FONT_REGULAR);
    doc.registerFont('Bold', FONT_BOLD);
  }

  const font = (bold) => {
    doc.font(hasKoreanFont ? (bold ? 'Bold' : 'Regular') : (bold ? 'Helvetica-Bold' : 'Helvetica'));
  };

  const LEFT = 50;
  const RIGHT = 545;
  const W = RIGHT - LEFT;
  const today = new Date().toISOString().split('T')[0];

  font(true);
  doc.fontSize(18).fillColor('#000000').text('AiS 거래 명세서', LEFT, doc.y, { align: 'center', width: W });
  doc.moveDown(0.3);
  font(false);
  doc.fontSize(9).text(`발행일: ${today}`, LEFT, doc.y, { align: 'right', width: W });
  doc.moveDown(0.8);

  doc.fontSize(10).fillColor('#000000');
  doc.text(`매니저: ${managerName}`, LEFT);
  doc.text(`이메일: ${managerEmail}`, LEFT);
  doc.text(`연락처: ${managerPhone}`, LEFT);
  doc.moveDown(0.4);

  doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).strokeColor('#000000').lineWidth(0.5).stroke();
  doc.moveDown(0.4);

  doc.text(`회원명: ${memberName}`, LEFT);
  doc.text(`지갑주소: ${memberWallet}`, LEFT);
  doc.text(`조회기간: ${periodStart} ~ ${periodEnd}`, LEFT);
  doc.moveDown(0.8);

  const tableTop = doc.y;
  const colX = [LEFT, LEFT + 85, LEFT + 165, LEFT + 260, LEFT + 420];
  const colW = [85, 80, 95, 160, 55];
  const headers = ['일시', '구분', '금액(SUT)', '트랜잭션 해시', '검증'];

  doc.moveTo(LEFT, tableTop - 2).lineTo(RIGHT, tableTop - 2).strokeColor('#000000').lineWidth(0.8).stroke();

  font(true);
  doc.fontSize(9).fillColor('#000000');
  headers.forEach((h, i) => {
    doc.text(h, colX[i], tableTop, { width: colW[i] });
  });

  doc.moveTo(LEFT, tableTop + 14).lineTo(RIGHT, tableTop + 14).strokeColor('#000000').lineWidth(0.8).stroke();

  font(false);
  doc.fontSize(9).fillColor('#000000');
  let yPos = tableTop + 22;

  const typeLabels = { DEPOSIT: '입금', WITHDRAWAL: '출금', AI_PROFIT: 'AI 수익', ADJUSTMENT: '조정' };

  for (const entry of entries) {
    if (yPos > 740) {
      doc.addPage();
      yPos = 50;
    }

    const date = entry.created_at ? entry.created_at.split(' ')[0] : '';
    const type = typeLabels[entry.type] || entry.type;
    const amount = entry.type === 'WITHDRAWAL' ? `-${entry.amount}` : `+${entry.amount}`;
    const txHash = entry.tx_hash ? (entry.tx_hash.length > 20 ? entry.tx_hash.slice(0, 18) + '...' : entry.tx_hash) : '-';
    const verified = entry.verified ? 'Y' : '-';
    const amountColor = entry.type === 'WITHDRAWAL' ? '#DC2626' : '#16A34A';

    doc.fillColor('#000000').text(date, colX[0], yPos, { width: colW[0] });
    doc.fillColor('#000000').text(type, colX[1], yPos, { width: colW[1] });
    doc.fillColor(amountColor).text(amount, colX[2], yPos, { width: colW[2] });
    doc.fillColor('#000000').fontSize(8).text(txHash, colX[3], yPos, { width: colW[3] });
    doc.fontSize(9).text(verified, colX[4], yPos, { width: colW[4] });
    yPos += 20;

    doc.moveTo(LEFT, yPos - 4).lineTo(RIGHT, yPos - 4).strokeColor('#CCCCCC').lineWidth(0.3).stroke();
  }

  const lineY = yPos + 6;
  doc.moveTo(LEFT, lineY).lineTo(RIGHT, lineY).strokeColor('#000000').lineWidth(0.8).stroke();

  let sumY = lineY + 16;
  const sumData = [
    ['총 입금액:', `${(summary.totalDeposited || 0).toFixed(2)} SUT`, '#16A34A'],
    ['총 출금액:', `${(summary.totalWithdrawn || 0).toFixed(2)} SUT`, '#DC2626'],
    ['AI 운용수익:', `${(summary.totalAiProfit || 0).toFixed(2)} SUT`, '#2563EB'],
    ['현재 잔액:', `${(summary.balance || 0).toFixed(2)} SUT`, '#000000'],
  ];

  sumData.forEach(([label, value, color]) => {
    font(false);
    doc.fontSize(10).fillColor('#000000').text(label, LEFT, sumY);
    font(true);
    doc.fillColor(color).text(value, LEFT + 140, sumY);
    sumY += 20;
  });

  sumY += 16;
  font(false);
  doc.fontSize(8).fillColor('#666666');
  doc.text('Y = 블록체인 온체인 검증 완료 거래', LEFT, sumY);
  doc.text('본 명세서는 Polygon 블록체인 기록을 기반으로 AiS 플랫폼에서 자동 생성되었습니다.', LEFT);
  doc.moveDown(0.5);
  doc.text(`문의: ${managerEmail}  |  ${managerPhone}`, LEFT);

  doc.end();
}

module.exports = { generateLedgerPdf };
