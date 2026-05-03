import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// Render ላይ ያለው የሰርቨርህ አድራሻ
const SERVER_URL = 'https://aviator-ethio.onrender.com';

const socket = io(SERVER_URL, {
  transports: ['polling', 'websocket']
});

function App() {
  // --- States ---
  const [currentView, setCurrentView] = useState('home'); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 
  const [userPhone, setUserPhone] = useState(""); 
  const [password, setPassword] = useState("");
  const [balance, setBalance] = useState(0);

  const [game, setGame] = useState({ 
    multiplier: 1.0, status: 'waiting', timer: 10, 
    userCount: 2000, liveBets: [], gameHistory: [] 
  });

  const [bet1, setBet1] = useState({ amount: 10, isBetting: false, cashedOut: false });
  const [bet2, setBet2] = useState({ amount: 10, isBetting: false, cashedOut: false });
  const [win1, setWin1] = useState(null);
  const [win2, setWin2] = useState(null);

  // Deposit/Withdraw States
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [moneyAmount, setMoneyAmount] = useState("");
  const [screenshot, setScreenshot] = useState(null);

  // --- Effects ---
  useEffect(() => {
    socket.on('data', (payload) => {
      setGame(payload);
      if (payload.status === 'crashed') {
        setBet1(prev => ({ ...prev, isBetting: false, cashedOut: false }));
        setBet2(prev => ({ ...prev, isBetting: false, cashedOut: false }));
        setWin1(null); setWin2(null);
      }
    });

    socket.on('balanceUpdate', (newBalance) => {
      setBalance(newBalance);
    });

    return () => {
      socket.off('data');
      socket.off('balanceUpdate');
    };
  }, []);

  // --- Functions ---
  const handleAuth = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: userPhone, password })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        if (authMode === 'login') {
          setIsLoggedIn(true);
          setBalance(data.balance);
          socket.emit('identify', userPhone);
          setShowAuth(false);
        } else {
          alert("ተመዝግበዋል! አሁን ይግቡ።");
          setAuthMode('login');
        }
      } else { alert(data.error); }
    } catch (e) { alert("የሰርቨር ስህተት!"); }
  };

  const handleDeposit = () => {
    if (!moneyAmount || !screenshot) return alert("እባክዎ መጠን እና ስክሪንሾት ያስገቡ!");
    socket.emit('sendDepositRequest', { 
      phone: userPhone, 
      amount: moneyAmount, 
      screenshot: screenshot 
    });
    alert("የማስገቢያ ጥያቄዎ ለAdmin ተልኳል!");
    setShowDeposit(false);
    setMoneyAmount("");
    setScreenshot(null);
  };

  const handleWithdraw = () => {
    const amt = parseFloat(moneyAmount);
    if (amt > balance) return alert("በቂ ባላንስ የለዎትም!");
    socket.emit('sendWithdrawRequest', { phone: userPhone, amount: amt });
    setBalance(prev => prev - amt);
    alert("የማውጫ ጥያቄዎ ተልኳል!");
    setShowWithdraw(false);
    setMoneyAmount("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => setScreenshot(reader.result);
    if (file) reader.readAsDataURL(file);
  };

  const placeBet = (num) => {
    if (!isLoggedIn) return setShowAuth(true);
    const b = num === 1 ? bet1 : bet2;
    if (balance < b.amount) return alert("ባላንስ የለዎትም!");
    if (game.status === 'waiting') {
      const newBal = balance - b.amount;
      setBalance(newBal);
      socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
      num === 1 ? setBet1({...bet1, isBetting: true}) : setBet2({...bet2, isBetting: true});
    }
  };

  const cashOut = (num) => {
    const b = num === 1 ? bet1 : bet2;
    if (b.isBetting && game.status === 'flying') {
      const win = parseFloat((b.amount * game.multiplier).toFixed(2));
      const newBal = balance + win;
      setBalance(newBal);
      socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
      if (num === 1) { setBet1({...bet1, isBetting: false, cashedOut: true}); setWin1(win); }
      else { setBet2({...bet2, isBetting: false, cashedOut: true}); setWin2(win); }
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo">AVIATOR</div>
        <div className="balance-box">
          {isLoggedIn ? (
            <>
              <span className="balance-amt">{balance.toFixed(2)} ETB</span>
              <button className="dep-btn" onClick={() => setShowDeposit(true)}>Deposit</button>
              <button className="wit-btn" onClick={() => setShowWithdraw(true)}>Withdraw</button>
            </>
          ) : (
            <button className="login-btn" onClick={() => {setShowAuth(true); setAuthMode('login');}}>Login</button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="history-bar">
          {game.gameHistory.map((h, i) => (
            <span key={i} className={`hist-item ${h > 2 ? 'high' : 'low'}`}>{h}x</span>
          ))}
        </div>

        <div className="game-area">
          <div className="multiplier-display">
            {game.status === 'waiting' ? (
              <div className="waiting-timer">NEXT ROUND IN {game.timer}s</div>
            ) : (
              <div className={`multi-text ${game.status === 'crashed' ? 'crashed' : ''}`}>
                {game.multiplier.toFixed(2)}x
              </div>
            )}
          </div>
        </div>

        {/* Bet Controls */}
        <div className="bet-controls">
          {[1, 2].map(num => (
            <div key={num} className="bet-box">
              <input 
                type="number" 
                value={num === 1 ? bet1.amount : bet2.amount} 
                onChange={(e) => num === 1 ? setBet1({...bet1, amount: e.target.value}) : setBet2({...bet2, amount: e.target.value})}
              />
              {(num === 1 ? bet1.isBetting : bet2.isBetting) ? (
                <button className="cashout-btn" onClick={() => cashOut(num)}>
                  CASHOUT {( (num === 1 ? bet1.amount : bet2.amount) * game.multiplier ).toFixed(2)}
                </button>
              ) : (
                <button className="bet-btn" disabled={game.status !== 'waiting'} onClick={() => placeBet(num)}>BET</button>
              )}
              {(num === 1 ? win1 : win2) && <div className="win-msg">YOU WON {num === 1 ? win1 : win2} ETB!</div>}
            </div>
          ))}
        </div>
      </main>

      {/* Modals (Auth, Deposit, Withdraw) */}
      {showAuth && (
        <div className="modal">
          <div className="modal-content">
            <h3>{authMode === 'login' ? 'Login' : 'Register'}</h3>
            <input placeholder="Phone" onChange={e => setUserPhone(e.target.value)} />
            <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
            <button onClick={handleAuth}>Submit</button>
            <p onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? 'Create Account' : 'Back to Login'}
            </p>
          </div>
        </div>
      )}

      {showDeposit && (
        <div className="modal">
          <div className="modal-content">
            <h3>Deposit Money</h3>
            <p>Admin CBE: 1000xxxx (Example)</p>
            <input type="number" placeholder="Amount" onChange={e => setMoneyAmount(e.target.value)} />
            <input type="file" onChange={handleFileChange} />
            <button onClick={handleDeposit}>Send Request</button>
            <button onClick={() => setShowDeposit(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showWithdraw && (
        <div className="modal">
          <div className="modal-content">
            <h3>Withdraw Money</h3>
            <input type="number" placeholder="Amount" onChange={e => setMoneyAmount(e.target.value)} />
            <button onClick={handleWithdraw}>Request Withdraw</button>
            <button onClick={() => setShowWithdraw(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;