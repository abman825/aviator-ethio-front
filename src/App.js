import React, { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const SERVER_URL = 'https://aviator-ethio.onrender.com';

const socket = io(SERVER_URL, {
  transports: ['polling', 'websocket'],
  reconnectionAttempts: 5
});

function App() {
  // --- Basic States ---
  const [currentView, setCurrentView] = useState('home'); 
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
        setWin1(null);
        setWin2(null);
      }
    });

    socket.on('balanceUpdate', (newBalance) => {
      setBalance(newBalance);
      alert("💰 ባላንስህ ተስተካክሏል! አዲሱ ባላንስ: " + newBalance + " ETB");
    });

    return () => {
      socket.off('data');
      socket.off('balanceUpdate');
    };
  }, []);

  // --- Auth Functions ---
  const handleAuthAction = async () => {
    if (!userPhone || !password) return alert("እባክዎ መረጃ ያስገቡ!");
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
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("ሰርቨር አልተገኘም!");
    }
  };

  // --- Transaction Functions ---
  const handleDepositSubmit = () => {
    if (!moneyAmount) return alert("እባክዎ መጠን ያስገቡ!");
    socket.emit('sendDepositRequest', { 
      phone: userPhone, 
      amount: moneyAmount, 
      screenshot: screenshot 
    });
    alert("ጥያቄህ ለAdmin ተልኳል!");
    setShowDeposit(false);
    setMoneyAmount("");
    setScreenshot(null);
  };

  const handleWithdrawSubmit = () => {
    const amt = parseFloat(moneyAmount);
    if (amt > balance) return alert("በቂ ባላንስ የለዎትም!");
    socket.emit('sendWithdrawRequest', { phone: userPhone, amount: amt });
    setBalance(prev => prev - amt);
    alert("የማውጫ ጥያቄ ተልኳል!");
    setShowWithdraw(false);
    setMoneyAmount("");
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => setScreenshot(reader.result);
    if (file) reader.readAsDataURL(file);
  };

  // --- Game Actions ---
  const placeBet = (num) => {
    if (!isLoggedIn) { setShowAuth(true); return; }
    const currentBet = num === 1 ? bet1 : bet2;
    if (balance < currentBet.amount) return alert("ባላንስ የለዎትም!");
    
    if (game.status === 'waiting') {
      const newBal = balance - currentBet.amount;
      setBalance(newBal);
      socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
      if (num === 1) setBet1({ ...bet1, isBetting: true });
      else setBet2({ ...bet2, isBetting: true });
    }
  };

  const cashOut = (num) => {
    const currentBet = num === 1 ? bet1 : bet2;
    if (currentBet.isBetting && game.status === 'flying') {
      const winAmt = parseFloat((currentBet.amount * game.multiplier).toFixed(2));
      const newBal = balance + winAmt;
      setBalance(newBal);
      socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
      if (num === 1) { setBet1({ ...bet1, isBetting: false, cashedOut: true }); setWin1(winAmt); }
      else { setBet2({ ...bet2, isBetting: false, cashedOut: true }); setWin2(winAmt); }
    }
  };

  // --- Views ---
  const renderHome = () => (
    <div className="home-view">
      <div className="hero-section">
        <h1>ETHIO AVIATOR</h1>
        <button className="play-now-btn" onClick={() => setCurrentView('game')}>PLAY NOW</button>
      </div>
      <div className="upcoming-games">
        <h3>Other Games</h3>
        <div className="game-grid">
          <div className="game-card">Crazy Time</div>
          <div className="game-card">Mines</div>
          <div className="game-card">Penalty</div>
        </div>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="game-container">
      {/* Top Bar */}
      <div className="top-nav">
        <button onClick={() => setCurrentView('home')}>← Back</button>
        <div className="user-stats">
          {isLoggedIn ? (
            <div className="balance-info">
              <span className="amt">{balance.toFixed(2)} ETB</span>
              <button className="dep-btn" onClick={() => setShowDeposit(true)}>+</button>
            </div>
          ) : (
            <button className="login-trigger" onClick={() => setShowAuth(true)}>Login</button>
          )}
        </div>
      </div>

      {/* History Bar */}
      <div className="history-strip">
        {game.gameHistory.map((h, i) => (
          <span key={i} className={`h-badge ${h > 2 ? 'high' : 'low'}`}>{h}x</span>
        ))}
      </div>

      {/* Main Game Screen */}
      <div className="main-board">
        <div className="stats-panel">
          <h4>LIVE BETS ({game.userCount})</h4>
          <div className="bets-list">
            {game.liveBets.map((b, i) => (
              <div key={i} className="bet-row">
                <span>{b.user}</span>
                <span>{b.amount} ETB</span>
              </div>
            ))}
          </div>
        </div>

        <div className="animation-area">
          <div className="multiplier-wrap">
            {game.status === 'waiting' ? (
              <div className="wait-msg">NEXT ROUND IN {game.timer}s</div>
            ) : (
              <div className={`multi-val ${game.status === 'crashed' ? 'crashed' : ''}`}>
                {game.multiplier.toFixed(2)}x
              </div>
            )}
          </div>
          {game.status === 'flying' && <div className="plane-icon">✈</div>}
        </div>
      </div>

      {/* Bet Controls */}
      <div className="controls-footer">
        {[1, 2].map(num => (
          <div key={num} className="control-unit">
            <div className="input-row">
              <button onClick={() => {
                const b = num === 1 ? bet1 : bet2;
                num === 1 ? setBet1({...b, amount: Math.max(10, b.amount-10)}) : setBet2({...b, amount: Math.max(10, b.amount-10)});
              }}>-</button>
              <input type="number" value={num === 1 ? bet1.amount : bet2.amount} readOnly />
              <button onClick={() => {
                const b = num === 1 ? bet1 : bet2;
                num === 1 ? setBet1({...b, amount: b.amount+10}) : setBet2({...b, amount: b.amount+10});
              }}>+</button>
            </div>
            {(num === 1 ? bet1.isBetting : bet2.isBetting) ? (
              <button className="cash-btn" onClick={() => cashOut(num)}>
                CASHOUT <br/> {((num === 1 ? bet1.amount : bet2.amount) * game.multiplier).toFixed(2)}
              </button>
            ) : (
              <button className="place-btn" disabled={game.status !== 'waiting'} onClick={() => placeBet(num)}>
                BET <br/> {num === 1 ? bet1.amount : bet2.amount}
              </button>
            )}
            {(num === 1 ? win1 : win2) && <div className="win-popup">+{num === 1 ? win1 : win2}</div>}
          </div>
        ))}
      </div>

      {/* Modals */}
      {showDeposit && (
        <div className="modal-overlay">
          <div className="modal-body">
            <h3>DEPOSIT</h3>
            <p>CBE: 100023456789 (Aviator Admin)</p>
            <input type="number" placeholder="Amount" value={moneyAmount} onChange={e => setMoneyAmount(e.target.value)} />
            <input type="file" onChange={onFileChange} />
            <div className="m-btns">
              <button onClick={handleDepositSubmit}>CONFIRM</button>
              <button onClick={() => setShowDeposit(false)}>CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {showWithdraw && (
        <div className="modal-overlay">
          <div className="modal-body">
            <h3>WITHDRAW</h3>
            <input type="number" placeholder="Amount" value={moneyAmount} onChange={e => setMoneyAmount(e.target.value)} />
            <div className="m-btns">
              <button onClick={handleWithdrawSubmit}>REQUEST</button>
              <button onClick={() => setShowWithdraw(false)}>CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {showAuth && (
        <div className="modal-overlay">
          <div className="modal-body auth">
            <h3>{authMode.toUpperCase()}</h3>
            <input placeholder="Phone" onChange={e => setUserPhone(e.target.value)} />
            <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
            <button onClick={handleAuthAction}>SUBMIT</button>
            <p onClick={() => setAuthMode(authMode==='login'?'register':'login')}>
              {authMode==='login' ? "Create Account" : "Back to Login"}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="App">
      {currentView === 'home' ? renderHome() : renderGame()}
    </div>
  );
}

export default App;