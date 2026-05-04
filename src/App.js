import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const SERVER_URL = 'https://aviator-ethio.onrender.com';
const socket = io(SERVER_URL, { transports: ['polling', 'websocket'] });

function App() {
  const [view, setView] = useState('landing');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [userPhone, setUserPhone] = useState("");
  const [password, setPassword] = useState("");
  const [balance, setBalance] = useState(0);

  // Game state with User Count and History
  const [game, setGame] = useState({
    multiplier: 1.0, 
    status: 'waiting', 
    timer: 10,
    userCount: 1450, // የቀጥታ ተጫዋቾች ቁጥር
    liveBets: [], 
    gameHistory: []
  });

  const [bet1, setBet1] = useState({ amount: 10, isBetting: false });
  const [bet2, setBet2] = useState({ amount: 10, isBetting: false });
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [moneyAmount, setMoneyAmount] = useState("");

  // Level Logic (በተጫዋቹ ባላንስ ላይ ተመስርቶ)
  const getLevel = () => {
    if (balance > 10000) return "PRO GOLD";
    if (balance > 5000) return "SILVER";
    return "BEGINNER";
  };

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
          alert("ምዝገባ ተሳክቷል! አሁን ይግቡ።");
          setAuthMode('login'); 
        }
      } else { alert(data.message); }
    } catch (e) { alert("Server error"); }
  };

  const placeBet = (num) => {
    if (!isLoggedIn) return setShowAuth(true);
    const b = num === 1 ? bet1 : bet2;
    if (balance < b.amount) return alert("በቂ ባላንስ የለዎትም!");
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

  // --- Modal Components ---
  const AuthModal = () => (
    <div className="auth-form">
      <h3>{authMode.toUpperCase()}</h3>
      <input placeholder="ስልክ ቁጥር" onChange={e => setUserPhone(e.target.value)} />
      <input type="password" placeholder="የይለፍ ቃል" onChange={e => setPassword(e.target.value)} />
      <button onClick={handleAuth}>አረጋግጥ</button>
      <p onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{cursor:'pointer', color:'#e11d48'}}>
        {authMode === 'login' ? "አዲስ አካውንት ክፈት" : "ወደ መግቢያ ተመለስ"}
      </p>
    </div>
  );

  // --- Views ---
  if (view === 'landing') {
    return (
      <div className="landing-page">
        <header className="landing-header">
          <div className="logo">AVIATOR ETHIO</div>
          <button className="login-btn" onClick={() => setShowAuth(true)}>Login</button>
        </header>
        <main className="hero">
          <h1>Fly High, Win Big!</h1>
          <p>በሊልሙ ዲዛይን የተዘጋጀ አስተማማኝ መድረክ</p>
          <button className="play-now-btn" onClick={() => setView('game')}>PLAY NOW</button>
        </main>
        <section className="upcoming-games">
          <h3>በቅርቡ የሚመጡ</h3>
          <div className="game-grid">
            <div className="game-card">Gebeta Digital</div>
            <div className="game-card">Penalty Shoot</div>
          </div>
        </section>
        <footer className="main-footer">
          <p>© 2026 Aviator Ethio | Lilmoo Design</p>
        </footer>
        {showAuth && <div className="modal"><div className="modal-content"><AuthModal /><button onClick={()=>setShowAuth(false)}>ዝጋ</button></div></div>}
      </div>
    );
  }

  return (
    <div className="aviator-layout">
      <nav className="top-bar">
        <div className="logo" onClick={() => setView('landing')} style={{cursor:'pointer'}}>AVIATOR</div>
        <div className="user-info">
          <span className="level-tag">{getLevel()}</span>
          {isLoggedIn ? (
            <div className="bal-box">
              <span className="balance">{balance.toFixed(2)} ETB</span>
              <button className="dep-btn" onClick={() => setShowDeposit(true)}>Deposit</button>
              <button className="wit-btn" onClick={() => setShowWithdraw(true)}>Withdraw</button>
            </div>
          ) : <button onClick={() => setShowAuth(true)}>Login</button>}
        </div>
      </nav>

      <div className="game-body">
        <aside className="side-bets">
          <div className="bet-header">
            <span>LIVE BETS</span>
            <span className="count-badge">{game.userCount}</span>
          </div>
          <div className="scroll-bets">
            {game.liveBets.map((b, i) => (
              <div key={i} className="bet-item"><span>{b.user}</span><span>{b.amount}</span></div>
            ))}
          </div>
        </aside>

        <section className="plane-display">
          {game.status === 'flying' && (
            <div className="plane-wrapper" style={{ 
              bottom: `${Math.min(15 + (game.multiplier * 4), 75)}%`, 
              left: `${Math.min(10 + (game.multiplier * 6), 80)}%` 
            }}>
              <img src="https://img.icons8.com/color/96/fighter-jet.png" alt="plane" className="plane-img" />
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

      {(showAuth || showDeposit || showWithdraw) && (
        <div className="modal">
          <div className="modal-content">
            {showAuth && <AuthModal />}
            {showDeposit && <div><h3>Deposit</h3><p>ጥያቄ ወደ አስተዳዳሪ ይላካል...</p></div>}
            {showWithdraw && <div><h3>Withdraw</h3><p>ባላንስ ይፈተሻል...</p></div>}
            <button className="close-btn" onClick={() => {setShowAuth(false); setShowDeposit(false); setShowWithdraw(false);}}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;