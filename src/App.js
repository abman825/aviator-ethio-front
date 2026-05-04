import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const SERVER_URL = 'https://onrender.com';
const socket = io(SERVER_URL, { transports: ['polling', 'websocket'] });

function App() {
  const [view, setView] = useState('landing');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [userPhone, setUserPhone] = useState("");
  const [password, setPassword] = useState("");
  const [balance, setBalance] = useState(0);

  const [game, setGame] = useState({
    multiplier: 1.0, status: 'waiting', timer: 10,
    userCount: 1450, liveBets: [], gameHistory: []
  });

  const [bet1, setBet1] = useState({ amount: 10, isBetting: false });
  const [bet2, setBet2] = useState({ amount: 10, isBetting: false });
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [moneyAmount, setMoneyAmount] = useState("");
  const [screenshot, setScreenshot] = useState(null);

  useEffect(() => {
    socket.on('data', (payload) => {
      setGame(payload);
      if (payload.status === 'crashed') {
        setBet1(prev => ({ ...prev, isBetting: false }));
        setBet2(prev => ({ ...prev, isBetting: false }));
      }
    });
    socket.on('balanceUpdate', (newBalance) => setBalance(newBalance));
    return () => { socket.off('data'); socket.off('balanceUpdate'); };
  }, []);

  const handleAuth = async () => {
    if (!userPhone || !password) return alert("እባክዎ መረጃ ያሟሉ!");
    try {
      const res = await fetch(`${SERVER_URL}/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: userPhone, password })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setIsLoggedIn(true);
        setBalance(data.balance);
        socket.emit('identify', userPhone);
        setShowAuth(false);
        setView('game');
      } else { alert(data.message); }
    } catch (e) { alert("Server error"); }
  };

  const placeBet = (num) => {
    if (!isLoggedIn) return setShowAuth(true);
    const b = num === 1 ? bet1 : bet2;
    if (balance < b.amount) return alert("ባላንስ የለዎትም!");
    if (game.status === 'waiting') {
      const newBal = balance - b.amount;
      setBalance(newBal);
      socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
      num === 1 ? setBet1({ ...bet1, isBetting: true }) : setBet2({ ...bet2, isBetting: true });
    }
  };

  const cashOut = (num) => {
    const b = num === 1 ? bet1 : bet2;
    if (b.isBetting && game.status === 'flying') {
      const win = parseFloat((b.amount * game.multiplier).toFixed(2));
      const newBal = balance + win;
      setBalance(newBal);
      socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
      num === 1 ? setBet1({ ...bet1, isBetting: false }) : setBet2({ ...bet2, isBetting: false });
    }
  };

  // --- Landing View ---
  if (view === 'landing') {
    return (
      <div className="landing-page">
        <header className="landing-header">
          <div className="logo" style={{color: '#e11d48'}}>AVIATOR ETHIO</div>
          <button className="login-btn" onClick={() => setShowAuth(true)}>Login</button>
        </header>

        <main className="hero">
          <h1>Fly High, Win Big!</h1>
          <p>በሊልሙ ዲዛይን የተዘጋጀ አስተማማኝ መድረክ</p>
          <button className="play-now-btn" onClick={() => setView('game')}>PLAY NOW</button>
        </main>

        <section className="upcoming-games">
          <h3>በቅርቡ የሚመጡ (Coming Soon)</h3>
          <div className="game-grid">
            <div className="game-card">Gebeta Digital <br/><small>Coming Soon</small></div>
            <div className="game-card">Penalty Shoot <br/><small>Coming Soon</small></div>
            <div className="game-card">Mines <br/><small>Coming Soon</small></div>
          </div>
        </section>
        <footer className="game-internal-footer">
          <p>© 2026 Aviator Ethio | በሊልሙ ዲዛይን የበለፀገ</p>
      </footer>


        {showAuth && (
          <div className="modal">
            <div className="modal-content auth-card-premium">
              <div className="auth-header">
                 <h3>{authMode === 'login' ? 'መግቢያ' : 'ምዝገባ'}</h3>
              </div>
              <input placeholder="ስልክ ቁጥር" onChange={e => setUserPhone(e.target.value)} />
              <input type="password" placeholder="የይለፍ ቃል" onChange={e => setPassword(e.target.value)} />
              <button className="submit-btn-glow" onClick={handleAuth}>
                {authMode === 'login' ? 'ግባ' : 'ተመዝገብ'}
              </button>
              <p className="auth-toggle" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
                {authMode === 'login' ? "አዲስ አካውንት ክፈት" : "ተመለስ"}
              </p>
              <div className="auth-footer-brand">Powered by Lilmoo Design</div>
              <button className="close-x" onClick={()=>setShowAuth(false)}>X</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Game View with Internal Footer ---
  return (
    <div className="aviator-layout">
      <nav className="top-bar">
        <div className="logo" onClick={() => setView('landing')}>AVIATOR</div>
        <div className="user-area">
          {isLoggedIn ? (
            <div className="bal-box">
              <span className="balance">{balance.toFixed(2)} ETB</span>
              <button className="dep-btn" onClick={() => setShowDeposit(true)}>D</button>
              <button className="wit-btn" onClick={() => setShowWithdraw(true)}>W</button>
            </div>
          ) : <button className="login-btn-small" onClick={() => setShowAuth(true)}>Login</button>}
        </div>
      </nav>

      <div className="game-body">
        <aside className="side-bets">
          <div className="bet-header">LIVE BETS <span>{game.userCount}</span></div>
          <div className="scroll-bets">
            {game.liveBets.map((b, i) => (
              <div key={i} className="bet-item"><span>{b.user.substring(0,4)}***</span><span>{b.amount}</span></div>
            ))}
          </div>
        </aside>

        <section className="plane-display">
          {game.status === 'flying' && (
            <div className="plane-wrapper" style={{ 
              bottom: `${Math.min(15 + (game.multiplier * 4), 75)}%`, 
              left: `${Math.min(10 + (game.multiplier * 6), 80)}%` 
            }}>
              <img src="https://icons8.com" alt="plane" />
            </div>
          )}
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

      <footer className="bet-controls">
        {[1, 2].map(num => (
          <div key={num} className="bet-box">
            <input type="number" value={num === 1 ? bet1.amount : bet2.amount}
              onChange={(e) => num === 1 ? setBet1({...bet1, amount: e.target.value}) : setBet2({...bet2, amount: e.target.value})} />
            {(num === 1 ? bet1.isBetting : bet2.isBetting) ? (
              <button className="cashout-button" onClick={() => cashOut(num)}>
                CASH OUT {((num === 1 ? bet1.amount : bet2.amount) * game.multiplier).toFixed(2)}
              </button>
            ) : (
              <button className="bet-button" disabled={game.status !== 'waiting'} onClick={() => placeBet(num)}>BET</button>
            )}
          </div>
        ))}
      </footer>

      

      {showDeposit && (
        <div className="modal">
          <div className="modal-content">
            <h3>Deposit</h3>
            <p>ንግድ ባንክ: 1000XXXXXXXX</p>
            <input type="number" placeholder="መጠን" onChange={e => setMoneyAmount(e.target.value)} />
            <input type="file" accept="image/*" onChange={e => setScreenshot(e.target.files)} />
            <button className="submit-btn" onClick={() => {alert("ጥያቄው ተልኳል!"); setShowDeposit(false)}}>ያረጋግጡ</button>
            <button onClick={()=>setShowDeposit(false)}>ዝጋ</button>
          </div>
        </div>
      )}

      {showWithdraw && (
        <div className="modal">
          <div className="modal-content">
            <h3>Withdraw</h3>
            <input type="number" placeholder="መጠን" />
            <input type="text" placeholder="አካውንት ቁጥር" />
            <button className="submit-btn" onClick={() => {alert("ጥያቄዎ ተልኳል!"); setShowWithdraw(false)}}>አረጋግጥ</button>
            <button onClick={()=>setShowWithdraw(false)}>ዝጋ</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
