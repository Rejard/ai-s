const fs = require('fs');

const pageContent = fs.readFileSync('frontend/src/pages/EditUserPage.jsx', 'utf8');

let modalContent = pageContent.replace(/import \{ useParams, useNavigate \} from 'react-router-dom';/, "import { useNavigate } from 'react-router-dom';\nimport { X } from 'lucide-react';");

modalContent = modalContent.replace(/function EditUserPage\(\) \{/, 'function EditUserModal({ walletAddress: paramWalletAddress, managerEmail, onClose, onSuccess }) {');
modalContent = modalContent.replace(/const \{ walletAddress: paramWalletAddress \} = useParams\(\);/, '');
modalContent = modalContent.replace(/const navigate = useNavigate\(\);/, '');

modalContent = modalContent.replace(/navigate\('\/manager'\)/g, 'onClose()');

modalContent = modalContent.replace(/const headers = \{ headers: \{ 'x-manager-email': 'lemaiiisk@gmail.com' \} \};/g, "const headers = { headers: { 'x-manager-email': managerEmail || 'lemaiiisk@gmail.com' } };");

const returnRegex = /return \([\s\S]*?\n\s*<div style=\{\{ padding: '20px 20px 50px'/;
modalContent = modalContent.replace(returnRegex, `return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(10px)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      <div className="app-frame" style={{ 
        width: '100%', 
        maxWidth: '600px', 
        maxHeight: '90vh', 
        overflowY: 'auto', 
        background: 'var(--bg-app)', 
        borderRadius: '20px', 
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 0 30px rgba(139, 92, 246, 0.2)',
        position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', zIndex: 10 }}>
          <X size={24} />
        </button>
        <div style={{ padding: '20px 20px 50px'`);

modalContent = modalContent.replace(/<\/form>\s*<\/div>\s*\);\s*\}/, `</form>\s*</div>\s*</div>\s*</div>\s*);\s*}`);

modalContent = modalContent.replace(/alert\('🎉 ' \+ res\.data\.message\);\s*onClose\(\);/g, "alert('🎉 ' + res.data.message);\n        if(onSuccess) onSuccess();\n        onClose();");
modalContent = modalContent.replace(/alert\(`🎉 성공적으로 \$\{amountToSend\} SUT 온체인 실지급이 완료되었습니다!\\n거래 해시\(TxHash\): \$\{tx\.hash\}`\);\s*setPayoutAmount\(''\);/g, "alert(`🎉 성공적으로 ${amountToSend} SUT 온체인 실지급이 완료되었습니다!\\n거래 해시(TxHash): ${tx.hash}`);\n      setPayoutAmount('');\n      if(onSuccess) onSuccess();");

modalContent = modalContent.replace(/<button\s*className="btn-secondary"\s*onClick=\{onClose\}\s*style=\{\{ width: '40px', height: '40px'.*?<\/button>/s, "");
modalContent = modalContent.replace(/<h2 style=\{\{ fontSize: '18px', color: '#F9FAFB'/g, "<h2 style={{ fontSize: '18px', color: '#F9FAFB', marginTop: '10px'");

modalContent = modalContent.replace(/export default EditUserPage;/, 'export default EditUserModal;');

fs.writeFileSync('frontend/src/components/EditUserModal.jsx', modalContent, 'utf8');
console.log('EditUserModal created!');
