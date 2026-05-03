import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// ⚠️ ሰርቨሩን ከ Render ጋር ለማገናኘት የተስተካከለ አድራሻ
const SERVER_URL = 'https://aviator-ethio.onrender.com';
const socket = io(SERVER_URL);

function App() {
  const [currentView, setCurrentView] = useState('home'); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 

  // --- የጨዋታ ሁኔታ (Game State) ---
  const [game, setGame] = useState({ 
    multiplier: 1.0, 
    status: 'waiting', 
    timer: 10, 
    userCount: 2000, 
    liveBets: [], 
    gameHistory: [] 
  });
  
  const [balance, setBalance] = useState(0);
  const [userPhone, setUserPhone] = useState(""); 
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState(1.1);

  // --- አቪዬተር ውርርድ (Double Bet States) ---
  const [bet1, setBet1] = useState({ amount: 10, isBetting: false, cashedOut: false });
  const [bet2, setBet2] = useState({ amount: 10, isBetting: false, cashedOut: false });

  // --- አሸናፊነት ማሳያ (Win Overlays) ---
  const [win1, setWin1] = useState(null);
  const [win2, setWin2] = useState(null);

  // --- የገንዘብ እንቅስቃሴ (Transaction States) ---
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [money, setMoney] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const adminPhone = "0947493716";

  // --- በቅርብ የሚመጡ ጨዋታዎች ዳታ ---
  const upcomingGames = [
    { id: 1, name: "Crazy Time", img: "https://unsplash.com" },
    { id: 2, name: "Mines", img: "https://unsplash.com" },
    { id: 3, name: "Penalty Shootout", img: "https://unsplash.com" },
    { id: 4, name: "Double Luck", img: "https://unsplash.com" },
    { id: 5, name: "Mega Ball", img: "https://unsplash.com" }
  ];

  // --- Socket.io ግንኙነት ---
  useEffect(() => {
    socket.on('data', (payload) => {
      if (payload) {
        setGame(payload);
        if (payload.status === 'crashed') {
          setBet1(prev => ({ ...prev, isBetting: false, cashedOut: false }));
          setBet2(prev => ({ ...prev, isBetting: false, cashedOut: false }));
          setWin1(null); setWin2(null);
          setLevel(prev => parseFloat((prev + 0.1).toFixed(1)));
        }
      }
    });

    socket.on('balanceUpdate', (newBalance) => {
      setBalance(newBalance);
      alert("✅ ብር ገብቶልዎታል! አዲሱ ባላንስ: " + newBalance + " ETB");
    });

    return () => socket.off();
  }, []);

  // --- Login / Register Logic ---
  const handleAuthAction = async () => {
    if (!userPhone || !password) return alert("እባክዎ መረጃዎችን ያስገቡ!");
    const endpoint = authMode === 'login' ? '/login' : '/register';
    
    try {
      const res = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: userPhone, password })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        if (authMode === 'login') {
          setIsLoggedIn(true);
          setBalance(data.balance);
          setUserPhone(data.phone);
          socket.emit('identify', data.phone); 
          setShowAuth(false);
        } else {
          alert("በተሳካ ሁኔታ ተመዝግበዋል! አሁን ይግቡ።");
          setAuthMode('login');
        }
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("ሰርቨሩ ጋር መገናኘት አልተቻለም!");
    }
  };

  // --- Deposit & Withdraw Logic (Telegram) ---
  const handleAction = (type) => {
    const amountNum = parseFloat(money);
    if (!amountNum || amountNum <= 0) return alert("ትክክለኛ መጠን ያስገቡ!");

    const BOT_TOKEN = '8601691945:AAHuf1tKpCAmU6j6cOqp0i8sR0qv4F0nCPc';
    const ADMIN_ID = '2068983666';

    if (type === 'withdraw') {
      if (balance < amountNum) return alert("በቂ ባላንስ የለዎትም!");
      const newBal = balance - amountNum;
      setBalance(newBal);
      const msg = `📤 የዊዝድሮው ጥያቄ\n📱 ስልክ: ${userPhone}\n💵 መጠን: ${amountNum} ETB`;
      fetch(`https://telegram.org{BOT_TOKEN}/sendMessage?chat_id=${ADMIN_ID}&text=${encodeURIComponent(msg)}`);
      socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
    } else {
      const msg = `💰 የዲፖዚት ጥያቄ\n📱 ስልክ: ${userPhone}\n💵 መጠን: ${amountNum} ETB`;
      fetch(`https://telegram.org{BOT_TOKEN}/sendMessage?chat_id=${ADMIN_ID}&text=${encodeURIComponent(msg)}`);
      socket.emit('sendDepositRequest', { phone: userPhone, amount: amountNum, screenshot });
    }
    alert("ጥያቄዎ ተልኳል!");
    setShowDeposit(false); setShowWithdraw(false); setMoney("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setScreenshot(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // --- Aviator Game Functions ---
  const handlePlaceBet = (num) => {
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

  const handleCashOut = (num) => {
    const currentBet = num === 1 ? bet1 : bet2;
    if (currentBet.isBetting && game.status === 'flying') {
      const winAmt = parseFloat((currentBet.amount * game.multiplier).toFixed(2));
      const newBal = balance + winAmt;
      setBalance(newBal);
      socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
      if (num === 1) { 
        setBet1({ ...bet1, isBetting: false, cashedOut: true }); 
        setWin1(winAmt); 
      } else { 
        setBet2({ ...bet2, isBetting: false, cashedOut: true }); 
        setWin2(winAmt); 
      }
    }
  };

  // --- Home View ---
  if (currentView === 'home') {
    return (
      <div className="landing-page">
        <nav className="nav-bar">
          <div className="logo-section"><span>የኢትዮጵያ ሎተሪ አገልግሎት</span></div>
          <div className="nav-links">
            {!isLoggedIn ? (
              <button onClick={() => setShowAuth(true)} className="dep-nav-btn">Login / Register</button>
            ) : (
              <>
                <button onClick={() => setShowDeposit(true)} className="dep-nav-btn">Deposit</button>
                <button onClick={() => setShowWithdraw(true)} className="with-nav-btn">Withdraw</button>
              </>
            )}
          </div>
        </nav>

        <div className="hero-section">
          <h1>ትልቁን ያሸንፉ</h1>
          <button className="play-now-main" onClick={() => setCurrentView('game')}>አቪዬተር ይጫወቱ</button>
        </div>

        <div className="section-title">በቅርብ የሚመጡ ጨዋታዎች</div>
        <div className="upcoming-grid">
          {upcomingGames.map(g => (
            <div key={g.id} className="upcoming-card">
              <img src={g.img} alt={g.name} />
              <div className="upcoming-overlay"><h4>{g.name}</h4></div>
            </div>
          ))}
        </div>

        <footer className="footer-section">
          <div className="footer-content">
            <div className="footer-info"><h4>ስለ እኛ</h4><p>ይህ ይፋዊ የአቪዬተር ጨዋታ ነው።</p></div>
            <div className="footer-contact"><h4>እርዳታ</h4><p>ስልክ: {adminPhone}</p></div>
          </div>
          <div className="footer-bottom"><p>&copy; 2024 የኢትዮጵያ ሎተሪ አገልግሎት።</p></div>
        </footer>

        {showAuth && (
          <div className="modal-bg">
            <div className="auth-box">
              <h3>{authMode === 'login' ? "Login" : "Register"}</h3>
              <input type="text" placeholder="ስልክ" onChange={(e)=>setUserPhone(e.target.value)}/>
              <input type="password" placeholder="የይለፍ ቃል" onChange={(e)=>setPassword(e.target.value)}/>
              <button className="confirm-btn" onClick={handleAuthAction}>አረጋግጥ</button>
              <p onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{cursor:'pointer', marginTop:'10px', color: '#ffc107'}}>
                {authMode === 'login' ? "አዲስ አካውንት ክፈት" : "አካውንት አለኝ ተመለስ"}
              </p>
              <button className="close-btn" onClick={()=>setShowAuth(false)}>ዝጋ</button>
            </div>
          </div>
        )}

        {(showDeposit || showWithdraw) && (
          <div className="modal-bg">
            <div className="modal-box">
              <h3>{showDeposit ? "Deposit" : "Withdraw"}</h3>
              <input type="number" placeholder="የብር መጠን" value={money} onChange={(e)=>setMoney(e.target.value)}/>
              {showDeposit && <input type="file" accept="image/*" onChange={handleFileChange} />}
              <button className="confirm-btn" onClick={() => handleAction(showDeposit ? 'deposit' : 'withdraw')}>Confirm</button>
              <button className="close-btn" onClick={()=>{setShowDeposit(false); setShowWithdraw(false)}}>Close</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Game View ---
  return (
    <div className="App">
       <div className="game-header">
          <button className="back-btn" onClick={() => setCurrentView('home')}>← ተመለስ</button>
          <div className="main-balance-display">{balance.toFixed(2)} ETB</div>
       </div>

       <div className="game-layout">
          <div className="sidebar">
             <div className="sidebar-header"><h4>LIVE BETS ({game.userCount})</h4></div>
             <div className="bets-container">
                {game.liveBets?.map((b, i) => (
                   <div key={i} className="bet-row"><span>{b.user}</span><span>{b.amount} ETB</span></div>
                ))}
             </div>
          </div>

          <div className="game-main">
             <div className="history-line">
                {game.gameHistory?.map((h, i) => <span key={i} className="h-item">{h}x</span>)}
             </div>
             <div className="display-box">
                <h1 className={game.status === 'crashed' ? 'crashed' : ''}>
                   {game.status === 'waiting' ? `Starting in ${game.timer}s` : `${(game.multiplier || 1.0).toFixed(2)}x`}
                </h1>
                {game.status === 'flying' && (
                   <div className="plane-anim" style={{ 
                      left: `${Math.min((game.multiplier - 1) * 15 + 10, 80)}%`, 
                      bottom: `${Math.min((game.multiplier - 1) * 12 + 20, 75)}%` 
                   }}>
                      <svg width="85" viewBox="0 0 24 24" fill="#e11d48"><path d="M21,16L22,19H15V22H13V19H10L9,16H2V14L9,10L9,3L11,1L13,3V10L20,14V16H21Z"/></svg>
                   </div>
                )}
             </div>

             <div className="bet-panel-bottom-container">
                <div className="lvl-info-tag">ደረጃ: {level}</div>
                <div className="double-bet-wrapper">
                   <div className="bet-box">
                      {win1 && <div className="win-overlay"><span>ተቀብለዋል {win1} ETB</span></div>}
                      <input type="number" value={bet1.amount} onChange={(e) => setBet1({...bet1, amount: Number(e.target.value)})} disabled={bet1.isBetting}/>
                      <button className={bet1.isBetting ? "cashout-btn" : "bet-btn"} onClick={() => bet1.isBetting ? handleCashOut(1) : handlePlaceBet(1)}>
                         {bet1.isBetting ? `አውጣ (${(bet1.amount * game.multiplier).toFixed(2)})` : "መድብ"}
                      </button>
                   </div>
                   <div className="bet-box">
                      {win2 && <div className="win-overlay"><span>ተቀብለዋል {win2} ETB</span></div>}
                      <input type="number" value={bet2.amount} onChange={(e) => setBet2({...bet2, amount: Number(e.target.value)})} disabled={bet2.isBetting}/>
                      <button className={bet2.isBetting ? "cashout-btn" : "bet-btn"} onClick={() => bet2.isBetting ? handleCashOut(2) : handlePlaceBet(2)}>
                         {bet2.isBetting ? `አውጣ (${(bet2.amount * game.multiplier).toFixed(2)})` : "መድብ"}
                      </button>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
}

export default App;
