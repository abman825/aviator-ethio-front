import React, { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// በ Render ላይ ያለው የሰርቨርህ አድራሻ
const SERVER_URL = 'https://aviator-ethio.onrender.com';

const socket = io(SERVER_URL, {
  transports: ['polling', 'websocket']
});

function App() {
  // --- States ---
  const [currentView, setCurrentView] = useState('game'); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 
  const [userPhone, setUserPhone] = useState(""); 
  const [password, setPassword] = useState("");
  const [balance, setBalance] = useState(0);

  // --- Game Engine States ---
  const [game, setGame] = useState({ 
    multiplier: 1.0, 
    status: 'waiting', 
    timer: 10, 
    userCount: 2500, 
    liveBets: [], 
    gameHistory: [] 
  });

  // --- Betting States ---
  const [bet1, setBet1] = useState({ amount: 10, isBetting: false, cashedOut: false });
  const [bet2, setBet2] = useState({ amount: 10, isBetting: false, cashedOut: false });
  const [win1, setWin1] = useState(null);
  const [win2, setWin2] = useState(null);

  // --- Transaction States ---
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [moneyAmount, setMoneyAmount] = useState("");
  const [screenshot, setScreenshot] = useState(null);

  // --- Socket Integration ---
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

  // --- Auth Functions ---
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
          setAuthMode('login');
        }
      }
    } catch (e) { alert("Server error"); }
  };

  // --- Transactions ---
  const handleDeposit = () => {
    socket.emit('sendDepositRequest', { phone: userPhone, amount: moneyAmount, screenshot });
    alert("የዲፖዚት ጥያቄህ ተልኳል!");
    setShowDeposit(false);
  };

  const handleWithdraw = () => {
    const amt = parseFloat(moneyAmount);
    if (amt > balance) return alert("ባላንስ የለዎትም!");
    socket.emit('sendWithdrawRequest', { phone: userPhone, amount: amt });
    setBalance(prev => prev - amt);
    setShowWithdraw(false);
  };

  // --- Game Actions ---
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
    <div className="aviator-layout">
      {/* Top Bar */}
      <nav className="top-bar">
        <div className="logo">AVIATOR</div>
        <div className="user-area">
          {isLoggedIn ? (
            <div className="bal-box">
              <span className="balance">{balance.toFixed(2)} ETB</span>
              <button className="dep-btn" onClick={() => setShowDeposit(true)}>Deposit</button>
              <button className="wit-btn" onClick={() => setShowWithdraw(true)}>Withdraw</button>
            </div>
          ) : (
            <button className="login-trigger" onClick={() => setShowAuth(true)}>Login</button>
          )}
        </div>
      </nav>

      {/* History Bar */}
      <div className="history-list">
        {game.gameHistory.map((h, i) => (
          <span key={i} className={`hist-tag ${h > 2 ? 'high' : 'low'}`}>{h}x</span>
        ))}
      </div>

      {/* Main Section */}
      <div className="game-body">
        <aside className="side-bets">
          <h3>LIVE BETS ({game.userCount})</h3>
          <div className="scroll-bets">
            {game.liveBets.map((b, i) => (
              <div key={i} className="bet-item">
                <span>{b.user}</span>
                <span>{b.amount} ETB</span>
              </div>
            ))}
          </div>
        </aside>

        <section className="plane-display">
          <div className="multi-container">
            {game.status === 'waiting' ? (
              <div className="timer-msg">NEXT ROUND IN {game.timer}s</div>
            ) : (
              <div className={`multiplier ${game.status === 'crashed' ? 'crashed' : ''}`}>
                {game.multiplier.toFixed(2)}x
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Footer Controls */}
      <footer className="bet-controls">
        {[1, 2].map(num => (
          <div key={num} className="bet-box">
            <div className="input-wrap">
              <input type="number" value={num === 1 ? bet1.amount : bet2.amount} readOnly />
            </div>
            {(num === 1 ? bet1.isBetting : bet2.isBetting) ? (
              <button className="cashout-button" onClick={() => cashOut(num)}>
                CASHOUT {( (num === 1 ? bet1.amount : bet2.amount) * game.multiplier ).toFixed(2)}
              </button>
            ) : (
              <button className="bet-button" disabled={game.status !== 'waiting'} onClick={() => placeBet(num)}>BET</button>
            )}
          </div>
        ))}
      </footer>

      {/* Modals */}
      {showDeposit && (
        <div className="modal">
          <div className="modal-content">
            <h3>DEPOSIT MONEY</h3>
            <input type="number" placeholder="Amount" onChange={e => setMoneyAmount(e.target.value)} />
            <input type="file" onChange={e => {
                const reader = new FileReader();
                reader.onload = () => setScreenshot(reader.result);
                reader.readAsDataURL(e.target.files[0]);
            }} />
            <button onClick={handleDeposit}>Confirm</button>
            <button onClick={() => setShowDeposit(false)}>Close</button>
          </div>
        </div>
      )}
      
      {showAuth && (
        <div className="modal">
          <div className="modal-content">
            <h3>{authMode.toUpperCase()}</h3>
            <input placeholder="Phone" onChange={e => setUserPhone(e.target.value)} />
            <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
            <button onClick={handleAuth}>Submit</button>
            <button onClick={() => setShowAuth(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;