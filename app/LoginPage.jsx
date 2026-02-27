import React, { useState, useEffect } from 'react';
import { User, Lock, Loader, Shield, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

const SERVER = `/api/users`;
const UPDATE_PASSWORD = `/api/users`;
const GET_COINS_BALANCE = `/api/users/balance`;
const REQUEST_TIMEOUT_MS = 8000;

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);
  const [status, setStatus] = useState('ON');
  const [loginMode, setLoginMode] = useState('user'); // 'user' or 'admin'
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');

  const setEmailandAdmin = (val) => {
    if (val === "orperets11@gmail.com") {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
    setEmail(val);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchWithTimeout = async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const getCoinsBalance = async (userEmail) => {
    setIsFetchingUsers(true);
    try {
      const response = await fetchWithTimeout(`${GET_COINS_BALANCE}?email=${encodeURIComponent(userEmail)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0 && data[0].coins != null) {
        localStorage.setItem("currentBalance", data[0]["coins"]);
      } else if (typeof data?.coins === 'number') {
        localStorage.setItem("currentBalance", String(data.coins));
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
      const message = error?.name === 'AbortError'
        ? 'Fetching balance timed out. Please try again.'
        : 'Failed to fetch balance. Please try again.';
      setError(message);
    } finally {
      setIsFetchingUsers(false);
    }
  }

  const fetchUsers = async () => {
    setIsFetchingUsers(true);
    try {
      const response = await fetchWithTimeout(SERVER, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      const message = error?.name === 'AbortError'
        ? 'Fetching users timed out. Please try again.'
        : 'Failed to fetch users. Please try again.';
      setError(message);
    } finally {
      setIsFetchingUsers(false);
    }
    
    try {
      const response = await fetchWithTimeout('/api/admin/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      // setStatus(data["status"]);
      setStatus("ON");
    } catch (error) {
      console.error('Error fetching status:', error);
      const message = error?.name === 'AbortError'
        ? 'Fetching status timed out. Please try again.'
        : 'Failed to fetch status. Please try again.';
      setError(message);
      // Keep login available even if status endpoint is temporarily unavailable.
      setStatus('ON');
    }
  };

  const storeUserInfo = (user) => {
    localStorage.setItem("currentUser", JSON.stringify({
      email: user.email,
      name: user.firstName
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const user = users.find(item => item.email === email);

    if (loginMode === 'admin') {
      const adminEmails = ["liorbs89@gmail.com", "eyalh747@gmail.com", "orperets11@gmail.com", "roeizer@shenkar.ac.il"];
      if (!adminEmails.includes(email)) {
        setError('אין לך הרשאת מנהל');
        setTimeout(() => setError(''), 3000);
        setIsLoading(false);
        return;
      }
      if (!user) {
        setError('User not found');
        setIsLoading(false);
        setTimeout(() => setError(''), 3000);
        return;
      }
      if (password === 'shenkar') {
        setChangePassword(true);
        setIsLoading(false);
        return;
      }
      if (password === user.password) {
        storeUserInfo(user);
        router.push('/landing');
      } else {
        setError('סיסמת מנהל שגויה');
        setTimeout(() => setError(''), 3000);
      }
    } else {
      if (!user) {
        setError('User not found');
        setIsLoading(false);
        setTimeout(() => setError(''), 3000);
        return;
      }
      if (password === 'shenkar') {
        setChangePassword(true);
        setIsLoading(false);
        return;
      }
      if (password === user.password) {
        getCoinsBalance(user.email);
        storeUserInfo(user);
        router.push('/landing');
      } else {
        setError('Wrong Password or Email');
        setTimeout(() => setError(''), 3000);
      }
    }

    setIsLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!newPassword || newPassword === 'shenkar') {
      setError('Please enter a valid new password (cannot be "shenkar")');
      setIsLoading(false);
      setTimeout(() => setError(''), 3000);
      return;
    }

    const user = users.find(item => item.email === email);
    if (!user) {
      setError('User not found');
      setIsLoading(false);
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      const response = await fetch(UPDATE_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          "email": email,
          "password": newPassword
        })
      });

      if (response.ok) {
        storeUserInfo(user);
        // Redirect based on login mode
        if (loginMode === 'admin') {
          router.push('/landing');
        } else {
          router.push('/landing');
        }
      } else {
        setError('Failed to update password. Please try again.');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      setError('Failed to update password. Please try again.');
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: forgotPasswordEmail })
      });

      const data = await response.json();
      
      if (response.ok) {
        setForgotPasswordMessage('נשלח קישור לאיפוס סיסמה למייל שלך');
        setShowForgotPassword(false);
        setForgotPasswordEmail('');
      } else {
        setForgotPasswordMessage(data.error || 'שגיאה בשליחת המייל');
      }
    } catch (error) {
      console.error('Error sending forgot password:', error);
      setForgotPasswordMessage('שגיאה בשליחת המייל');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  if (isFetchingUsers) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loadingOverlay}>
          <Loader className={styles.loadingSpinner} size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginContainer}>
      {status === "OFF" && (
        <div className={styles.loginCard}>
          <div className={styles.assistantTitle} style={{color: "black"}}>Michael is sleeping now</div>
          <p className={styles.assistantTitle} style={{color: "black"}}>Take a break or check back later!</p>
        </div>
      )}
      {status === "ON" && (
        <div>
          <div className={styles.logoWrapper}>
            <img className={styles.botImage} src="bot.png" alt="Bot" />
            <div className={styles.assistantName}>
              <img className={styles.logoImage} src="logo.png" alt="Logo" />
              <h2 className={styles.assistantTitle}>MICHAEL</h2>
              <p className={styles.assistantSubtitle}>SQL AI Assistant</p>
            </div>
          </div>
          <div className={styles.loginCard}>
            <h2 className={styles.title}>התחברות</h2>

            <div className={styles.loginModeContainer}>
              <button 
                type="button"
                className={`${styles.loginModeButton} ${loginMode === 'user' ? styles.loginModeActive : ''}`}
                onClick={() => setLoginMode('user')}
              >
                <UserCheck size={18} />
                כניסת משתמש
              </button>
              <button 
                type="button"
                className={`${styles.loginModeButton} ${loginMode === 'admin' ? styles.loginModeActive : ''}`}
                onClick={() => setLoginMode('admin')}
              >
                <Shield size={18} />
                כניסת מנהל
              </button>
            </div>

            {!changePassword ? (
              <form className={styles.form} onSubmit={handleLogin}>
                <div className={styles.inputGroup}>
                  <span className={styles.iconWrapper}>
                    <User size={18} />
                  </span>
                  <input 
                    type="email" 
                    className={styles.input}
                    placeholder="כתובת מייל" 
                    value={email}
                    onChange={(e) => setEmailandAdmin(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <span className={styles.iconWrapper}>
                    <Lock size={18} />
                  </span>
                  <input 
                    type="password" 
                    className={styles.input}
                    placeholder="סיסמה"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                
                
                <button type="submit" className={styles.button} disabled={isLoading}>
                  {isLoading ? <Loader className={styles.loadingSpinner} size={18} /> : (loginMode === 'admin' ? 'כניסה כמנהל' : 'אישור')}
                </button>
                {!changePassword && (
                  <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <button 
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: '#007bff', 
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      איפוס סיסמה
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <>
                <h2 className={styles.title}>שינוי סיסמה - כניסה ראשונה</h2>
                <p style={{textAlign: 'center', marginBottom: '20px', color: '#666'}}>
                  זוהי הכניסה הראשונה שלך. אנא הגדר סיסמה חדשה
                </p>
                <form className={styles.form} onSubmit={handleChangePassword}>
                  <div className={styles.inputGroup}>
                    <span className={styles.iconWrapper}>
                      <User size={18} />
                    </span>
                    <input 
                      type="email" 
                      className={styles.input}
                      placeholder="כתובת מייל" 
                      value={email}
                      disabled
                      style={{backgroundColor: '#f0f0f0'}}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <span className={styles.iconWrapper}>
                      <Lock size={18} />
                    </span>
                    <input 
                      type="password" 
                      className={styles.input}
                      placeholder="סיסמה חדשה"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className={styles.button} disabled={isLoading}>
                    {isLoading ? <Loader className={styles.loadingSpinner} size={18} /> : 'שנה סיסמה'}
                  </button>
                  <button 
                    type="button" 
                    className={styles.button}
                    style={{backgroundColor: '#666', marginTop: '10px'}}
                    onClick={() => {
                      setChangePassword(false);
                      setNewPassword('');
                      setError('');
                    }}
                  >
                    חזור
                  </button>
                </form>
              </>
            )}
            {error && <div className={styles.errorMessage}>{error}</div>}
          </div>
          {isLoading && (
            <div className={styles.loadingOverlay}>
              <Loader className={styles.loadingSpinner} size={48} />
            </div>
          )}
        </div>
      )}
      
      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center'
          }}>
            <h3>איפוס סיסמה</h3>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              הזן את כתובת המייל שלך ונשלח לך קישור לאיפוס הסיסמה
            </p>
            
            <form onSubmit={handleForgotPassword}>
              <div className={styles.inputGroup}>
                <span className={styles.iconWrapper}>
                  <User size={18} />
                </span>
                <input 
                  type="email" 
                  className={styles.input}
                  placeholder="כתובת מייל" 
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="submit" 
                  className={styles.button} 
                  disabled={forgotPasswordLoading}
                  style={{ flex: 1 }}
                >
                  {forgotPasswordLoading ? <Loader className={styles.loadingSpinner} size={18} /> : 'שלח קישור'}
                </button>
                <button 
                  type="button" 
                  className={styles.button}
                  style={{ backgroundColor: '#666', flex: 1 }}
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordEmail('');
                    setForgotPasswordMessage('');
                  }}
                >
                  ביטול
                </button>
              </div>
            </form>
            
            {forgotPasswordMessage && (
              <div style={{ 
                marginTop: '15px', 
                padding: '10px', 
                backgroundColor: forgotPasswordMessage.includes('שגיאה') ? '#f8d7da' : '#d4edda',
                color: forgotPasswordMessage.includes('שגיאה') ? '#721c24' : '#155724',
                borderRadius: '5px',
                fontSize: '14px'
              }}>
                {forgotPasswordMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
