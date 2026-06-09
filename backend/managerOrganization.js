const getManagerAccount = async (store, email) => store.get(
  `SELECT id, email, wallet_address
   FROM users
   WHERE LOWER(email) = LOWER(?)
     AND is_manager = 1
     AND status = 'APPROVED'`,
  [String(email || '').trim()]
);

const getManagedUser = async (store, managerWallet, userWallet) => store.get(
  `SELECT *
   FROM users
   WHERE LOWER(wallet_address) = LOWER(?)
     AND LOWER(manager_address) = LOWER(?)
     AND COALESCE(is_manager, 0) = 0`,
  [String(userWallet || '').trim(), String(managerWallet || '').trim()]
);

const getManagedWithdrawal = async (store, managerWallet, withdrawalId) => store.get(
  `SELECT p.*
   FROM payments p
   JOIN users u ON LOWER(p.wallet_address) = LOWER(u.wallet_address)
   WHERE p.id = ?
     AND p.type = 'WITHDRAW_REQUEST'
     AND p.status = 'PENDING'
     AND LOWER(u.manager_address) = LOWER(?)
     AND COALESCE(u.is_manager, 0) = 0`,
  [withdrawalId, String(managerWallet || '').trim()]
);

module.exports = {
  getManagerAccount,
  getManagedUser,
  getManagedWithdrawal,
};
