import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const SERVER_URL = 'https://aviator-ethio.onrender.com';

const socket = io(SERVER_URL, {
  transports: ['polling', 'websocket']
});

function App() {
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

  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [moneyAmount, setMoneyAmount] = useState("");
  const [screenshot, setScreenshot] = useState(null);

  const [bet1, setBet1] = useState({ amount: 10, isBetting: false });
  const [bet2, setBet2] = useState({ amount: 10, isBetting: false });

  useEffect(() => {
    socket.on('data', (payload) => {
      setGame(payload);
    });

    socket.on('balanceUpdate', (newBalance) => {
      setBalance(newBalance);
    });

    return () => {
      socket.off('data');
      socket.off('balanceUpdate');
    };
  }, []);

  const handleAuth = async () => {
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
  };

  const handleDeposit = () => {
    if (!moneyAmount) return alert("መጠን ያስገቡ");
    socket.emit('sendDepositRequest', { phone: userPhone, amount: moneyAmount, screenshot });
    alert("ጥያቄው ተልኳል");
    setShowDeposit(false);
  };

  const handleWithdraw = () => {
    if (parseFloat(moneyAmount) > balance) return alert("ባላንስ የለም");
    socket.emit('sendWithdrawRequest', { phone: userPhone, amount: moneyAmount });
    setBalance(prev => prev - parseFloat(moneyAmount));
    setShowWithdraw(false);
  };

  return (
    <div className="aviator-app">
      {/* Top Header */}
      <div className="game-header">
        <div className="brand">AVIATOR</div>
        <div className="actions">
          {isLoggedIn ? (
            <div className="balance-wrapper">
              <span className="balance-text">{balance.toFixed(2)} ETB</span>
              <button className="btn-dep" onClick={() => setShowDeposit(true)}>Deposit</button>
              <button className="btn-wit" onClick={() => setShowWithdraw(true)}>Withdraw</button>
            </div>
          ) : (
            <button className="btn-login" onClick={() => setShowAuth(true)}>Login</button>
          )}
        </div>
      </div>

      {/* History */}
      <div className="history-row">
        {game.gameHistory.map((h, i) => (
          <span key={i} className={`hist-tag ${h > 2 ? 'high' : 'low'}`}>{h}x</span>
        ))}
      </div>

      {/* Main Game Display */}
      <div className="game-main">
        <div className="side-panel">
          <div className="panel-title">LIVE BETS ({game.userCount})</div>
          <div className="bets-container">
            {game.liveBets.map((b, i) => (
              <div key={i} className="bet-item">
                <span>{b.user}</span>
                <span>{b.amount} ETB</span>
              </div>
            ))}
          </div>
        </div>

        <div className="display-panel">
          <div className="multiplier-box">
            {game.status === 'waiting' ? (
              <div className="wait-label">NEXT ROUND IN {game.timer}s</div>
            ) : (
              <div className={`multi-value ${game.status === 'crashed' ? 'crashed' : ''}`}>
                {game.multiplier.toFixed(2)}x
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Betting Controls */}
      <div className="bet-footer">
        {[1, 2].map(num => (
          <div key={num} className="bet-control">
            <input type="number" className="bet-input" value={num === 1 ? bet1.amount : bet2.amount} readOnly />
            <button className="bet-action-btn" disabled={game.status !== 'waiting'}>BET</button>
          </div>
        ))}
      </div>

      {/* Modals */}
      {showDeposit && (
        <div className="custom-modal">
          <div className="modal-inner">
            <h3>DEPOSIT</h3>
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
        <div className="custom-modal">
          <div className="modal-inner">
            <h3>{authMode.toUpperCase()}</h3>
            <input placeholder="Phone" onChange={e => setUserPhone(e.target.value)} />
            <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
            <button onClick={handleAuth}>Submit</button>
            <button onClick={() => setShowAuth(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;