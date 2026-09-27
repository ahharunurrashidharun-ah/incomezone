import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Wallet, CreditCard, History, CheckCircle2, Clock, XCircle, Info } from 'lucide-react';
import {
  getLocalDeposits,
  addLocalDeposit,
  getLocalUser,
  isTableMissingError,
} from '../lib/localFallbackStore';

interface DepositRequest {
  id: string;
  method?: string;
  senderNumber: string;
  transactionId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

export default function DepositPage() {
  const { user, profile } = useAuth();
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [requests, setRequests] = useState<DepositRequest[]>([]);
  const [success, setSuccess] = useState('');
  const [methods, setMethods] = useState<any>(null);

  const fetchSettings = async () => {
    try {
      let localSS = null;
      try {
        const str = localStorage.getItem('iz_payment_methods');
        if (str) localSS = JSON.parse(str);
      } catch(e) {}

      
      // Try to get payment methods from settings table
      let { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'deposit_methods')
        .maybeSingle();
        
      if (data && data.value) {
        data = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        // Normalize nested JSON format if it exists
        if (data.bkash && typeof data.bkash === 'object') {
          data = {
            bkash_enabled: data.bkash.enabled,
            bkash_number: data.bkash.number,
            nagad_enabled: data.nagad.enabled,
            nagad_number: data.nagad.number,
            rocket_enabled: data.rocket.enabled,
            rocket_number: data.rocket.number,
          };
        }
      } else {
        data = null;
      }


      if (data) {
        setMethods(data);
      } else if (localSS) {
        setMethods(localSS);
      } else {
        setMethods({
          bkash_enabled: true, bkash_number: '01700000000',
          nagad_enabled: true, nagad_number: '01800000000',
          rocket_enabled: true, rocket_number: '01900000000',
        });
      }
    } catch {
      setMethods({
        bkash_enabled: true, bkash_number: '01700000000',
        nagad_enabled: true, nagad_number: '01800000000',
        rocket_enabled: true, rocket_number: '01900000000',
      });
    }
  };

  const fetchRequests = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('deposit_requests')
        .select('*')
        .eq('user_id', user.uid)
        .order('created_at', { ascending: false });

      if (error && isTableMissingError(error)) {
        const local = getLocalDeposits()
          .filter((d) => d.user_id === user.uid)
          .map((d: any) => ({
            id: d.id,
            method: d.method,
            senderNumber: d.sender_number || d.senderNumber || '',
            transactionId: d.transaction_id || d.transactionId || '',
            amount: Number(d.amount || 0),
            status: d.status || 'pending',
            createdAt: d.created_at || d.createdAt,
          }));
        setRequests(local);
        return;
      }

      if (data) {
        const reqs: DepositRequest[] = data.map((d: any) => ({
          id: d.id,
          method: d.method,
          senderNumber: d.sender_number || d.senderNumber || '',
          transactionId: d.transaction_id || d.transactionId || '',
          amount: Number(d.amount || 0),
          status: d.status || 'pending',
          createdAt: d.created_at || d.createdAt,
        }));
        setRequests(reqs);
      } else {
        const local = getLocalDeposits()
          .filter((d) => d.user_id === user.uid)
          .map((d: any) => ({
            id: d.id,
            method: d.method,
            senderNumber: d.sender_number || d.senderNumber || '',
            transactionId: d.transaction_id || d.transactionId || '',
            amount: Number(d.amount || 0),
            status: d.status || 'pending',
            createdAt: d.created_at || d.createdAt,
          }));
        setRequests(local);
      }
    } catch {
      const local = getLocalDeposits()
        .filter((d) => d.user_id === user.uid)
        .map((d: any) => ({
          id: d.id,
          method: d.method,
          senderNumber: d.sender_number || d.senderNumber || '',
          transactionId: d.transaction_id || d.transactionId || '',
          amount: Number(d.amount || 0),
          status: d.status || 'pending',
          createdAt: d.created_at || d.createdAt,
        }));
      setRequests(local);
    }
  };

  const fetchUserBalance = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('deposit_balance')
        .eq('id', user.uid)
        .maybeSingle();

      if (!error && data) {
        setCurrentBalance(Number(data.deposit_balance ?? 0));
      } else {
        const localUser = getLocalUser(user.uid);
        if (localUser) {
          setCurrentBalance(Number(localUser.deposit_balance || 0));
        } else if (profile) {
          setCurrentBalance(Number(profile.depositBalance || 0));
        }
      }
    } catch {
      const localUser = getLocalUser(user.uid);
      if (localUser) {
        setCurrentBalance(Number(localUser.deposit_balance || 0));
      } else if (profile) {
        setCurrentBalance(Number(profile.depositBalance || 0));
      }
    }
  };

  useEffect(() => {
    if (!user) return;
    
    fetchUserBalance();
    fetchRequests();
    fetchSettings();

    try {
      const channel = supabase
        .channel(`deposit-page-${user.uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deposit_requests' }, () => {
          fetchRequests();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${user.uid}` }, () => {
          fetchUserBalance();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // Channel fallback
    }
  }, [user, profile]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !senderNumber || !transactionId || !method) {
      alert("Please fill all required fields, including the payment method.");
      return;
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      setIsProcessing(true);
      setSuccess('');
      
      const { error } = await supabase
        .from('deposit_requests')
        .insert({
          user_id: user.uid,
          method,
          sender_number: senderNumber,
          transaction_id: transactionId,
          amount: depositAmount,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (error && isTableMissingError(error)) {
        addLocalDeposit({
          user_id: user.uid,
          method,
          sender_number: senderNumber,
          transaction_id: transactionId,
          amount: depositAmount,
          status: 'pending',
        });
      } else if (error) {
        addLocalDeposit({
          user_id: user.uid,
          method,
          sender_number: senderNumber,
          transaction_id: transactionId,
          amount: depositAmount,
          status: 'pending',
        });
      }

      setAmount('');
      setSenderNumber('');
      setTransactionId('');
      setMethod('');
      setSuccess('Deposit request submitted successfully. Please wait for admin approval.');
      fetchRequests();
    } catch {
      addLocalDeposit({
        user_id: user.uid,
        method,
        sender_number: senderNumber,
        transaction_id: transactionId,
        amount: depositAmount,
        status: 'pending',
      });
      setAmount('');
      setSenderNumber('');
      setTransactionId('');
      setMethod('');
      setSuccess('Deposit request submitted successfully. Please wait for admin approval.');
      fetchRequests();
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'pending': return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30"><Clock className="w-3 h-3 mr-1"/> Pending</span>;
      case 'approved': return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1"/> Approved</span>;
      case 'rejected': return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30"><XCircle className="w-3 h-3 mr-1"/> Rejected</span>;
      default: return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24 sm:pb-28">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Deposit Funds</h1>
        <p className="text-slate-500 dark:text-purple-300/60 text-sm mt-1 font-medium">Add funds to your deposit balance to post jobs and advertisements.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Instructions & Balance */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-purple-600 to-purple-800 dark:from-amber-500 dark:to-amber-700 rounded-3xl p-8 text-white dark:text-slate-950 shadow-md shadow-purple-600/20 dark:shadow-xl dark:shadow-amber-500/10 h-48 flex flex-col justify-between border border-purple-500/30 dark:border-amber-400/30">
            <div className="flex items-center justify-between opacity-90">
              <span className="text-sm font-black tracking-wider uppercase">Deposit Balance</span>
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="text-4xl font-black mb-1">${currentBalance.toFixed(2)}</div>
              <p className="text-purple-100/80 dark:text-slate-900/80 text-xs font-bold">Used for posting missions & banner advertisements</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#130b2c]/80 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl shadow-sm dark:shadow-lg dark:shadow-purple-900/20 p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
              <Info className="w-5 h-5 mr-2 text-purple-600 dark:text-amber-400" />
              How to Deposit
            </h3>
            
            <div className="mb-4 space-y-2">
              <p className="text-sm font-bold text-purple-600 dark:text-amber-400">Available Numbers:</p>
              {methods ? (
                <div className="space-y-2">
                  {methods.bkash_enabled !== false && (
                    <div className="flex justify-between bg-slate-50 dark:bg-purple-900/30 p-2.5 rounded-xl border border-slate-200 dark:border-purple-500/20 text-sm">
                      <span className="font-bold text-slate-700 dark:text-purple-200">bKash:</span>
                      <strong className="text-purple-600 dark:text-amber-400 font-mono">{methods.bkash_number || '01700000000'}</strong>
                    </div>
                  )}
                  {methods.nagad_enabled !== false && (
                    <div className="flex justify-between bg-slate-50 dark:bg-purple-900/30 p-2.5 rounded-xl border border-slate-200 dark:border-purple-500/20 text-sm">
                      <span className="font-bold text-slate-700 dark:text-purple-200">Nagad:</span>
                      <strong className="text-purple-600 dark:text-amber-400 font-mono">{methods.nagad_number || '01800000000'}</strong>
                    </div>
                  )}
                  {methods.rocket_enabled !== false && (
                    <div className="flex justify-between bg-slate-50 dark:bg-purple-900/30 p-2.5 rounded-xl border border-slate-200 dark:border-purple-500/20 text-sm">
                      <span className="font-bold text-slate-700 dark:text-purple-200">Rocket:</span>
                      <strong className="text-purple-600 dark:text-amber-400 font-mono">{methods.rocket_number || '01900000000'}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-purple-300/60">Loading payment numbers...</p>
              )}
            </div>

            <ul className="space-y-4 text-sm text-slate-600 dark:text-purple-200/80 font-bold">
              <li className="flex items-start">
                <span className="w-6 h-6 rounded-full bg-purple-50 dark:bg-amber-400/20 text-purple-600 dark:text-amber-400 flex items-center justify-center font-black text-xs mr-3 shrink-0 border border-purple-200 dark:border-amber-400/30">1</span>
                Send money via any available method above to the respective number.
              </li>
              <li className="flex items-start">
                <span className="w-6 h-6 rounded-full bg-purple-50 dark:bg-amber-400/20 text-purple-600 dark:text-amber-400 flex items-center justify-center font-black text-xs mr-3 shrink-0 border border-purple-200 dark:border-amber-400/30">2</span>
                Copy the Transaction ID (TrxID) from your payment app.
              </li>
              <li className="flex items-start">
                <span className="w-6 h-6 rounded-full bg-purple-50 dark:bg-amber-400/20 text-purple-600 dark:text-amber-400 flex items-center justify-center font-black text-xs mr-3 shrink-0 border border-purple-200 dark:border-amber-400/30">3</span>
                Fill out the form with your sender number, TrxID, and the exact amount sent.
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-[#130b2c]/80 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl shadow-sm dark:shadow-lg dark:shadow-purple-900/20 p-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-purple-600 dark:text-amber-400" />
              Submit Deposit Request
            </h2>
            {success && (
              <div className="mb-6 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl text-sm font-bold border border-emerald-200 dark:border-emerald-500/30 flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" />
                {success}
              </div>
            )}
            
            <form onSubmit={handleDeposit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-purple-200 mb-2">Payment Method <span className="text-red-600 dark:text-red-400">*</span></label>
                <select
                  required
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-[#180d38] border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 focus:border-purple-600 dark:focus:border-amber-400 outline-none transition-all font-bold text-slate-900 dark:text-white"
                >
                  <option value="" disabled>Select a method</option>
                  {methods?.bkash_enabled !== false && <option value="bKash">bKash</option>}
                  {methods?.nagad_enabled !== false && <option value="Nagad">Nagad</option>}
                  {methods?.rocket_enabled !== false && <option value="Rocket">Rocket</option>}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-purple-200 mb-2">Sender Number <span className="text-red-600 dark:text-red-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={senderNumber}
                    onChange={(e) => setSenderNumber(e.target.value)}
                    placeholder="e.g. 01700000000"
                    className="w-full px-4 py-3 bg-white dark:bg-[#180d38] border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 focus:border-purple-600 dark:focus:border-amber-400 outline-none transition-all font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-300/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-purple-200 mb-2">Transaction ID (TrxID) <span className="text-red-600 dark:text-red-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="e.g. 8NX7A23B"
                    className="w-full px-4 py-3 bg-white dark:bg-[#180d38] border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 focus:border-purple-600 dark:focus:border-amber-400 outline-none transition-all font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-300/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-purple-200 mb-2">Amount Sent ($) <span className="text-red-600 dark:text-red-400">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-purple-600 dark:text-amber-400 font-bold">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="10.00"
                    className="w-full pl-8 pr-4 py-3 bg-white dark:bg-[#180d38] border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 focus:border-purple-600 dark:focus:border-amber-400 outline-none transition-all font-black text-slate-900 dark:text-white text-lg placeholder-slate-400 dark:placeholder-purple-300/30"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full flex justify-center items-center px-6 py-4 border border-transparent rounded-xl shadow-md shadow-purple-600/20 dark:shadow-lg dark:shadow-amber-500/20 text-sm font-bold text-white dark:text-slate-950 bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 dark:hover:from-amber-300 dark:hover:to-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-amber-400 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95 disabled:hover:scale-100"
              >
                {isProcessing ? 'Submitting...' : 'Submit Deposit Request'}
              </button>
            </form>
          </div>

          {/* History Section */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
              <History className="w-5 h-5 mr-2 text-purple-600 dark:text-amber-400" />
              Deposit History
            </h2>
            <div className="bg-white dark:bg-[#130b2c]/80 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl shadow-sm dark:shadow-lg dark:shadow-purple-900/20 overflow-hidden">
              {requests.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-purple-300/60 text-sm font-medium">
                  No deposit requests found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-purple-950/40 border-b border-slate-200 dark:border-purple-500/20">
                        <th className="py-3.5 px-6 text-xs font-black text-purple-600 dark:text-amber-400 uppercase">Date</th>
                        <th className="py-3.5 px-6 text-xs font-black text-purple-600 dark:text-amber-400 uppercase">Method</th>
                        <th className="py-3.5 px-6 text-xs font-black text-purple-600 dark:text-amber-400 uppercase">TrxID</th>
                        <th className="py-3.5 px-6 text-xs font-black text-purple-600 dark:text-amber-400 uppercase">Amount</th>
                        <th className="py-3.5 px-6 text-xs font-black text-purple-600 dark:text-amber-400 uppercase text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-purple-900/30">
                      {requests.map(req => (
                        <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-purple-900/20 transition-colors">
                          <td className="py-4 px-6 text-sm text-slate-600 dark:text-purple-200/80 font-bold">
                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-4 px-6 text-sm text-slate-900 dark:text-white font-bold">
                            {req.method || 'Manual'}
                          </td>
                          <td className="py-4 px-6 text-sm text-purple-600 dark:text-amber-400 font-mono font-bold">
                            {req.transactionId}
                          </td>
                          <td className="py-4 px-6 text-sm font-black text-purple-600 dark:text-amber-400">
                            ${req.amount.toFixed(2)}
                          </td>
                          <td className="py-4 px-6 text-right">
                            {renderStatus(req.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
