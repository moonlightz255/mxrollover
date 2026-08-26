import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Change this to your deployed Render backend URL when publishing!
const API_URL = 'https://mxrollover.onrender.com'; 

function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('userToken'));
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Navigation & Tab Switch State
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Customization & Settings States (rebuilding your localStorage caching logic)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSettingsAccordion, setShowSettingsAccordion] = useState(false);
  const [username, setUsername] = useState(() => localStorage.getItem('userProfileUsername') || 'Savings User');
  const [theme, setTheme] = useState(() => localStorage.getItem('userProfileTheme') || 'default');
  const [profilePic, setProfilePic] = useState(() => localStorage.getItem('userProfileImage') || null);
  const [bgImage, setBgImage] = useState(() => {
    const active = localStorage.getItem('useCustomBgActive') === 'true';
    return active ? localStorage.getItem('userProfileCustomBg') : null;
  });

  // Coupon Builder Form States
  const [baseStake, setBaseStake] = useState('1000');
  const [kickOffTime, setKickOffTime] = useState('');
  const [stagedMatches, setStagedMatches] = useState([]);
  const [accumulatedOdds, setAccumulatedOdds] = useState(1.00);
  
  // Individual Accumulator Selection Builders
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [prediction, setPrediction] = useState('');
  const [matchOdd, setMatchOdd] = useState('');

  // Active runs fetched from database
  const [rolloverRuns, setRolloverRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load database entries on mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    if (!authEmail || !authPassword) {
      setAuthError('Please fill in all fields');
      setAuthLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, {
        email: authEmail,
        password: authPassword
      });
      
      localStorage.setItem('userToken', res.data.token);
      localStorage.setItem('userProfileUsername', res.data.username);
      setUsername(res.data.username);
      setIsAuthenticated(true);
      setAuthEmail('');
      setAuthPassword('');
      setAuthLoading(false);
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Login failed. Please try again.');
      setAuthLoading(false);
    }
  };

  // Handle Register
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    if (!authEmail || !authPassword || !authConfirmPassword || !authUsername) {
      setAuthError('Please fill in all fields');
      setAuthLoading(false);
      return;
    }

    if (authPassword !== authConfirmPassword) {
      setAuthError('Passwords do not match');
      setAuthLoading(false);
      return;
    }

    if (authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters');
      setAuthLoading(false);
      return;
    }

    if (authUsername.length < 3) {
      setAuthError('Username must be at least 3 characters');
      setAuthLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/api/auth/register`, {
        email: authEmail,
        password: authPassword,
        username: authUsername
      });
      
      localStorage.setItem('userToken', res.data.token);
      localStorage.setItem('userProfileUsername', res.data.username);
      setUsername(res.data.username);
      setIsAuthenticated(true);
      setAuthEmail('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthUsername('');
      setAuthLoading(false);
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Registration failed. Please try again.');
      setAuthLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('userToken');
    setIsAuthenticated(false);
    setAuthEmail('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setAuthUsername('');
    setAuthError('');
    setActiveTab('dashboard');
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const res = await axios.get(`${API_URL}/api/rollovers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setRolloverRuns(res.data);
      
      // Automatic Rollover Stake Calculation:
      // If the most recent active run has winning steps, grab the last won step payout
      if (res.data.length > 0) {
        const lastRun = res.data[0];
        const wonSteps = lastRun.steps ? lastRun.steps.filter(s => s.status === 'win') : [];
        if (wonSteps.length > 0) {
          const lastWonPayout = Math.floor(wonSteps[wonSteps.length - 1].win_amount);
          setBaseStake(lastWonPayout.toString());
        }
      }
      setLoading(false);
    } catch (err) {
      console.error("Backend offline. Connect to Render server.", err);
      setLoading(false);
    }
  };

  // Sync profile customizations back to localStorage on change
  const handleUsernameChange = (e) => {
    const val = e.target.value;
    setUsername(val);
    localStorage.setItem('userProfileUsername', val);
  };

  const handleThemeChange = (e) => {
    const selectedTheme = e.target.value;
    setTheme(selectedTheme);
    setBgImage(null); // Clear custom background so solid color theme displays
    localStorage.setItem('userProfileTheme', selectedTheme);
    localStorage.setItem('useCustomBgActive', 'false');
  };

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result);
        localStorage.setItem('userProfileImage', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBgChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBgImage(reader.result);
        localStorage.setItem('userProfileCustomBg', reader.result);
        localStorage.setItem('useCustomBgActive', 'true');
      };
      reader.readAsDataURL(file);
    }
  };

  // Accumulator Appender logic mirroring your original arrays
  const handleAppendMatch = (e) => {
    e.preventDefault();
    if (!homeTeam || !awayTeam || !prediction || isNaN(parseFloat(matchOdd))) {
      alert("Please fill all single row match properties (Home, Away, Bet, Odds) before adding.");
      return;
    }

    const currentOddsValue = parseFloat(matchOdd);
    const textSelection = `${homeTeam} vs ${awayTeam} (${prediction} @${currentOddsValue})`;
    
    setStagedMatches([...stagedMatches, textSelection]);
    
    // Dynamic odds multiplication formula
    setAccumulatedOdds(prev => prev * currentOddsValue);

    // Reset inputs
    setHomeTeam('');
    setAwayTeam('');
    setPrediction('');
    setMatchOdd('');
  };

  // Submit staged coupon to MySQL Database
  const handleGenerateActiveSlip = async (e) => {
    e.preventDefault();
    if (stagedMatches.length === 0) {
      alert("Please add at least one match to your coupon using the '+' button first.");
      return;
    }

    const d = new Date();
    const currentChallengeDate = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    const finalStake = parseFloat(baseStake) || 1000;
    const summaryText = stagedMatches.join(' | ');

    try {
      const token = localStorage.getItem('userToken');
      await axios.post(`${API_URL}/api/rollovers`, {
        title: `${currentChallengeDate} Run`,
        target_goal: "1M Goal",
        initial_stake: finalStake,
        base_odds: parseFloat(accumulatedOdds.toFixed(2))
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Reset staging builders
      setStagedMatches([]);
      setAccumulatedOdds(1.00);
      setKickOffTime('');
      fetchData();
      
      // Navigate to Active Bets
      setActiveTab('goal');
      alert(`Coupon initialized and added to database successfully!`);
    } catch (err) {
      alert("Failed to save the slip. Check database or Render API server.");
    }
  };

  // Toggle dynamic day status changes (pending -> win -> loss -> pending)
  const handleToggleBetStatus = async (betId, currentStatus) => {
    let nextStatus = 'pending';
    if (currentStatus === 'pending') nextStatus = 'win';
    else if (currentStatus === 'win') nextStatus = 'loss';

    try {
      const token = localStorage.getItem('userToken');
      await axios.put(`${API_URL}/api/bets/${betId}`, { status: nextStatus }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchData(); // Trigger fresh database sync
    } catch (err) {
      console.error("Status update error", err);
    }
  };

  // Close profile menu if user clicks outside
  useEffect(() => {
    const handleOutsideClick = () => setShowProfileDropdown(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Authentication Screen
  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: '400px'
        }}>
          <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#1e293b' }}>
            <i className="fa-regular fa-circle-dot"></i> MxRollover
          </h1>

          <div style={{ display: 'flex', marginBottom: '20px', gap: '10px' }}>
            <button
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: authMode === 'login' ? '#2563eb' : '#e2e8f0',
                color: authMode === 'login' ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Login
            </button>
            <button
              onClick={() => { setAuthMode('register'); setAuthError(''); }}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: authMode === 'register' ? '#2563eb' : '#e2e8f0',
                color: authMode === 'register' ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Register
            </button>
          </div>

          {authError && (
            <div style={{
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              padding: '10px',
              borderRadius: '4px',
              marginBottom: '20px',
              fontSize: '0.9rem'
            }}>
              {authError}
            </div>
          )}

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#475569', fontWeight: 'bold' }}>Email</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="Enter your email"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {authMode === 'register' && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: '#475569', fontWeight: 'bold' }}>Username</label>
                <input
                  type="text"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder="Choose a username"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#475569', fontWeight: 'bold' }}>Password</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {authMode === 'register' && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: '#475569', fontWeight: 'bold' }}>Confirm Password</label>
                <input
                  type="password"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: authLoading ? '#cbd5e1' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: authLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {authLoading ? 'Processing...' : authMode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`theme-container theme-${theme}`} 
      style={{ backgroundImage: bgImage ? `url(${bgImage})` : 'none' }}
    >
      <div className="app-wrapper">
        
        {/* HEADER BLOCK */}
        <header onClick={(e) => e.stopPropagation()}>
          <div className="header-content">
            {/* Left Branding */}
            <div className="header-left">
              <h1>
                <i className="fa-regular fa-circle-dot"></i> 
                𝐃𝐫𝐞𝐚𝐦𝐬 𝐜𝐨𝐦𝐞 𝐭𝐫𝐮𝐞
              </h1>
              <p style={{ marginTop: '5px', color: 'blue', opacity: 1, fontSize: '0.9rem' }}>
                ✦ 𝐹𝑜𝑐𝑢𝑠 𝑜𝑛 𝑦𝑜𝑢𝑟 𝑑𝑟𝑒𝑎𝑚 𝑛𝑒𝑣𝑒𝑟 𝑔𝑖𝑣𝑒 𝑢𝑝. ✧
              </p>
            </div>
            
            {/* Profile Dropdown Button */}
            <div className="header-right">
              <div className="profile-dropdown">
                <button 
                  className="profile-btn" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setShowProfileDropdown(!showProfileDropdown); 
                  }}
                >
                  <div id="profile-icon" style={{ backgroundImage: profilePic ? `url(${profilePic})` : 'none', backgroundSize: 'cover' }}>
                    {!profilePic && <i className="fas fa-user"></i>}
                  </div>
                </button>
                
                {/* Dropdown Menu Panel */}
                {showProfileDropdown && (
                  <div className="dropdown-content show" onClick={(e) => e.stopPropagation()}>
                    <div className="dropdown-header">
                      <div 
                        id="dropdown-profile-pic"
                        onClick={() => document.getElementById('profile-upload-input').click()}
                        style={{ position: 'relative', cursor: 'pointer', overflow: 'hidden', backgroundImage: profilePic ? `url(${profilePic})` : 'none', backgroundSize: 'cover' }}
                      >
                        {!profilePic && <i className="fas fa-user" id="avatar-icon"></i>}
                        <div className="upload-overlay">
                          <i className="fas fa-camera" style={{ fontSize: '0.75rem', color: 'white' }}></i>
                        </div>
                      </div>
                      <input type="file" id="profile-upload-input" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePicChange} />
                      <div>
                        <strong id="display-username">{username}</strong>
                        <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Member</div>
                      </div>
                    </div>
                    
                    <div className="dropdown-divider"></div>
                    
                    {/* Inner Dropdown Navigation Links */}
                    <a href="#dashboard" onClick={() => { setActiveTab('dashboard'); setShowProfileDropdown(false); }}>
                      <i className="fas fa-tachometer-alt"></i> Dashboard
                    </a>
                    <a href="#goal" onClick={() => { setActiveTab('goal'); setShowProfileDropdown(false); }}>
                      <i className="fa-regular fa-circle-dot live-blue-dot"></i> Active bets
                    </a>
                    <a href="#transactions" onClick={() => { setActiveTab('transactions'); setShowProfileDropdown(false); }}>
                      <i className="fas fa-history"></i> My bets
                    </a>

                    <div className="dropdown-divider"></div>

                    {/* COLLAPSIBLE SIDEBAR SETTINGS ACCORDION */}
                    <div className={`settings-dropdown-accordion ${showSettingsAccordion ? 'open' : ''}`}>
                      <div className="settings-accordion-header" onClick={() => setShowSettingsAccordion(!showSettingsAccordion)}>
                        <span><i className="fa-solid fa-gear"></i> Settings</span>
                        <i className="fas fa-chevron-down settings-arrow"></i>
                      </div>
                      
                      {showSettingsAccordion && (
                        <div className="settings-accordion-content">
                          <div className="setting-item-row">
                            <label>Username:</label>
                            <input type="text" value={username} onChange={handleUsernameChange} />
                          </div>

                          <div className="setting-item-row">
                            <label>Color Theme:</label>
                            <select value={theme} onChange={handleThemeChange}>
                              <option value="default">Default Orange</option>
                              <option value="dark">Dark Theme</option>
                              <option value="blue">Blue Sky</option>
                              <option value="purple">Royal Purple</option>
                              <option value="pink">Vibrant Pink</option>
                              <option value="gray">Slate Gray</option>
                            </select>
                          </div>

                          <div className="setting-item-row">
                            <label>Wall Background:</label>
                            <button type="button" className="bg-upload-trigger-btn" onClick={() => document.getElementById('bg-upload-input').click()}>
                              <i className="fa-solid fa-image"></i> Import Image
                            </button>
                            <input type="file" id="bg-upload-input" accept="image/*" style={{ display: 'none' }} onChange={handleBgChange} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="dropdown-divider"></div>

                    <a href="#logout" onClick={() => { handleLogout(); setShowProfileDropdown(false); }} style={{ color: '#dc2626' }}>
                      <i className="fas fa-sign-out-alt"></i> Logout
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Main Navigation Tabs */}
          <nav>
            <button className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
              <i className="fas fa-home"></i> Dashboard
            </button>
            <button className={`nav-btn ${activeTab === 'goal' ? 'active' : ''}`} onClick={() => setActiveTab('goal')}>
              <i className="fa-regular fa-circle-dot live-blue-dot"></i> Active bets
            </button>
            <button className={`nav-btn ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>
              <i className="fa-solid fa-clock-rotate-left"></i> My bets
            </button>
          </nav>
        </header>

        {/* MAIN BODY CONTENT SECTIONS */}
        <main className="content-container">
          
          {/* TAB 1: Dashboard */}
          {activeTab === 'dashboard' && (
            <section id="dashboard-view" className="page-view active">
              <h2 style={{ marginBottom: '15px', color: '#1e293b' }}>Dashboard</h2>
              
              <div className="creator-card">
                <h3><i className="fa-solid fa-square-plus"></i> Create Betslip</h3>
                <form onSubmit={handleGenerateActiveSlip}>
                  <div className="form-row-base">
                    <div className="input-group">
                      <label>Base Stake</label>
                      <input type="number" value={baseStake} onChange={(e) => setBaseStake(e.target.value)} placeholder="1000" required />
                    </div>
                    <div className="input-group">
                      <label>Total Odds</label>
                      <input type="number" value={accumulatedOdds.toFixed(2)} readOnly style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold', color: '#2563eb' }} />
                    </div>
                    <div className="input-group">
                      <label>Kick-off</label>
                      <input type="time" value={kickOffTime} onChange={(e) => setKickOffTime(e.target.value)} required />
                    </div>
                  </div>

                  {/* Appended Coupon Summary */}
                  <div id="added-matches-paragraph" className="added-teams-summary">
                    {stagedMatches.length === 0 ? (
                      "No matches staging inside this coupon yet. Append fields below."
                    ) : (
                      stagedMatches.join(' | ')
                    )}
                  </div>

                  {/* Coupon Accumulator Match Appender */}
                  <div className="accumulator-input-row">
                    <input type="text" placeholder="Home Team" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} />
                    <span className="vs-text">vs</span>
                    <input type="text" placeholder="Away Team" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} />
                    <input type="text" placeholder="Bet (e.g. Over 1.5)" style={{ width: '110px' }} value={prediction} onChange={(e) => setPrediction(e.target.value)} />
                    <input type="number" step="0.01" placeholder="Odds" style={{ width: '70px' }} value={matchOdd} onChange={(e) => setMatchOdd(e.target.value)} />
                    <button type="button" onClick={handleAppendMatch} className="append-plus-btn">
                      <i className="fa-solid fa-plus"></i>
                    </button>
                  </div>

                  <button type="submit" className="create-slip-btn" style={{ marginTop: '10px' }}>Generate Active Slip</button>
                </form>
              </div>

              {/* Settlement Interface */}
              <div className="creator-card" style={{ marginTop: '20px' }}>
                <h3><i className="fa-solid fa-gavel"></i> Open Slip Settlement</h3>
                <div id="dashboard-active-settlement">
                  {rolloverRuns.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: '10px' }}>No open un-settled bets slips currently found.</p>
                  ) : (
                    rolloverRuns.slice(0, 1).map(run => (
                      <div key={run.id} className="settlement-block">
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b' }}>Active Rollover Challenge</div>
                        <div style={{ fontSize: '0.8rem', margin: '6px 0', color: '#475569', lineHeight: 1.3 }}>{run.title}</div>
                        <button className="settle-action-btn" onClick={() => setActiveTab('goal')}>Settle Day Steps</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {/* TAB 2: Active Bets */}
          {activeTab === 'goal' && (
            <section id="goal-view" className="page-view active">
              <h2 style={{ marginBottom: '15px', color: '#333' }}>Active Bets</h2>
              <div id="active-bets-target-list">
                {loading ? (
                  <p style={{ textAlign: 'center', color: '#64748b' }}>Syncing operations with MySQL server...</p>
                ) : rolloverRuns.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '20px', fontSize: '0.85rem' }}>No current active operations running.</p>
                ) : (
                  rolloverRuns.map((run) => (
                    <div className="history-dropdown-card open" key={run.id} style={{ borderLeft: '4px solid #00b0ff', marginBottom: '20px' }}>
                      <div className="history-header-toggle">
                        <p className="history-title-paragraph"><strong>Active Run:</strong> {run.title}</p>
                      </div>
                      <div className="history-content-collapsible" style={{ display: 'block', padding: '10px' }}>
                        <div className="table-scroll-wrapper">
                          <table className="history-data-table">
                            <thead>
                              <tr>
                                <th>DAY</th>
                                <th>STAKE</th>
                                <th>ODD</th>
                                <th>WIN</th>
                                <th>STATUS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {run.steps && run.steps.map((step) => (
                                <tr key={step.id}>
                                  <td>{step.day_number}</td>
                                  <td>{parseFloat(step.stake).toLocaleString()}</td>
                                  <td>{step.odds}</td>
                                  <td>{parseFloat(step.win_amount).toLocaleString()}</td>
                                  <td>
                                    <button 
                                      className={`btn ${step.status === 'win' ? 'btn-win' : step.status === 'loss' ? 'btn-loss' : 'btn-pending'}`}
                                      onClick={() => handleToggleBetStatus(step.id, step.status)}
                                      style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                      {step.status === 'win' ? '✔' : step.status === 'loss' ? '✘' : 'pending'}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* TAB 3: My Bets (History Archive) */}
          {activeTab === 'transactions' && (
            <section id="transactions-view" className="page-view active">
              <h2 style={{ marginBottom: '15px', color: '#333' }}>Bets History</h2>
              <div id="history-bets-target-list">
                {rolloverRuns.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '20px', fontSize: '0.85rem' }}>No historical data records verified yet.</p>
                ) : (
                  rolloverRuns.map(run => {
                    // Filter down won/lost steps to present a clean archival summary card
                    const settledSteps = run.steps ? run.steps.filter(s => s.status === 'win' || s.status === 'loss') : [];
                    return (
                      <div className="history-dropdown-card" key={run.id}>
                        <div className="history-header-toggle" onClick={() => alert(`Active selections: ${run.title}`)}>
                          <p className="history-title-paragraph">
                            <strong>Challenge Run:</strong> {run.title} (Settled: {settledSteps.length} Days)
                          </p>
                          <span style={{ fontSize: '0.9rem', marginLeft: '6px', flexShrink: 0 }}>
                            {settledSteps.some(s => s.status === 'loss') ? '❌' : '✅'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

        </main>
      </div>
    </div>
  );
}

export default App;