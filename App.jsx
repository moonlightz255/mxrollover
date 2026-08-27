import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Change this to your deployed Render backend URL when publishing!
const API_URL = 'https://mxrollover-backend-jpyd.onrender.com';

// Retry policy (adjustable)
const API_RETRIES = 20;       // number of retry attempts
const API_RETRY_DELAY = 3000; // ms between attempts
const AXIOS_TIMEOUT = 170000; // ms timeout for axios request (170s to match server timeout)

function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('userToken'));
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
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

  // ======================================================================
  // Helper: axios request with retries (handles backend cold-starts)
  // Usage: await axiosRequestWithRetries({ method:'post', url:`${API_URL}/...`, data: {...} })
  // ======================================================================
  const axiosRequestWithRetries = async (config, retries = API_RETRIES) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const merged = {
          timeout: AXIOS_TIMEOUT,
          ...config
        };
        const res = await axios(merged);
        return res;
      } catch (err) {
        const status = err.response?.status;
        const message = err.message || '';
        // Determine if error is retryable:
        const retryable = (
          !err.response // network-level error (DNS, refused, etc.)
          || message.includes('Network Error')
          || message.includes('timeout')
          || message.includes('ECONNREFUSED')
          || message.includes('ENOTFOUND')
          || status === 503
          || (status >= 500 && status < 600)
        );

        // If last attempt or not retryable -> throw
        if (attempt === retries || !retryable) {
          throw err;
        }

        // Optional: update UI about retrying (only for auth flows)
        if (config._updateRetryStatus) {
          try {
            config._updateRetryStatus(attempt + 1, retries);
          } catch (_) {}
        }

        // Wait then retry
        await new Promise(r => setTimeout(r, API_RETRY_DELAY));
      }
    }
    // Should never reach here
    throw new Error('Retries exhausted');
  };

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

    if (!authUsername || !authPassword) {
      setAuthError('Please fill in all fields');
      setAuthLoading(false);
      return;
    }

    try {
      // pass an updater to show retry attempt info if you want
      const res = await axiosRequestWithRetries({
        method: 'post',
        url: `${API_URL}/api/auth/login`,
        data: { username: authUsername, password: authPassword },
        _updateRetryStatus: (attempt, max) => setAuthError(`Waiting for backend... attempt ${attempt}/${max}`)
      });

      localStorage.setItem('userToken', res.data.token);
      localStorage.setItem('userProfileUsername', res.data.username);
      setUsername(res.data.username);
      setIsAuthenticated(true);
      setAuthUsername('');
      setAuthPassword('');
      setAuthLoading(false);
      setAuthError('');
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

    if (!authUsername || !authPassword || !authConfirmPassword) {
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
      const res = await axiosRequestWithRetries({
        method: 'post',
        url: `${API_URL}/api/auth/register`,
        data: { username: authUsername, password: authPassword },
        _updateRetryStatus: (attempt, max) => setAuthError(`Waiting for backend... attempt ${attempt}/${max}`)
      });

      localStorage.setItem('userToken', res.data.token);
      localStorage.setItem('userProfileUsername', res.data.username);
      setUsername(res.data.username);
      setIsAuthenticated(true);
      setAuthUsername('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthLoading(false);
      setAuthError('');
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Registration failed. Please try again.');
      setAuthLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('userToken');
    setIsAuthenticated(false);
    setAuthUsername('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setAuthError('');
    setActiveTab('dashboard');
  };

  // Fetch rollovers (with retries)
  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const res = await axiosRequestWithRetries({
        method: 'get',
        url: `${API_URL}/api/rollovers`,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setRolloverRuns(res.data);

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
      console.error("Backend offline or request failed:", err);
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
    setAccumulatedOdds(prev => prev * currentOddsValue);
    setHomeTeam('');
    setAwayTeam('');
    setPrediction('');
    setMatchOdd('');
  };

  // Submit staged coupon to MySQL Database (with retries)
  const handleGenerateActiveSlip = async (e) => {
    e.preventDefault();
    if (stagedMatches.length === 0) {
      alert("Please add at least one match to your coupon using the '+' button first.");
      return;
    }

    const d = new Date();
    const currentChallengeDate = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    const finalStake = parseFloat(baseStake) || 1000;

    try {
      const token = localStorage.getItem('userToken');
      await axiosRequestWithRetries({
        method: 'post',
        url: `${API_URL}/api/rollovers`,
        data: {
          title: `${currentChallengeDate} Run`,
          target_goal: "1M Goal",
          initial_stake: finalStake,
          base_odds: parseFloat(accumulatedOdds.toFixed(2))
        },
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setStagedMatches([]);
      setAccumulatedOdds(1.00);
      setKickOffTime('');
      fetchData();
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
      await axiosRequestWithRetries({
        method: 'put',
        url: `${API_URL}/api/bets/${betId}`,
        data: { status: nextStatus },
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

  // Authentication Screen with Beautiful Gradient
  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'Arial, sans-serif',
        padding: '20px'
      }}>
        {/* Animated background circles */}
        <div style={{
          position: 'fixed',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          animation: 'float 20s infinite',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'fixed',
          bottom: '-50%',
          right: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle at 70% 50%, rgba(255,255,255,0.08) 0%, transparent 50%)',
          animation: 'float 25s infinite reverse',
          pointerEvents: 'none'
        }} />

        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          padding: '45px 40px',
          borderRadius: '20px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
          width: '100%',
          maxWidth: '420px',
          position: 'relative',
          zIndex: 1,
          animation: 'slideUp 0.5s ease-out'
        }}>
          {/* Logo/Brand */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{
              width: '70px',
              height: '70px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 15px',
              fontSize: '30px',
              color: 'white',
              boxShadow: '0 10px 30px rgba(102, 126, 234, 0.4)'
            }}>
              <i className="fa-regular fa-circle-dot"></i>
            </div>
            <h1 style={{ 
              margin: 0, 
              fontSize: '28px', 
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              MxRollover
            </h1>
            <p style={{ 
              margin: '5px 0 0', 
              color: '#94a3b8', 
              fontSize: '14px',
              fontWeight: '300'
            }}>
              {authMode === 'login' ? 'Welcome back!' : 'Create your account'}
            </p>
          </div>

          {/* Toggle Buttons */}
          <div style={{ 
            display: 'flex', 
            marginBottom: '25px', 
            gap: '10px',
            background: '#f1f5f9',
            padding: '5px',
            borderRadius: '12px'
          }}>
            <button
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
              style={{
                flex: 1,
                padding: '12px',
                background: authMode === 'login' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                color: authMode === 'login' ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '15px',
                transition: 'all 0.3s ease',
                boxShadow: authMode === 'login' ? '0 4px 15px rgba(102, 126, 234, 0.4)' : 'none'
              }}
            >
              <i className="fas fa-sign-in-alt" style={{ marginRight: '8px' }}></i>
              Login
            </button>
            <button
              onClick={() => { setAuthMode('register'); setAuthError(''); }}
              style={{
                flex: 1,
                padding: '12px',
                background: authMode === 'register' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                color: authMode === 'register' ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '15px',
                transition: 'all 0.3s ease',
                boxShadow: authMode === 'register' ? '0 4px 15px rgba(102, 126, 234, 0.4)' : 'none'
              }}
            >
              <i className="fas fa-user-plus" style={{ marginRight: '8px' }}></i>
              Register
            </button>
          </div>

          {/* Error Message */}
          {authError && (
            <div style={{
              background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)',
              color: '#991b1b',
              padding: '12px 15px',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              border: '1px solid #f87171'
            }}>
              <i className="fas fa-exclamation-circle"></i>
              <span>{authError}</span>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                color: '#334155', 
                fontWeight: '600',
                fontSize: '14px'
              }}>
                <i className="fas fa-user" style={{ marginRight: '8px', color: '#667eea' }}></i>
                Username
              </label>
              <input
                type="text"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="Enter your username"
                style={{
                  width: '100%',
                  padding: '12px 15px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  transition: 'all 0.3s ease',
                  background: '#f8fafc',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.background = 'white';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.background = '#f8fafc';
                }}
              />
            </div>

            <div style={{ marginBottom: authMode === 'register' ? '18px' : '25px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                color: '#334155', 
                fontWeight: '600',
                fontSize: '14px'
              }}>
                <i className="fas fa-lock" style={{ marginRight: '8px', color: '#667eea' }}></i>
                Password
              </label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '12px 15px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  transition: 'all 0.3s ease',
                  background: '#f8fafc',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.background = 'white';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.background = '#f8fafc';
                }}
              />
            </div>

            {authMode === 'register' && (
              <div style={{ marginBottom: '25px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  color: '#334155', 
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  <i className="fas fa-check-circle" style={{ marginRight: '8px', color: '#667eea' }}></i>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    transition: 'all 0.3s ease',
                    background: '#f8fafc',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#667eea';
                    e.target.style.background = 'white';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.background = '#f8fafc';
                  }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{
                width: '100%',
                padding: '14px',
                background: authLoading 
                  ? '#cbd5e1' 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: authLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (!authLoading) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
                }
              }}
              onMouseLeave={(e) => {
                if (!authLoading) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                }
              }}
            >
              {authLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin" style={{ marginRight: '10px' }}></i>
                  Processing...
                </>
              ) : (
                <>
                  {authMode === 'login' ? (
                    <>
                      <i className="fas fa-sign-in-alt" style={{ marginRight: '10px' }}></i>
                      Login
                    </>
                  ) : (
                    <>
                      <i className="fas fa-user-plus" style={{ marginRight: '10px' }}></i>
                      Create Account
                    </>
                  )}
                </>
              )}
            </button>

            {/* Switch mode link */}
            <div style={{ textAlign: 'center', marginTop: '18px' }}>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>
                {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <span
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setAuthError('');
                  }}
                  style={{
                    color: '#667eea',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    transition: 'color 0.3s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#764ba2'}
                  onMouseLeave={(e) => e.target.style.color = '#667eea'}
                >
                  {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                </span>
              </span>
            </div>
          </form>
        </div>

        {/* CSS Animations */}
        <style>
          {`
            @keyframes float {
              0% { transform: translate(0, 0) rotate(0deg); }
              33% { transform: translate(10%, -10%) rotate(5deg); }
              66% { transform: translate(-5%, 5%) rotate(-3deg); }
              100% { transform: translate(0, 0) rotate(0deg); }
            }
            
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}
        </style>
      </div>
    );
  }

  // ==== REST OF YOUR APP (UNTOUCHED) ====
  return (
    <div 
      className={`theme-container theme-${theme}`} 
      style={{ backgroundImage: bgImage ? `url(${bgImage})` : 'none' }}
    >
      <div className="app-wrapper">
        {/* (rest of your existing UI untouched) */}
        {/* ... The large remainder of your returned UI remains exactly as before ... */}
      </div>
    </div>
  );
}

export default App;