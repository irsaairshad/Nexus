import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowUpCircle, ArrowDownCircle, ArrowRightCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import api from '../../api/axios';
import toast from 'react-hot-toast';

interface Transaction {
  _id: string;
  type: 'deposit' | 'withdrawal' | 'transfer';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  recipientId?: { name: string; email: string };
  createdAt: string;
}

type ActiveTab = 'deposit' | 'withdraw' | 'transfer';

export const PaymentsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('deposit');

  // Form states
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await api.get('/payments/transactions');
      setTransactions(response.data);
    } catch (error) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  // Calculate balance from transactions
  const balance = transactions.reduce((acc, t) => {
    if (t.status !== 'completed') return acc;
    if (t.type === 'deposit') return acc + t.amount;
    if (t.type === 'withdrawal' || t.type === 'transfer') return acc - t.amount;
    return acc;
  }, 0);

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) < 1) {
      toast.error('Please enter a valid amount (minimum $1)');
      return;
    }
    setProcessing(true);
    try {
      // Step 1: Create payment intent
      const { data } = await api.post('/payments/deposit', { amount: parseFloat(amount) });

      // Step 2: Simulate payment confirmation (sandbox)
      await api.post('/payments/confirm', { transactionId: data.transactionId });

      toast.success(`$${amount} deposited successfully!`);
      setAmount('');
      fetchTransactions();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Deposit failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) < 1) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (parseFloat(amount) > balance) {
      toast.error('Insufficient balance');
      return;
    }
    setProcessing(true);
    try {
      await api.post('/payments/withdraw', {
        amount: parseFloat(amount),
        description: description || `Withdrawal of $${amount}`,
      });
      toast.success(`$${amount} withdrawn successfully!`);
      setAmount('');
      setDescription('');
      fetchTransactions();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Withdrawal failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleTransfer = async () => {
    if (!amount || parseFloat(amount) < 1) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!recipientEmail) {
      toast.error('Please enter recipient email');
      return;
    }
    if (parseFloat(amount) > balance) {
      toast.error('Insufficient balance');
      return;
    }
    setProcessing(true);
    try {
      // Find recipient by email
      const usersRes = await api.get('/users');
      const recipient = usersRes.data.find((u: any) => u.email === recipientEmail);
      if (!recipient) {
        toast.error('Recipient not found');
        setProcessing(false);
        return;
      }

      await api.post('/payments/transfer', {
        amount: parseFloat(amount),
        recipientId: recipient._id,
        description: description || `Transfer to ${recipient.name}`,
      });
      toast.success(`$${amount} transferred to ${recipient.name}!`);
      setAmount('');
      setDescription('');
      setRecipientEmail('');
      fetchTransactions();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Transfer failed');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle size={16} className="text-green-500" />;
    if (status === 'failed') return <XCircle size={16} className="text-red-500" />;
    return <Clock size={16} className="text-yellow-500" />;
  };

  const getTypeIcon = (type: string) => {
    if (type === 'deposit') return <ArrowDownCircle size={20} className="text-green-500" />;
    if (type === 'withdrawal') return <ArrowUpCircle size={20} className="text-red-500" />;
    return <ArrowRightCircle size={20} className="text-blue-500" />;
  };

  const getAmountColor = (type: string) => {
    if (type === 'deposit') return 'text-green-600';
    return 'text-red-600';
  };

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'deposit', label: 'Deposit' },
    { key: 'withdraw', label: 'Withdraw' },
    { key: 'transfer', label: 'Transfer' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-gray-600">Manage your funds and transactions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Balance + Action Form */}
        <div className="space-y-4">
          {/* Balance Card */}
          <Card className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
            <CardBody>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white bg-opacity-20 rounded-full">
                  <DollarSign size={24} className="text-white" />
                </div>
                <p className="text-primary-100 text-sm font-medium">Available Balance</p>
              </div>
              <h2 className="text-4xl font-bold">${balance.toFixed(2)}</h2>
              <p className="text-primary-200 text-xs mt-2">USD • Sandbox Mode</p>
            </CardBody>
          </Card>

          {/* Action Form */}
          <Card>
            <CardHeader>
              {/* Tabs */}
              <div className="flex rounded-lg overflow-hidden border border-gray-200">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setAmount(''); setDescription(''); setRecipientEmail(''); }}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardBody className="space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Recipient Email (Transfer only) */}
              {activeTab === 'transfer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={e => setRecipientEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Quick amounts (deposit only) */}
              {activeTab === 'deposit' && (
                <div className="flex gap-2 flex-wrap">
                  {[100, 500, 1000, 5000].map(q => (
                    <button
                      key={q}
                      onClick={() => setAmount(q.toString())}
                      className="px-3 py-1 text-sm border border-gray-200 rounded-full hover:bg-primary-50 hover:border-primary-300 transition-colors"
                    >
                      ${q}
                    </button>
                  ))}
                </div>
              )}

              <Button
                className="w-full"
                onClick={activeTab === 'deposit' ? handleDeposit : activeTab === 'withdraw' ? handleWithdraw : handleTransfer}
                disabled={processing}
              >
                {processing ? 'Processing...' : `Confirm ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
              </Button>

              <p className="text-xs text-center text-gray-400">
                🔒 Sandbox mode — no real charges
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Right — Transaction History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Transaction History</h2>
              <Badge variant="secondary">{transactions.length} total</Badge>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading transactions...</div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-600">No transactions yet</p>
                  <p className="text-sm text-gray-500 mt-1">Make your first deposit to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map(t => (
                    <div key={t._id} className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className="p-2 bg-gray-100 rounded-full mr-3">
                        {getTypeIcon(t.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 capitalize">{t.type}</p>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(t.status)}
                            <span className="text-xs text-gray-500 capitalize">{t.status}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{t.description}</p>
                        {t.recipientId && (
                          <p className="text-xs text-gray-400">To: {t.recipientId.name}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString()}
                        </p>
                      </div>

                      <div className={`text-sm font-semibold ${getAmountColor(t.type)}`}>
                        {t.type === 'deposit' ? '+' : '-'}${t.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};