const fs = require('fs');

// 1. Update App.jsx
let appJsx = fs.readFileSync('frontend/src/App.jsx', 'utf8');
appJsx = appJsx.replace(/import EditUserPage from '\.\/pages\/EditUserPage';\n?/, '');
appJsx = appJsx.replace(/<Route path="\/manager\/edit-user\/:walletAddress" element=\{[\s\S]*?<\/Route>\s*/, '');
fs.writeFileSync('frontend/src/App.jsx', appJsx, 'utf8');
console.log('App.jsx updated');

// 2. Update ManagerDashboard.jsx and PcManagerDashboard.jsx
const dashboards = ['frontend/src/pages/ManagerDashboard.jsx', 'frontend/src/pages/PcManagerDashboard.jsx'];

dashboards.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  // Add import if not exists
  if (!content.includes('import EditUserModal')) {
    content = content.replace(/import \{ useNavigate \} from 'react-router-dom';/, "import { useNavigate } from 'react-router-dom';\nimport EditUserModal from '../components/EditUserModal';");
  }

  // Add state if not exists
  if (!content.includes('const [editingUser, setEditingUser] = useState(null);')) {
    content = content.replace(/const \[pendingUsers, setPendingUsers\] = useState\(\[\]\);/, "const [editingUser, setEditingUser] = useState(null);\n  const [pendingUsers, setPendingUsers] = useState([]);");
  }

  // Replace navigates to edit user
  content = content.replace(/onClick=\{\(\) => navigate\(`\/manager\/edit-user\/\$\{user\.wallet_address\}`\)\}/g, "onClick={() => setEditingUser(user.wallet_address)}");

  // Render modal before final closing div
  // The final closing div in these files is usually at the very end
  if (!content.includes('<EditUserModal')) {
    const modalStr = `
      {editingUser && (
        <EditUserModal 
          walletAddress={editingUser} 
          managerEmail={managerEmail} 
          onClose={() => setEditingUser(null)} 
          onSuccess={() => fetchManagerData()} 
        />
      )}
    </div>
  );
}
`;
    content = content.replace(/<\/div>\s*\);\s*\}\s*export default/, modalStr + '\nexport default');
  }

  fs.writeFileSync(f, content, 'utf8');
  console.log('Updated:', f);
});
