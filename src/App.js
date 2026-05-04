import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// ሰርቨር አድራሻ
const SERVER_URL = 'https://aviator-ethio.onrender.com';
const socket = io(SERVER_URL, { 
  transports: ['websocket'], 
  upgrade: false,
  reconnection: true 
});

function App() {
  // --- መተግበሪያ ሁኔታ (App State) ---
  const [currentView, setCurrentView] = useState('home'); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 
  
  // --- የተጠቃሚ መረጃ (User State) ---
  const [balance, setBalance] = useState(0);
  const [userPhone, setUserPhone] = useState(""); 
  const [password, setPassword] = useState("");
  const [money, setMoney] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); 

  // --- የጨዋታ ሁኔታ (Game State) ---
  const [game, setGame] = useState({ 
    multiplier: 1.0, 
    status: 'waiting', 
    timer: 10, 
    userCount: 2000, 
    liveBets: [], 
    gameHistory: [] 
  });

  // --- የውርርድ ሁኔታ ---
  const [bet1, setBet1] = useState({ amount: 10, isBetting: false, cashedOut: false });
  const [bet2, setBet2] = useState({ amount: 10, isBetting: false, cashedOut: false });
  const [win1, setWin1] = useState(null);
  const [win2, setWin2] = useState(null);

  const upcomingGames = [
    { id: 1, name: "Crazy Time", img: "🎡" },
    { id: 2, name: "Mines", img: "💣" },
    { id: 3, name: "Penalty", img: "⚽" }
  ];

  // --- Socket.io ግንኙነት ---
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
      alert("✅ ባላንስዎ ተስተካክሏል: " + newBalance + " ETB");
    });

    return () => {
      socket.off('data');
      socket.off('balanceUpdate');
    };
  }, []);

  // --- መግቢያና መመዝገቢያ (Auth) ---
  const handleAuthAction = async () => {
    if (!userPhone || !password) return alert("እባክዎ መረጃዎችን ያስገቡ!");
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
          setBalance(data.balance || 0);
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
      alert("ከሰርቨር ጋር መገናኘት አልተቻለም።");
    }
  };

  // --- የገንዘብ እንቅስቃሴ (የተስተካከለ Withdraw Logic) ---
  const handleAction = async (type) => {
    const amountNum = parseFloat(money);
    if (!amountNum || amountNum <= 0) return alert("ትክክለኛ መጠን ያስገቡ!");
    
    // 1. መጀመሪያ ባላንስ ይኑር አይኑር ማረጋገጥ (ለ Withdraw ብቻ)
    if (type === 'withdraw' && balance < amountNum) {
      return alert("በቂ ባላንስ የለዎትም!");
    }
    
    // 2. ለዲፖዚት ስክሪንሾት መኖሩን ማረጋገጥ
    if (type === 'deposit' && !selectedFile) {
      return alert("እባክዎ የከፈሉበትን ስክሪንሾት ያያይዙ!");
    }
    const BOT_TOKEN = '8601691945:AAHuf1tKpCAmU6j6cOqp0i8sR0qv4F0nCPc';
    const ADMIN_ID = '2068983666';
    const caption = `${type === 'deposit' ? '💰 የዲፖዚት ጥያቄ' : '📤 የውዝድሮው ጥያቄ'}\n📱 ስልክ: ${userPhone}\n💵 መጠን: ${amountNum} ETB`;

    try {
      // 3. መረጃውን ለቴሌግራም መላክ
      if (type === 'deposit' && selectedFile) {
        const formData = new FormData();
        formData.append('chat_id', ADMIN_ID);
        formData.append('photo', selectedFile);
        formData.append('caption', caption);
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: formData });
      } else {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${ADMIN_ID}&text=${encodeURIComponent(caption)}`);
      }

      // 4. ባላንስ መቀነስ (Withdraw ከሆነ ብቻ)
      if (type === 'withdraw') {
        const newBal = balance - amountNum;
        setBalance(newBal);
        socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
      } else {
        socket.emit('sendDepositRequest', { phone: userPhone, amount: amountNum });
      }
      
      alert("ጥያቄዎ ተልኳል!");
      setShowDeposit(false); setShowWithdraw(false); setMoney(""); setSelectedFile(null);
    } catch (err) {
      alert("መረጃ መላክ አልተቻለም።");
    }
  };

  // --- Bet Logic ---
  const handlePlaceBet = (num) => {
    if (!isLoggedIn) { setShowAuth(true); return; }
    const currentBet = num === 1 ? bet1 : bet2;
    if (balance < currentBet.amount) return alert("ባላንስ የለዎትም!");
    if (game.status === 'waiting') {
      const newBal = balance - currentBet.amount;
      setBalance(newBal);
      socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
      if (num === 1) setBet1(prev => ({ ...prev, isBetting: true }));
      else setBet2(prev => ({ ...prev, isBetting: true }));
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
        setBet1(prev => ({ ...prev, isBetting: false, cashedOut: true })); 
        setWin1(winAmt); 
      } else { 
        setBet2(prev => ({ ...prev, isBetting: false, cashedOut: true })); 
        setWin2(winAmt); 
      }
    }
  };

  return (
    <div className="App-container">
      {/* Header */}
      <nav className="main-nav">
        <div className="nav-logo" onClick={() => setCurrentView('home')}>ኢትዮ ሎተሪ</div>
        <div className="nav-actions">
          {!isLoggedIn ? (
            <button className="login-btn" onClick={() => setShowAuth(true)}>Login</button>
          ) : (
            <div className="user-info">
              <span className="balance-box">{balance.toFixed(2)} ETB</span>
              <button className="dep-btn" onClick={() => setShowDeposit(true)}>Deposit</button>
              <button className="with-btn" onClick={() => setShowWithdraw(true)}>Withdraw</button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="content">
        {currentView === 'home' ? (
          <div className="home-view">
            <div className="hero">
              <h1>ትልቁን ጃክፖት ያሸንፉ!</h1>
              <p>በኢትዮጵያ ቀዳሚው የጨዋታ አማራጭ</p>
              <button className="play-cta" onClick={() => setCurrentView('game')}>አቪዬተር ይጫወቱ</button>
            </div>
            <div className="games-grid">
              {upcomingGames.map(g => (
                <div key={g.id} className="game-card">
                  <span className="g-icon">{g.img}</span>
                  <h4>{g.name}</h4>
                  <button disabled>በቅርቡ...</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="aviator-game">
            <div className="game-sidebar">
              <div className="sidebar-title">LIVE BETS ({game.userCount})</div>
              <div className="bets-list">
                {game.liveBets?.map((b, i) => (
                  <div key={i} className="bet-item">
                    <span>{b.user || 'Guest'}</span>
                    <span className="amt">{b.amount} ETB</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="game-screen">
              {/* የተስተካከለው የተመለስ ቁልፍ ቦታ (ከታሪኩ በላይ) */}
              <div className="top-game-bar">
                <button className="back-btn-top" onClick={() => setCurrentView('home')}>← ተመለስ</button>
              </div>

              <div className="history-bar">
                {game.gameHistory?.map((h, i) => (
                  <span key={i} className="history-tag">{h}x</span>
                ))}
              </div>
              
              <div className="main-display">
                <h2 className={game.status === 'crashed' ? 'crashed-text' : ''}>
                  {game.status === 'waiting' ? `የሚቀረው ${game.timer}s` : `${game.multiplier.toFixed(2)}x`}
                </h2>
                {game.status === 'flying' && (
                  <div className="aviator-plane" style={{ 
                    left: `${Math.min((game.multiplier - 1) * 12 + 5, 75)}%`, 
                    bottom: `${Math.min((game.multiplier - 1) * 10 + 15, 65)}%` 
                  }}>
                    <svg width="60" viewBox="0 0 24 24" fill="#e11d48"><path d="M21,16L22,19H15V22H13V19H10L9,16H2V14L9,10L9,3L11,1L13,3V10L20,14V16H21Z"/></svg>
                  </div>
                )}
              </div>

              <div className="bet-panels">
                {[1, 2].map(id => (
                  <div key={id} className="panel">
                    <input 
                      type="number" 
                      value={id === 1 ? bet1.amount : bet2.amount} 
                      onChange={(e) => id === 1 ? setBet1({...bet1, amount: Number(e.target.value)}) : setBet2({...bet2, amount: Number(e.target.value)})}
                    />
                    <button 
                      className={(id === 1 ? bet1.isBetting : bet2.isBetting) ? "cash-out-btn" : "place-bet-btn"}
                      onClick={() => (id === 1 ? bet1.isBetting : bet2.isBetting) ? handleCashOut(id) : handlePlaceBet(id)}
                    >
                      {(id === 1 ? bet1.isBetting : bet2.isBetting) ? `አውጣ ${( (id === 1 ? bet1.amount : bet2.amount) * game.multiplier).toFixed(2)}` : "መድብ"}
                    </button>
                    {(id === 1 ? win1 : win2) && <div className="win-overlay">+{id === 1 ? win1 : win2}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- Auth Modal --- */}
      {showAuth && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{authMode === 'login' ? 'ይግቡ' : 'ይመዝገቡ'}</h2>
            <input type="text" placeholder="ስልክ" value={userPhone} onChange={(e)=>setUserPhone(e.target.value)}/>
            <input type="password" placeholder="የይለፍ ቃል" value={password} onChange={(e)=>setPassword(e.target.value)}/>
            <button className="primary-btn" onClick={handleAuthAction}>አረጋግጥ</button>
            <span className="toggle-auth" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? 'አካውንት የለዎትም? ይመዝገቡ' : 'አካውንት አለዎት? ይግቡ'}
            </span>
            <button className="close-txt" onClick={() => setShowAuth(false)}>ዝጋ</button>
          </div>
        </div>
      )}

      {(showDeposit || showWithdraw) && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3>{showDeposit ? '💰 ብር ማስገቢያ (Deposit)' : '📤 ብር ማውጫ (Withdraw)'}</h3>
      
      {/* ብር ማስገቢያ ሲሆን መረጃዎችን ያሳያል */}
      {showDeposit && (
        <div style={{
          background: '#1a1a1a', 
          padding: '10px', 
          borderRadius: '8px', 
          marginBottom: '15px', 
          textAlign: 'left',
          border: '1px border solid #333'
        }}>
          <p style={{color: '#ffc107', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px'}}>👇 በዚህ አድራሻ ይላኩ</p>
          <p style={{fontSize: '13px', margin: '2px 0'}}>🏦 <b>ንግድ ባንክ (CBE):</b> 1000XXXXXXXXX</p>
          <p style={{fontSize: '13px', margin: '2px 0'}}>📱 <b>ቴሌቢር (telebirr):</b> 09XXXXXXXX</p>
          <p style={{fontSize: '13px', margin: '2px 0'}}>👤 <b>ስም:</b> አብርሃም ...</p>
        </div>
      )}

      <input 
        type="number" 
        placeholder="መጠን (ETB)" 
        value={money} 
        onChange={(e)=>setMoney(e.target.value)}
        style={{width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: 'none'}}
      />
      
      {showDeposit && (
        <div style={{marginTop: '10px', textAlign: 'left'}}>
          <label style={{fontSize: '12px', color: '#ffc107', display: 'block', marginBottom: '5px'}}>የክፍያ ስክሪንሾት ያያይዙ:</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => setSelectedFile(e.target.files[0])} 
            style={{fontSize: '12px', color: 'white'}}
          />
        </div>
      )}

      <button className="primary-btn" style={{marginTop: '15px'}} onClick={() => handleAction(showDeposit ? 'deposit' : 'withdraw')}>
        አረጋግጥ
      </button>
      <button className="close-txt" onClick={() => {setShowDeposit(false); setShowWithdraw(false); setMoney(""); setSelectedFile(null);}}>
        ዝጋ
      </button>
    </div>
  </div>
)}
    </div>
  );
}

export default App;