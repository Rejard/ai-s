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
  `SELECT *
   FROM withdrawal_requests
   WHERE id = ?
     AND status = 'PENDING'
     AND LOWER(manager_address) = LOWER(?)`,
  [withdrawalId, String(managerWallet || '').trim()]
);

module.exports = {
  getManagerAccount,
  getManagedUser,
  getManagedWithdrawal,
};
