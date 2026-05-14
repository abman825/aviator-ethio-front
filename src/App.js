import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const SERVER_URL = 'https://aviator-ethio.onrender.com';
const socket = io(SERVER_URL, { 
  transports: ['websocket', 'polling'], 
  upgrade: true,
  reconnection: true 
});

// Security Note: Move these to your backend or server environment variables (.env) on production
const TELEGRAM_BOT_TOKEN = '8601691945:AAHuf1tKpCAmU6j6cOqp0i8sR0qv4F0nCPc';
const TELEGRAM_ADMIN_ID = '2068983666';


// ⚠️ የድሮውን አጥፍተው ይህንን ከ function App() { በላይ ይለጥፉት!
const kenoPayoutTable = {
  1: [1, 3.8],                                      // 0Hits=0x, 1Hit=3.8x
  2: [0, 1, 10],                                    // 2Hits=10x
  3: [0, 0, 2, 50],                                 // 2Hits=2x, 3Hits=50x
  4: [0, 0, 1, 5, 80],                              // 2Hits=1x, 3Hits=5x, 4Hits=80x
  5: [0, 0, 0, 4, 40, 150],                         // 3Hits=4x, 4Hits=40x, 5Hits=150x
  6: [0, 0, 0, 0, 10, 50, 500],                     // 4Hits=10x, 5Hits=50x, 6Hits=500x
  7: [0, 0, 0, 0, 0, 30, 200, 1000],                // 5Hits=30x, 6Hits=200x, 7Hits=1000x
  8: [0, 0, 0, 0, 0, 0, 80, 400, 2000],             // 6Hits=80x, 7Hits=400x, 8Hits=2000x
  9: [0, 0, 0, 0, 0, 0, 0, 150, 800, 5000],         // 7Hits=150x, 8Hits=800x, 9Hits=5000x
  10: [0, 0, 0, 0, 0, 0, 0, 0, 500, 2500, 10000]    // 8Hits=500x, 9Hits=2500x, 10Hits=10000x
};


function App() {
  // --- 1. COMMON STATES ---
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

  // --- 2. KENO STATES ---
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [betAmountKeno, setBetAmountKeno] = useState(10);
  const [drawnNumbers, setDrawnNumbers] = useState([]); 
  const [isDrawingKeno, setIsDrawingKeno] = useState(false);
  const [kenoTimeLeft, setKenoTimeLeft] = useState(30);
  const [currentBall, setCurrentBall] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); 
  const [gameId, setGameId] = useState(20000);
  const [myTickets, setMyTickets] = useState([]);
  const [fakePlayers, setFakePlayers] = useState([]);
  const [kenoHistory, setKenoHistory] = useState([]); // ያለፉትን 10 ዙሮች የ20 ቁጥሮች ታሪክ ለመያዝ
const [permanentTicketHistory, setPermanentTicketHistory] = useState([]); // የቆረጧቸውን 20 ቲኬቶች በቋሚነት የሚይዝ
  

  // --- 3. AVIATOR STATES ---
  const [game, setGame] = useState({ 
    multiplier: 1.0, status: 'waiting', timer: 10, userCount: 2500, liveBets: [], gameHistory: [] 
  });
  const [bet1, setBet1] = useState({ amount: 10, isBetting: false, cashedOut: false });
  const [bet2, setBet2] = useState({ amount: 10, isBetting: false, cashedOut: false });
  const [win1, setWin1] = useState(null);
  const [win2, setWin2] = useState(null);

  const upcomingGames = [
    { id: 2, name: 'Spin & Win', img: '🎰' },
    { id: 3, name: 'Virtual Football', img: '⚽' }
  ];

       // --- 4. FAKE PLAYERS GENERATION ---
  useEffect(() => {
    // የመነሻ ስሞች ዝርዝር
    const baseNames = ["a***n", "b***u", "m***k", "r***t", "s***i", "w***v", "z***y", "l***d", "k***x", "e***s"];
    const totalPlayers = 40; // የሰው ብዛት ወደ 40 ከፍ ተደርጓል

    const newData = Array.from({ length: totalPlayers }, (_, index) => {
      // ከ 1000 እስከ 50 ብር ድረስ በእኩል ደረጃ ቀንሶ የመነሻ መስመር ይፈጥራል
      const rawBet = 1000 - (index * (950 / (totalPlayers - 1)));
      
      // 🎯 ዋናው ማሻሻያ፡ ቁጥሮቹ የተደበላለቁና መጨረሻቸው በ 0 ወይም በ 5 እንዲያልቁ ማድረግ (የዘፈቀደ ልዩነት መፍጠሪያ)
      // ይህ ቀመር 220, 185, 130... እያለ የተፈጥሮ እውነተኛ ውርርድ ያስመስለዋል
      const randomOffset = (Math.floor(Math.random() * 7) - 3) * 5; // -15, -10, -5, 0, 5, 10, 15
      let betAmount = Math.round((rawBet + randomOffset) / 5) * 5;
      
      // ውርርዱ ከ 1000 ብር እንዳይበልጥ እና ከ 50 ብር እንዳያንስ መቆጣጠሪያ
      if (betAmount > 1000) betAmount = 1000;
      if (betAmount < 50) betAmount = 50;
      
      // ለእያንዳንዱ 40 ሰው የተለየ ስም እንዲኖረው ከስሙ ቀጥሎ ቁጥር መጨመሪያ
      const baseName = baseNames[index % baseNames.length];
      const randomNumber = Math.floor(Math.random() * 89) + 10; // ከ 10 እስከ 99
      const uniqueName = `${baseName.replace('***', '')}***${randomNumber}`;
      
      return {
        name: uniqueName,
        nums: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => Math.floor(Math.random() * 80) + 1),
        bet: betAmount, // መጨረሻቸው በ 0 ወይም በ 5 የሚያልቁ የተደበላለቁ ቁጥሮች (ለምሳሌ፡ 420, 255, 130...)
        status: "በመጫወት ላይ",
        win: 0,
        gameId: gameId
      };
    });

    // ከትልቅ ወደ ትንሽ በውርርድ መጠን ደርድሮ ያስቀምጣል
    setFakePlayers(newData.sort((a, b) => b.bet - a.bet));
  }, [gameId]);

  // --- 5. KENO TIMER LOGIC ---
  useEffect(() => {
    if (currentView === 'keno' && kenoTimeLeft > 0 && !isDrawingKeno) {
      const timer = setTimeout(() => setKenoTimeLeft(kenoTimeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (kenoTimeLeft === 0 && !isDrawingKeno && currentView === 'keno') {
      startKenoDraw();
    }
  }, [kenoTimeLeft, isDrawingKeno, currentView]);

  // --- 6. SOCKET CONNECTION ---
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

    socket.on('manual_balance_update', (data) => {
        if(data.phone === userPhone) setBalance(data.balance);
    });

    return () => {
      socket.off('data');
      socket.off('manual_balance_update');
    };
  }, [userPhone]);

      // --- 7. KENO DRAW ENGINE ---
  const startKenoDraw = () => {
    setIsDrawingKeno(true);
    setDrawnNumbers([]); 
    let balls = [];
    
    // የ scope ችግር እንዳይፈጠር የአሁኑን የዙር ቁጥር እዚህ ቋሚ እናደርጋለን
    const currentRoundId = gameId; 
    
    const interval = setInterval(() => {
      let r = Math.floor(Math.random() * 80) + 1;
      if (!balls.includes(r)) {
        balls.push(r);
        setCurrentBall(r); 
        setDrawnNumbers(prev => [...prev, r]);
      }
      
      if (balls.length === 20) { 
        clearInterval(interval);
        
        let totalRoundWinnings = 0; // በዚህ ዙር የቆረጧቸው ቲኬቶች ጠቅላላ ያሸነፉት ብር ማጠራቀሚያ

        // 🎯 የዚህን ዙር ውጤት በታሪክ ቲኬቶች ላይ በቋሚነት የመቆለፍያ ማስተካከያ
        setPermanentTicketHistory(prev => {
          const updatedHistory = prev.map(ticket => {
            if (Number(ticket.gameId) === Number(currentRoundId) && !ticket.isCalculated) {
              const hits = ticket.numbers.filter(n => balls.includes(n)).length;
              const selectionCount = ticket.numbers.length;
              const multipliers = kenoPayoutTable[selectionCount] || [];
              const winMultiplier = multipliers[hits] || 0;
              const finalWin = ticket.amount * winMultiplier;

              // ያሸነፉት ብር ካለ ወደ ጠቅላላ የዙሩ አሸናፊነት ይደመራል
              totalRoundWinnings += finalWin;

              return {
                ...ticket,
                drawnAtThatTime: [...balls], 
                winAmount: finalWin,         
                isCalculated: true
              };
            }
            return ticket;
          });

          // 💰 ማሸነፍዎን ካረጋገጠ የፊት ለፊት ሂሳብዎን (Balance) እና ዳታቤዝዎን በራሱ ሰር ያዘምናል
          if (totalRoundWinnings > 0) {
            setBalance(prevBalance => {
              const updatedBalance = prevBalance + totalRoundWinnings;
              
              // አዲሱን ባላንስ ወደ ሰርቨር እና ዳታቤዝ በሶኬት ይልካል
              socket.emit('updateServerBalance', { 
                phone: userPhone, 
                newBalance: updatedBalance 
              });
              
              return updatedBalance;
            });
          }

          return updatedHistory;
        });

        // ለጠቅላላ የውጤት ሰሌዳው ማስቀመጫ
        setKenoHistory(prev => [{ gameId: currentRoundId, numbers: balls }, ...prev].slice(0, 20));

        setTimeout(() => {
          setIsDrawingKeno(false);
          setDrawnNumbers([]);
          setMyTickets([]); 
          setSelectedNumbers([]);
          setCurrentBall(null);
          setKenoTimeLeft(30); 
          setGameId(prev => prev + 1);
        }, 5000);
      }
    }, 800); 
  };

  // --- 8. TRANSACTION & AUTH ACTIONS ---
  const handleAuthAction = async () => {
    if (!userPhone || !password) return alert("እባክዎ መረጃውን በትክክል ያስገቡ!");
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
          alert("በተሳካ ሁኔታ ተመዝግበዋል! አሁን ይግቡ");
          setAuthMode('login');
        }
      } else {
        alert(data.error || "ስህተት ተከስቷል");
      }
    } catch (err) {
      alert("ከአገልጋይ ጋር መገናኘት አልተቻለም");
    }
  };

  const handleAction = async (type) => {
    const amountNum = parseFloat(money);
    if (!amountNum || amountNum <= 0) return alert("ትክክለኛ መጠን ያስገቡ!");
    
    // 1. በቂ ቀሪ ሂሳብ (Balance) ከሌለው ጥያቄውን እዚህ ያቆመዋል
    if (type === 'withdraw' && balance < amountNum) {
      return alert("በቂ ቀሪ ሂሳብ የለዎትም!");
    }
    
    if (type === 'deposit' && !selectedFile) return alert("እባክዎ የከፈሉበትን ስክሪንሾት ያያይዙ!");

    const caption = `${type === 'deposit' ? '💰 የዴፖዚት ጥያቄ' : '📤 የዊዝድሮው ጥያቄ'}\n📱 ስልክ: ${userPhone}\n💵 መጠን: ${amountNum} ETB`;

    // 2. ዊዝድሮው ከሆነ ጥያቄው ከመላኩ በፊት ሂሳቡን ከፊት ለፊት ገጽ ላይ ወዲያውኑ ይቀንሳል
    let temporaryPreviousBalance = balance; 
    if (type === 'withdraw') {
      const newBal = balance - amountNum;
      setBalance(newBal);
      // ሰርቨሩ እና ዳታቤዙ ባላንሱን ወዲያውኑ እንዲቀንሱት በሶኬት ያዝዛል
      socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
    }

    // ✅ የጎደሉት የ URL እና የ Variable ምልክቶች ተስተካክለዋል
    let url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    let body;
    let headers = {};

    if (type === 'deposit' && selectedFile) {
      url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
      body = new FormData();
      body.append('chat_id', TELEGRAM_ADMIN_ID);
      body.append('photo', selectedFile);
      body.append('caption', caption);
      // FormData ሲሆን Content-Type Headers አያስፈልገውም (ብሮውዘሩ ራሱ ያስተካክላል)
    } else {
      headers = { 'Content-Type': 'application/json' };
      body = JSON.stringify({
        chat_id: TELEGRAM_ADMIN_ID,
        text: caption
      });
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: body
      });

      const responseData = await res.json();

      if (responseData.ok) {
        alert("ጥያቄዎ በተሳካ ሁኔታ ተልኳል! በአስተዳዳሪው እስኪረጋገጥ ድረስ ይጠብቁ።");
        setMoney("");
        setSelectedFile(null);
        setShowDeposit(false);
        setShowWithdraw(false);
      } else {
        // የቴሌግራም መልዕክቱ ካልተላከ የተቀነሰውን ብር መልሶ ይሰጠዋል
        if (type === 'withdraw') {
          setBalance(temporaryPreviousBalance);
          socket.emit('updateServerBalance', { phone: userPhone, newBalance: temporaryPreviousBalance });
        }
        alert("ጥያቄውን መላክ አልተቻለም። Bot Token ወይም Admin ID ትክክል መሆኑን ያረጋግጡ።");
      }
    } catch (err) {
      // የኔትወርክ ስህተት ካጋጠመ የተቀነሰውን ብር መልሶ ያስተካክላል
      if (type === 'withdraw') {
        setBalance(temporaryPreviousBalance);
        socket.emit('updateServerBalance', { phone: userPhone, newBalance: temporaryPreviousBalance });
      }
      alert("ከቴሌግራም አገልጋይ ጋር መገናኘት አልተቻለም። ኔትወርክዎን ያረጋግጡ!");
    }
  };
  // --- 9. BETTING LOGIC MECHANICS ---
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

      const placeKenoBet = () => {
    if (!isLoggedIn) return setShowAuth(true);
    if (balance < betAmountKeno) return alert("በቂ ቀሪ ሂሳብ የለዎትም!");
    if (selectedNumbers.length === 0) return alert("እባክዎ ቁጥሮችን ይምረጡ!");

    const newTicket = {
      id: Math.floor(Math.random() * 1000000),
      numbers: [...selectedNumbers],
      amount: betAmountKeno,
      time: new Date().toLocaleTimeString(),
      gameId: gameId,
      drawnAtThatTime: [], 
      winAmount: 0,        
      isCalculated: false  
    };

    const newBal = balance - betAmountKeno;
    setBalance(newBal);
    socket.emit('updateServerBalance', { phone: userPhone, newBalance: newBal });
    
    setMyTickets(prev => [newTicket, ...prev]); 
    setPermanentTicketHistory(prev => [newTicket, ...prev].slice(0, 20));

    // 🎯 ማሻሻያ፡ ቲኬቱ በተሳካ ሁኔታ ከተቆረጠ በኋላ የመጫወቻ ሰሌዳውን ወዲያውኑ ያጸዳል
    setSelectedNumbers([]); 

    
  };


  return (
    <div className="App-container">
            {/* GLOBAL NAVBAR */}
      <nav className="main-nav">
        <div className="nav-logo" onClick={() => setCurrentView('home')}>ኢትዮ ሎተሪ</div>
        <div className="nav-actions">
          {isLoggedIn && <span className="balance-box">{balance.toFixed(2)} ETB</span>}
          {!isLoggedIn ? (
            <>
              {/* Added Register button directly next to Login */}
              <button 
                className="login-btn" 
                onClick={() => { setAuthMode('login'); setShowAuth(true); }}
              >
                Login
              </button>
              <button 
                className="register-nav-btn" 
                onClick={() => { setAuthMode('register'); setShowAuth(true); }}
              >
                Register
              </button>
            </>
          ) : (
            <>
              <button className="dep-btn" onClick={() => setShowDeposit(true)}>Deposit</button>
              <button className="with-btn" onClick={() => setShowWithdraw(true)}>Withdraw</button>
            </>
          )}
        </div>
      </nav>


      {/* RENDER SYSTEM */}
      <main className="content">
        
        {/* --- A. HOME SYSTEM VIEW --- */}
{currentView === 'home' && (
  <div className="home-view">
    <div className="hero">
      <h1>ትልቅ ዕድል እና ስጦታዎችን ያሸንፉ!</h1>
      <div className="home-buttons">
        <button className="play-cta" onClick={() => setCurrentView('game')}>አቪያተር ይጫወቱ</button>
        <button className="play-cta keno-btn" onClick={() => setCurrentView('keno')}>ኬኖ (Keno)</button>
      </div>
    </div>

    {/* የጌሞች ዝርዝር */}
    <div className="games-grid">
      
      {/* 1. አቪዬተር ካርድ */}
      <div className="game-card aviator-card" onClick={() => setCurrentView('game')}>
        <div className="game-card-overlay">
          <h3>አቪዬተር (Aviator)</h3>
          <button className="play-btn-small">አሁኑኑ ይጫወቱ</button>
        </div>
      </div>

      {/* 2. ኬኖ ካርድ */}
      <div className="game-card keno-card" onClick={() => setCurrentView('keno')}>
        <div className="game-card-overlay">
          <h3>ኬኖ (Keno)</h3>
          <button className="play-btn-small">አሁኑኑ ይጫወቱ</button>
        </div>
      </div>

      {/* 3. ሌሎች ወደፊት የሚመጡ ጌሞች (Spin & Win, Football) */}
      {upcomingGames.map(g => (
        <div key={g.id} className="game-card disabled-card">
          <div className="game-card-overlay">
            <span className="g-icon">{g.img}</span>
            <h4>{g.name}</h4>
            <span className="coming-soon">በቅርቡ...</span>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

        {/* --- B. KENO VIEW LAYOUT --- */}
        {currentView === 'keno' && (
          <div className="keno-view-layout">
            <div className="sidebar-keno">
              <div className="tabs">
                <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>ተጫዋቾች</button>
                <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>የኔ ታሪክ</button>
                <button className={activeTab === 'results' ? 'active' : ''} onClick={() => setActiveTab('results')}>ውጤቶች</button>
              </div>


            {activeTab === 'all' && (
  <div className="players-list">
    {/* 1. የእርስዎ ንቁ ቲኬት እና ያሸነፉት የብር መጠን ብቻ ማሳያ */}
    {isLoggedIn && myTickets.map((t, idx) => {
      const hits = t.numbers.filter(n => drawnNumbers.includes(n)).length;
      const selectionCount = t.numbers.length;
      const multipliers = kenoPayoutTable[selectionCount] || [];
      const winMultiplier = multipliers[hits] || 0;
      const calculatedWin = t.amount * winMultiplier;

      return (
        <div key={`my-${idx}`} className="player-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', border: '1px solid #00e676', background: 'rgba(0, 230, 118, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span className="p-name" style={{ color: '#00e676', fontWeight: 'bold' }}>የኔ ቲኬት (ዙር #{gameId})</span>
            
            {/* የገጠሙ ቁጥሮች ፅሁፍ ጠፍቶ ያሸነፉት የብር መጠን ብቻ እዚህ ይታያል */}
            <span className="p-win" style={{ 
              color: calculatedWin > 0 ? '#00e676' : '#8a96a3', 
              fontWeight: 'bold', 
              background: calculatedWin > 0 ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.05)', 
              padding: '4px 12px', 
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              {calculatedWin > 0 ? `🎉 +${calculatedWin} ETB` : '0 ETB'}
            </span>
            
            <span className="p-bet">{t.amount} ETB</span>
          </div>
          <div className="player-picked-nums" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {t.numbers.map((num, i) => {
              const isHit = drawnNumbers.includes(num);
              return (
                <span key={i} style={{ 
                  background: isHit ? '#00e676' : '#232a34', 
                  color: isHit ? '#000' : '#fff', 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  fontSize: '11px',
                  fontWeight: isHit ? 'bold' : 'normal',
                  border: isHit ? '1px solid #00e676' : '1px solid #2f3743'
                }}>{num}</span>
              );
            })}
          </div>
        </div>
      );
    })}

    {/* 2. የውሸት ተጫዋቾች ዝርዝር እና ያሸነፉት የብር መጠን ብቻ ማሳያ */}
    {fakePlayers.map((p, idx) => {
      const hits = p.nums.filter(n => drawnNumbers.includes(n)).length;
      const selectionCount = p.nums.length;
      const multipliers = kenoPayoutTable[selectionCount] || [];
      const winMultiplier = multipliers[hits] || 0;
      const calculatedWin = p.bet * winMultiplier;

      return (
        <div key={`fake-${idx}`} className="player-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span className="p-name" style={{ color: '#ffc107', fontWeight: 'bold' }}>{p.name} (ዙር #{p.gameId})</span>
            
            {/* የውሸት ተጫዋቾችም ያሸነፉት የብር መጠን ብቻ እዚህ ይታያል */}
            <span className="p-win" style={{ 
              color: calculatedWin > 0 ? '#00e676' : '#8a96a3', 
              fontWeight: 'bold', 
              background: calculatedWin > 0 ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.02)', 
              padding: '4px 10px', 
              borderRadius: '4px', 
              fontSize: '13px' 
            }}>
              {calculatedWin > 0 ? `💰 +${calculatedWin} ETB` : '0 ETB'}
            </span>

            <span className="p-bet">{p.bet} ETB</span>
          </div>
          <div className="player-picked-nums" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {p.nums.map((num, i) => {
              const isHit = drawnNumbers.includes(num);
              return (
                <span key={i} style={{ 
                  background: isHit ? '#00e676' : '#232a34', 
                  color: isHit ? '#000' : '#fff', 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  fontSize: '11px',
                  fontWeight: isHit ? 'bold' : 'normal',
                  border: isHit ? '1px solid #00e676' : '1px solid #2f3743'
                }}>{num}</span>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
)}



         {activeTab === 'history' && (
  <div className="history-list ticket-history-container">
    <h4 className="results-title" style={{ marginBottom: '12px', fontSize: '14px', color: '#ffc107' }}>
      የመጨረሻዎቹ 20 ቲኬቶች ታሪክ
    </h4>
    {permanentTicketHistory.length > 0 ? permanentTicketHistory.map((t, idx) => {
      return (
        <div key={t.id || idx} className="player-row ticket-history-card">
          <div className="ticket-history-meta">
            <span className="ticket-id-tag">ቲኬት ቁጥር (ዙር #{t.gameId})</span>
            
            {/* ከተቆለፈው የwinAmount መረጃ ላይ ብቻ ብሩን ያሳያል */}
            <span className="p-win" style={{ 
              color: t.winAmount > 0 ? '#00e676' : '#8a96a3', 
              fontWeight: 'bold', 
              background: t.winAmount > 0 ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.05)', 
              padding: '4px 10px', 
              borderRadius: '4px',
              fontSize: '13px'
            }}>
              {t.winAmount > 0 ? `🎉 +${t.winAmount} ETB` : '0 ETB'}
            </span>

            <span className="p-bet">{t.amount} ETB</span>
          </div>
          
          <div className="player-picked-nums" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {t.numbers.map((num, i) => {
              // ቁጥሩ አረንጓዴ የሚበራው በዚያ ቲኬት በራሱ ዙር ውስጥ የወጡት ቁጥሮች (drawnAtThatTime) ላይ ብቻ ነው
              const isHit = t.drawnAtThatTime && t.drawnAtThatTime.includes(num);
              return (
                <span key={i} className={`history-picked-ball ${isHit ? 'hit-green' : ''}`}>
                  {num}
                </span>
              );
            })}
          </div>

          <div className="ticket-time-stamp">
            🕒 {t.time}
          </div>
        </div>
      );
    }) : <div className="no-data">ምንም የተቀመጠ ቲኬት የለም</div>}
  </div>
)}


              {activeTab === 'results' && (
                <div className="results-list">
                  <h4 className="results-title">ያለፉ 10 ዙሮች ውጤቶች</h4>
                  <div className="history-rounds-container">
                    {kenoHistory.length > 0 ? (
                      kenoHistory.map((round, idx) => (
                        <div key={idx} className="round-history-row">
                          <strong>ዙር #{round.gameId}:</strong>
                          <div className="drawn-balls-grid-history">
                            {round.numbers.map((num, i) => (
                              <span key={i} className="history-ball-item">{num}</span>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-data">እስካሁን የወጣ ውጤት የለም</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="keno-main-content">
  <div className="keno-top-bar">
    <button className="back-btn-keno" onClick={() => setCurrentView('home')}>← ተመለስ</button>
    <div className="keno-status-container">
      {isDrawingKeno ? (
        <div className="drawing-display">
          <div className="current-ball-circle">{currentBall}</div>
          <div className="ball-counter">{drawnNumbers.length} / 20</div>
        </div>
      ) : (
        <div className="keno-timer-display"> : {kenoTimeLeft}s</div>
      )}
    </div>
  </div>

  {/* 🎯 አዲስ፡ የቀጥታ የሽልማት ግምት ማሳያ (Live Payout Calculator) */}
  {selectedNumbers.length > 0 && !isDrawingKeno && (
    <div className="live-payout-estimator" style={{
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '15px',
      textAlign: 'center'
    }}>
      <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold', display: 'block', marginBottom: '8px', fontSize: '14px' }}>
        🎯 የመረጡት ቁጥር ብዛት: {selectedNumbers.length} | ከተመቱ የሚከፈልዎት የሽልማት ግምት፡
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {(kenoPayoutTable[selectedNumbers.length] || []).map((multiplier, hits) => {
          if (multiplier === 0) return null; // 0x ክፍያ ያላቸውን እንዳያሳይ መከልከያ
          return (
            <span key={hits} style={{
              background: 'rgba(0, 230, 118, 0.1)',
              color: 'var(--accent-green)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '700',
              border: '1px solid rgba(0, 230, 118, 0.3)'
            }}>
              {hits} ቁጥር = {betAmountKeno * multiplier} ETB ({multiplier}x)
            </span>
          );
        })}
      </div>
    </div>
  )}

              <div className="keno-grid-container">
                <div className="keno-grid">
                  {Array.from({ length: 80 }, (_, i) => i + 1).map(num => (
                    <button 
                      key={num}
                      className={`keno-num ${selectedNumbers.includes(num) ? 'selected' : ''} ${drawnNumbers.includes(num) ? 'drawn' : ''}`}
                      onClick={() => {
                        if (selectedNumbers.includes(num)) {
                          setSelectedNumbers(selectedNumbers.filter(n => n !== num));
                        } else if (selectedNumbers.length < 10) {
                          setSelectedNumbers([...selectedNumbers, num]);
                        }
                      }}
                      disabled={isDrawingKeno}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>


              <div className="keno-controls-fixed">
                <div className="bet-input-group">
                  <label>የመጫወቻ መጠን (ETB): </label>
                  <input 
                    type="number" 
                    value={betAmountKeno} 
                    onChange={(e) => setBetAmountKeno(Number(e.target.value))} 
                    disabled={isDrawingKeno}
                  />
                </div>
                <button 
                  className="keno-submit-bet" 
                  onClick={placeKenoBet}
                  disabled={isDrawingKeno || selectedNumbers.length === 0}
                >
                  ቲኬት ቁረጥ ({selectedNumbers.length} ቁጥር)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- C. AVIATOR VIEW LAYOUT --- */}
        {currentView === 'game' && (
          <div className="aviator-main-layout">
            <aside className="aviator-sidebar">
              <div className="sidebar-header">
                <span>Live Bets</span>
                <span className="user-count">{game.userCount}</span>
              </div>
              <div className="bets-list">
                {fakePlayers.map((p, idx) => (
                  <div key={idx} className="bet-item">
                    <span className="p-name">{p.name}</span>
                    <span className="p-bet">{p.bet} ETB</span>
                    {game.status === 'crashed' && <span className="p-win">{(p.bet * 1.2).toFixed(2)}</span>}
                  </div>
                ))}
              </div>
            </aside>

            <div className="aviator-game-content">
              <div className="aviator-top-meta">
                <button className="back-btn-keno" onClick={() => setCurrentView('home')}>← ተመለስ</button>
                <div className="history-ribbon">
                  {game.gameHistory && game.gameHistory.slice(0, 8).map((h, i) => (
                    <span key={i} className={`history-badge ${h > 2 ? 'high' : 'low'}`}>{h}x</span>
                  ))}
                </div>
              </div>

              <div className="display-board-screen">
                {game.status === 'waiting' && (
                  <div className="waiting-frame">
                    <p>ቀጣይ ጨዋታ በ:</p>
                    <h2 className="countdown">{game.timer}s</h2>
                  </div>
                )}
                {game.status === 'flying' && (
                  <div className="flying-frame">
                     <h1 className="live-multiplier">{game.multiplier.toFixed(2)}x</h1>
                     <div className="plane-wrapper" style={{ bottom: `${Math.min(game.multiplier * 10, 70)}%`, left: `${Math.min(game.multiplier * 5, 70)}%` }}>
                        <span className="plane-emoji">✈️</span>
                     </div>
                  </div>
                )}
                {game.status === 'crashed' && (
                  <div className="crashed-frame">
                     <h2 className="crash-text">FLEW AWAY!</h2>
                     <h1 className="final-multiplier">{game.multiplier.toFixed(2)}x</h1>
                  </div>
                )}
              </div>

              <div className="aviator-bet-interface-panel">
                <div className="bet-control-panel-box">
                  <div className="bet-input-row">
                    <input 
                      type="number" 
                      value={bet1.amount} 
                      onChange={(e) => setBet1({ ...bet1, amount: Number(e.target.value) })}
                      disabled={bet1.isBetting}
                    />
                  </div>
                  {!bet1.isBetting ? (
                    <button className="bet-btn-place" onClick={() => handlePlaceBet(1)}>
                      BET <br/> <span>{bet1.amount} ETB</span>
                    </button>
                  ) : (
                    <button className="cashout-btn-action" onClick={() => handleCashOut(1)} disabled={game.status !== 'flying'}>
                      CASH OUT <br/> <span>{ (bet1.amount * game.multiplier).toFixed(2) } ETB</span>
                    </button>
                  )}
                  {win1 && <div className="win-toast-fly">Cashed Out: {win1} ETB</div>}
                </div>

                <div className="bet-control-panel-box">
                  <div className="bet-input-row">
                    <input 
                      type="number" 
                      value={bet2.amount} 
                      onChange={(e) => setBet2({ ...bet2, amount: Number(e.target.value) })}
                      disabled={bet2.isBetting}
                    />
                  </div>
                  {!bet2.isBetting ? (
                    <button className="bet-btn-place" onClick={() => handlePlaceBet(2)}>
                      BET <br/> <span>{bet2.amount} ETB</span>
                    </button>
                  ) : (
                    <button className="cashout-btn-action" onClick={() => handleCashOut(2)} disabled={game.status !== 'flying'}>
                      CASH OUT <br/> <span>{ (bet2.amount * game.multiplier).toFixed(2) } ETB</span>
                    </button>
                  )}
                  {win2 && <div className="win-toast-fly">Cashed Out: {win2} ETB</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- D. POPUPS & OVERLAYS SYSTEM --- */}
      
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