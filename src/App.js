import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const SERVER_URL = 'https://aviator-ethio.onrender.com';
const socket = io(SERVER_URL, { 
  transports: ['websocket', 'polling'], 
  upgrade: true,
  reconnection: true 
});

function App() {
  const [currentView, setCurrentView] = useState('home'); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 
  
  const [balance, setBalance] = useState(0);
  const [userPhone, setUserPhone] = useState(""); 
  const [password, setPassword] = useState("");
  const [money, setMoney] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); 

  // --- ጌም ስቴት (እዚህ ጋር userCount ተጨምሯል) ---
  const [game, setGame] = useState({ 
    multiplier: 1.0, 
    status: 'waiting', 
    timer: 10, 
    userCount: 2500, // Default value
    liveBets: [], 
    gameHistory: [] 
  });

  const [bet1, setBet1] = useState({ amount: 10, isBetting: false, cashedOut: false });
  const [bet2, setBet2] = useState({ amount: 10, isBetting: false, cashedOut: false });
  const [win1, setWin1] = useState(null);
  const [win2, setWin2] = useState(null);

  const upcomingGames = [
    { id: 1, name: "Crazy Time", img: "🎡" },
    { id: 2, name: "Keno", img: "⚽" },
    { id: 3, name: "Penalty", img: "💣" }
  ];

  useEffect(() => {
    socket.on('data', (payload) => {
      // ሰርቨሩ የላከውን ሙሉ ዳታ (userCount እና liveBets ጨምሮ) ይቀበላል
      setGame(payload);

      if (payload.status === 'crashed') {
        setBet1(prev => ({ ...prev, isBetting: false, cashedOut: false }));
        setBet2(prev => ({ ...prev, isBetting: false, cashedOut: false }));
        setWin1(null); 
        setWin2(null);
      }
    });

    socket.on('manual_balance_update', (data) => {
        if(data.phone === userPhone) setBalance(data.balance);
    });

    return () => {
      socket.off('data');
      socket.off('manual_balance_update');
    };
  }, [userPhone]);

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

  const handleAction = async (type) => {
    const amountNum = parseFloat(money);
    if (!amountNum || amountNum <= 0) return alert("ትክክለኛ መጠን ያስገቡ!");
    if (type === 'withdraw' && balance < amountNum) return alert("በቂ ባላንስ የለዎትም!");
    if (type === 'deposit' && !selectedFile) return alert("እባክዎ የከፈሉበትን ስክሪንሾት ያያይዙ!");

    const BOT_TOKEN = '8601691945:AAHuf1tKpCAmU6j6cOqp0i8sR0qv4F0nCPc';
    const ADMIN_ID = '2068983666';
    const caption = `${type === 'deposit' ? '💰 የዲፖዚት ጥያቄ' : '📤 የውዝድሮው ጥያቄ'}\n📱 ስልክ: ${userPhone}\n💵 መጠን: ${amountNum} ETB`;

    try {
      if (type === 'deposit' && selectedFile) {
        const formData = new FormData();
        formData.append('chat_id', ADMIN_ID);
        formData.append('photo', selectedFile);
        formData.append('caption', caption);
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: formData });
      } else {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${ADMIN_ID}&text=${encodeURIComponent(caption)}`);
      }

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

  const handlePlaceBet = (num) => {
    if (!isLoggedIn) return setShowAuth(true);
    const cur = num === 1 ? bet1 : bet2;
    const set = num === 1 ? setBet1 : setBet2;

    if (balance >= cur.amount && game.status === 'waiting' && !cur.isBetting) {
      const newBal = balance - cur.amount;
      setBalance(newBal);
      socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
      socket.emit('placeBet', { phone: userPhone, amount: cur.amount });
      set(prev => ({ ...prev, isBetting: true }));
    }
  };

  const handleCashOut = (num) => {
    const cur = num === 1 ? bet1 : bet2;
    const set = num === 1 ? setBet1 : setBet2;
    const setW = num === 1 ? setWin1 : setWin2;

    if (cur.isBetting && !cur.cashedOut && game.status === 'flying') {
      const winAmt = parseFloat((cur.amount * game.multiplier).toFixed(2));
      const newBal = balance + winAmt;
      setBalance(newBal);
      socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
      set(prev => ({ ...prev, isBetting: false, cashedOut: true })); 
      setW(winAmt);
    }
  };

  return (
    <div className="App-container">
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
              {/* እዚህ ጋር userCount ይታያል */}
              <div className="sidebar-title">LIVE BETS ({game.userCount || 2500})</div>
              <div className="bets-list">
                {game.liveBets && game.liveBets.length > 0 ? (
                  game.liveBets.map((b, i) => (
                    <div key={i} className="bet-item">
                      <span>{b.user}</span>
                      <span className="amt">{b.amount} ETB</span>
                    </div>
                  ))
                ) : (
                  <div className="loading-bets">Loading bets...</div>
                )}
              </div>
            </div>

            <div className="game-screen">
              <div className="top-game-bar">
                <button className="back-btn-top" onClick={() => setCurrentView('home')}>← ተመለስ</button>
              </div>
              <div className="history-bar">
                {game.gameHistory?.map((h, i) => <span key={i} className="history-tag">{h}x</span>)}
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
                {[1, 2].map(id => {
                  const b = id === 1 ? bet1 : bet2;
                  const setB = id === 1 ? setBet1 : setBet2;
                  const w = id === 1 ? win1 : win2;
                  return (
                    <div key={id} className="panel">
                      <input 
                        type="number" 
                        value={b.amount} 
                        disabled={b.isBetting || game.status !== 'waiting'}
                        onChange={(e) => id === 1 ? setBet1({...bet1, amount: Number(e.target.value)}) : setBet2({...bet2, amount: Number(e.target.value)})}
                      />
                      {game.status === 'waiting' || !b.isBetting ? (
                        <button 
                          className="place-bet-btn" 
                          onClick={() => handlePlaceBet(id)}
                          disabled={b.isBetting || game.status !== 'waiting'}
                        >
                          {b.isBetting ? "ተጠባባቂ..." : "መድብ"}
                        </button>
                      ) : (
                        <button 
                          className="cash-out-btn" 
                          onClick={() => handleCashOut(id)}
                          disabled={b.cashedOut || game.status !== 'flying'}
                        >
                          {b.cashedOut ? "ወጥቷል" : `አውጣ ${(b.amount * game.multiplier).toFixed(2)}`}
                        </button>
                      )}
                      {w && <div className="win-overlay">+{w}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

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
            <h3>{showDeposit ? '💰 Deposit' : '📤 Withdraw'}</h3>
            {showDeposit && (
              <div className="bank-info" style={{background: '#1a1a1a', padding: '10px', borderRadius: '8px', marginBottom: '15px', textAlign: 'left'}}>
                <p style={{color: '#ffc107', fontSize: '14px', fontWeight: 'bold'}}>👇 በዚህ አድራሻ ይላኩ</p>
                <p style={{fontSize: '13px', margin: '2px 0'}}>🏦 ንግድ ባንክ (CBE): 1000XXXXXXXXX</p>
                <p style={{fontSize: '13px', margin: '2px 0'}}>📱 telebirr: 0913085190</p>
                <p style={{fontSize: '13px', margin: '2px 0'}}>👤 ስም: mesefen ...</p>
              </div>
            )}
            <input 
              type="number" 
              placeholder="መጠን (ETB)" 
              value={money} 
              onChange={(e)=>setMoney(e.target.value)} 
              style={{width: '100%', padding: '10px', marginBottom: '10px'}}
            />
            {showDeposit && (
              <div style={{marginTop: '10px', textAlign: 'left'}}>
                <label style={{fontSize: '12px', color: '#ffc107', display: 'block', marginBottom: '5px'}}>የክፍያ ስክሪንሾት ያያይዙ:</label>
                <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files[0])} style={{fontSize: '12px', color: 'white'}}/>
              </div>
            )}
            <button className="primary-btn" style={{marginTop: '15px'}} onClick={() => handleAction(showDeposit ? 'deposit' : 'withdraw')}>አረጋግጥ</button>
            <button className="close-txt" onClick={() => {setShowDeposit(false); setShowWithdraw(false); setMoney(""); setSelectedFile(null);}}>ዝጋ</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;