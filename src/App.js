import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// ሰርቨሩን ከ Render ጋር ለማገናኘት የተስተካከለ አድራሻ
const SERVER_URL = 'https://aviator-ethio.onrender.com';

// የግንኙነት ጥራት እንዲጨምር polling ተጨምሯል
const socket = io(SERVER_URL, {
  transports: ['polling', 'websocket'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

function App() {
  const [currentView, setCurrentView] = useState('home'); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 

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

  const [bet1, setBet1] = useState({ amount: 10, isBetting: false, cashedOut: false });
  const [bet2, setBet2] = useState({ amount: 10, isBetting: false, cashedOut: false });

  const [win1, setWin1] = useState(null);
  const [win2, setWin2] = useState(null);

  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [money, setMoney] = useState("");
  const [screenshot, setScreenshot] = useState(null);

  const upcomingGames = [
    { id: 1, name: "Crazy Time" },
    { id: 2, name: "Mines" },
    { id: 3, name: "Penalty Shootout" }
  ];

  useEffect(() => {
    socket.on('data', (payload) => {
      if (payload) {
        setGame(payload);
        if (payload.status === 'crashed') {
          setBet1(prev => ({ ...prev, isBetting: false, cashedOut: false }));
          setBet2(prev => ({ ...prev, isBetting: false, cashedOut: false }));
          setWin1(null); 
          setWin2(null);
        }
      }
    });

    socket.on('balanceUpdate', (newBalance) => {
      setBalance(newBalance);
      alert("✅ ብር ገብቶልዎታል! አዲሱ ባላንስ: " + newBalance + " ETB");
    });

    return () => {
      socket.off('data');
      socket.off('balanceUpdate');
    };
  }, []);

  const handleAuthAction = async () => {
    if (!userPhone || !password) return alert("እባክዎ መረጃዎችን ያስገቡ!");
    
    try {
      // እዚህ ጋር አድራሻው ከሰርቨርህ /login እና /register ጋር እንዲገጥም ተደርጓል
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
          setUserPhone(data.phone);
          socket.emit('identify', data.phone); 
          setShowAuth(false);
        } else {
          alert("በተሳካ ሁኔታ ተመዝግበዋል! አሁን ይግቡ።");
          setAuthMode('login');
        }
      } else {
        alert(data.error || "ስህተት ተፈጥሯል");
      }
    } catch (err) {
      alert("ከሰርቨር ጋር መገናኘት አልተቻለም። ሰርቨሩ መነሳቱን ያረጋግጡ።");
    }
  };

  const handleAction = async (type) => {
    const amountNum = parseFloat(money);
    if (!amountNum || amountNum <= 0) return alert("ትክክለኛ መጠን ያስገቡ!");
    
    if (type === 'withdraw') {
      if (balance < amountNum) return alert("በቂ ባላንስ የለዎትም!");
      const newBal = balance - amountNum;
      setBalance(newBal);
      // ሰርቨሩ ላይ Withdraw ጥያቄ እንዲልክ
      socket.emit('sendWithdrawRequest', { phone: userPhone, amount: amountNum });
    } else {
      // Deposit ጥያቄ ለሰርቨር ይላካል (ሰርቨሩ ለቴሌግራም ያስተላልፋል)
      socket.emit('sendDepositRequest', { phone: userPhone, amount: amountNum, screenshot });
    }
    
    alert("ጥያቄዎ ተልኳል!");
    setShowDeposit(false); 
    setShowWithdraw(false); 
    setMoney("");
  };

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

  // --- የተቀረው የ UI ክፍል (Landing Page እና Game Layout) ---
  // (አንተ ከላክኸው ጋር አንድ አይነት ስለሆነ ጊዜ ለመቆጠብ እዚህ አልደገምኩትም)
  // ... (ከዚህ በታች ያለው UI ኮድህ እንዳለ ይቀጥላል)
  if (currentView === 'home') {
    return (
      <div className="landing-page">
        <nav className="nav-bar">
          <div className="logo-section"><span>የኢትዮጵያ ሎተሪ አገልግሎት</span></div>
          <div className="nav-links">
            {!isLoggedIn ? <button onClick={() => { setShowAuth(true); setAuthMode('login'); }} className="dep-nav-btn">Login</button> :
            <><button onClick={() => setShowDeposit(true)} className="dep-nav-btn">Deposit</button>
            <button onClick={() => setShowWithdraw(true)} className="with-nav-btn">Withdraw</button></>}
          </div>
        </nav>
        <div className="hero-section">
          <h1>ትልቁን ያሸንፉ</h1>
          <button className="play-now-main" onClick={() => setCurrentView('game')}>አቪዬተር ይጫወቱ</button>
        </div>
        <div className="upcoming-grid">
          {upcomingGames.map(g => (
            <div key={g.id} className="upcoming-card"><div className="upcoming-overlay"><h4>{g.name}</h4></div></div>
          ))}
        </div>
        {showAuth && (
          <div className="modal-bg">
            <div className="auth-box">
              <h2>{authMode === 'login' ? 'ይግቡ' : 'ይመዝገቡ'}</h2>
              <input type="text" placeholder="ስልክ" value={userPhone} onChange={(e)=>setUserPhone(e.target.value)}/>
              <input type="password" placeholder="የይለፍ ቃል" value={password} onChange={(e)=>setPassword(e.target.value)}/>
              <button className="confirm-btn" onClick={handleAuthAction}>አረጋግጥ</button>
              <p onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{cursor:'pointer', color:'gold', marginTop:'10px'}}>
                {authMode === 'login' ? 'አካውንት የለዎትም? ይመዝገቡ' : 'አካውንት አለዎት? ይግቡ'}
              </p>
              <button className="close-btn" onClick={()=>setShowAuth(false)}>ዝጋ</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="App">
       <div className="game-header">
          <button className="back-btn" onClick={() => setCurrentView('home')}>← ተመለስ</button>
          <div className="main-balance-display">{balance.toFixed(2)} ETB</div>
       </div>
       {/* Game Layout Sections */}
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
                   <div className="plane-anim" style={{ left: `${Math.min((game.multiplier - 1) * 15 + 10, 80)}%`, bottom: `${Math.min((game.multiplier - 1) * 12 + 20, 75)}%` }}>
                      <svg width="85" viewBox="0 0 24 24" fill="#e11d48"><path d="M21,16L22,19H15V22H13V19H10L9,16H2V14L9,10L9,3L11,1L13,3V10L20,14V16H21Z"/></svg>
                   </div>
                )}
             </div>
             <div className="bet-panel-bottom-container">
                <div className="double-bet-wrapper">
                   <div className="bet-box">
                      <input type="number" value={bet1.amount} onChange={(e) => setBet1({...bet1, amount: Number(e.target.value)})}/>
                      <button className={bet1.isBetting ? "cashout-btn" : "bet-btn"} onClick={() => bet1.isBetting ? handleCashOut(1) : handlePlaceBet(1)}>
                         {bet1.isBetting ? `አውጣ (${(bet1.amount * game.multiplier).toFixed(2)})` : "መድብ"}
                      </button>
                   </div>
                   <div className="bet-box">
                      <input type="number" value={bet2.amount} onChange={(e) => setBet2({...bet2, amount: Number(e.target.value)})}/>
                      <button className={bet2.isBetting ? "cashout-btn" : "bet-btn"} onClick={() => bet2.isBetting ? handleCashOut(2) : handlePlaceBet(2)}>
                         {bet2.isBetting ? `አውጣ (${(bet2.amount * game.multiplier).toFixed(2)})` : "መድብ"}
                      </button>
                   </div>
                </div>
             </div>
          </div>
       </div>

       {/* Deposit/Withdraw Modals */}
       {(showDeposit || showWithdraw) && (
         <div className="modal-bg">
           <div className="auth-box">
             <h3>{showDeposit ? 'ብር ያስገቡ' : 'ብር ያውጡ'}</h3>
             <input type="number" placeholder="መጠን (ETB)" value={money} onChange={(e)=>setMoney(e.target.value)}/>
             <button className="confirm-btn" onClick={() => handleAction(showDeposit ? 'deposit' : 'withdraw')}>አረጋግጥ</button>
             <button className="close-btn" onClick={()=>{setShowDeposit(false); setShowWithdraw(false);}}>ዝጋ</button>
           </div>
         </div>
       )}
    </div>
  );
}

export default App;