const fs = require('fs');

let appJsx = fs.readFileSync('frontend/src/App.jsx', 'utf8');
appJsx = appJsx.replace(/import EditUserPage from '\.\/pages\/EditUserPage';\n?/, '');
appJsx = appJsx.replace(/<Route path="\/manager\/edit-user\/:walletAddress" element=\{[\s\S]*?<\/Route>\s*/, '');
fs.writeFileSync('frontend/src/App.jsx', appJsx, 'utf8');
console.log('App.jsx updated');

const dashboards = ['frontend/src/pages/ManagerDashboard.jsx', 'frontend/src/pages/PcManagerDashboard.jsx'];

dashboards.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  if (!content.includes('import EditUserModal')) {
    content = content.replace(/import \{ useNavigate \} from 'react-router-dom';/, "import { useNavigate } from 'react-router-dom';\nimport EditUserModal from '../components/EditUserModal';");
  }

  if (!content.includes('const [editingUser, setEditingUser] = useState(null);')) {
    content = content.replace(/const \[pendingUsers, setPendingUsers\] = useState\(\[\]\);/, "const [editingUser, setEditingUser] = useState(null);\n  const [pendingUsers, setPendingUsers] = useState([]);");
  }

  content = content.replace(/onClick=\{\(\) => navigate\(`\/manager\/edit-user\/\$\{user\.wallet_address\}`\)\}/g, "onClick={() => setEditingUser(user.wallet_address)}");

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
