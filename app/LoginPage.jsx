import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpLeft, Lock, Loader, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

const UPDATE_PASSWORD = `/api/users`;
const GET_COINS_BALANCE = `/api/users/balance`;
const REQUEST_TIMEOUT_MS = 8000;
const SHOULD_FORCE_DEFAULT_PASSWORD_CHANGE = process.env.NODE_ENV === 'production';

const LoginPage = () => {
  const isMountedRef = useRef(true);
  const pageLeavingRef = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [status, setStatus] = useState('ON');
  const router = useRouter();
  
  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');

  useEffect(() => {
    isMountedRef.current = true;
    pageLeavingRef.current = false;

    const markPageLeaving = () => {
      pageLeavingRef.current = true;
    };

    window.addEventListener('pagehide', markPageLeaving);
    window.addEventListener('beforeunload', markPageLeaving);
    return () => {
      isMountedRef.current = false;
      pageLeavingRef.current = true;
      window.removeEventListener('pagehide', markPageLeaving);
      window.removeEventListener('beforeunload', markPageLeaving);
    };
  }, []);

  const isTransientRequestFailure = (error) => {
    if (!isMountedRef.current) {
      return true;
    }

    if (error?.name === 'AbortError') {
      return true;
    }

    if (pageLeavingRef.current && error?.message === 'Failed to fetch') {
      return true;
    }

    return false;
  };

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
      if (isTransientRequestFailure(error)) {
        return;
      }
      console.error('Error fetching balance:', error);
      const message = error?.name === 'AbortError'
        ? 'Fetching balance timed out. Please try again.'
        : 'Failed to fetch balance. Please try again.';
      if (isMountedRef.current) {
        setError(message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsFetchingUsers(false);
      }
    }
  }

  const storeUserInfo = (user) => {
    localStorage.setItem("currentUser", JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name || user.firstName
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (SHOULD_FORCE_DEFAULT_PASSWORD_CHANGE && password === 'shenkar') {
      setChangePassword(true);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'כתובת המייל או הסיסמה שגויות');
        setTimeout(() => setError(''), 3000);
      } else {
        getCoinsBalance(data.email);
        storeUserInfo(data);
        router.push('/landing');
      }
    } catch (error) {
      console.error('Error during login:', error);
      setError('שגיאה בהתחברות, נסו שוב');
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

    try {
      const response = await fetch(UPDATE_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          "email": email,
          "currentPassword": password,
          "password": newPassword
        })
      });

      if (response.ok) {
        const loginResponse = await fetch('/api/users/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password: newPassword })
        });
        if (loginResponse.ok) {
          const loggedInUser = await loginResponse.json();
          storeUserInfo(loggedInUser);
        } else {
          storeUserInfo({ email, firstName: email });
        }
        router.push('/landing');
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

  return (
    <div className={styles.loginContainer} dir="rtl">
      <div className={styles.backgroundLayer} aria-hidden="true" />
      {status === "OFF" && (
        <div className={styles.loginCard}>
          <div className={styles.assistantTitle} style={{color: "black"}}>Michael is sleeping now</div>
          <p className={styles.assistantTitle} style={{color: "black"}}>Take a break or check back later!</p>
        </div>
      )}
      {status === "ON" && (
        <>
          <header className={styles.topBar}>
            <div className={styles.brand} aria-label="Michael SQL learning hub">
              <img className={styles.logoImage} src="/bot.png" alt="מייקל" />
              <div className={styles.brandText}>
                <span className={styles.brandTitle}>Michael</span>
                <span className={styles.brandSubtitle}>SQL Learning Lab</span>
              </div>
            </div>
            <div className={styles.shenkarBrand} aria-label="Shenkar">
              <span className={styles.shenkarLogoTile}>
                <img className={styles.shenkarLogo} src="/logo.png" alt="" />
              </span>
              <span className={styles.shenkarText}>Shenkar</span>
            </div>
          </header>

          <main className={styles.shell}>
            <section className={styles.hero}>
              <div className={styles.loginCard}>
                <div className={styles.cardHeader}>
                  <img className={styles.botImage} src="/bot.png" alt="" />
                  <div>
                    <h2 className={styles.title}>התחברות</h2>
                  </div>
                </div>

                {!changePassword ? (
                  <form className={styles.form} onSubmit={handleLogin}>
                    <div className={styles.inputGroup}>
                      <span className={styles.iconWrapper}>
                        <Mail size={18} />
                      </span>
                      <input
                        type="email"
                        className={styles.input}
                        placeholder="כתובת מייל"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>

                    <button type="submit" className={styles.button} disabled={isLoading || isFetchingUsers}>
                      {isLoading || isFetchingUsers ? (
                        <Loader className={styles.loadingSpinner} size={18} />
                      ) : (
                        <>
                          <span>כניסה</span>
                          <ArrowUpLeft aria-hidden="true" size={18} />
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className={styles.textButton}
                    >
                      איפוס סיסמה
                    </button>
                  </form>
                ) : (
                  <>
                    <h2 className={styles.title}>שינוי סיסמה - כניסה ראשונה</h2>
                    <p className={styles.helperText}>
                      זוהי הכניסה הראשונה שלך. אנא הגדר סיסמה חדשה
                    </p>
                    <form className={styles.form} onSubmit={handleChangePassword}>
                      <div className={styles.inputGroup}>
                        <span className={styles.iconWrapper}>
                          <Mail size={18} />
                        </span>
                        <input
                          type="email"
                          className={styles.input}
                          placeholder="כתובת מייל"
                          autoComplete="email"
                          value={email}
                          disabled
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
                          autoComplete="new-password"
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
                        className={`${styles.button} ${styles.secondaryButton}`}
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
            </section>
          </main>
          {isLoading && (
            <div className={styles.loadingOverlay}>
              <Loader className={styles.loadingSpinner} size={48} />
            </div>
          )}
        </>
      )}
      
      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3>איפוס סיסמה</h3>
            <p className={styles.helperText}>
              הזן את כתובת המייל שלך ונשלח לך קישור לאיפוס הסיסמה
            </p>
            
            <form onSubmit={handleForgotPassword}>
              <div className={styles.inputGroup}>
                <span className={styles.iconWrapper}>
                  <Mail size={18} />
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
              
              <div className={styles.modalActions}>
                <button 
                  type="submit" 
                  className={styles.button} 
                  disabled={forgotPasswordLoading}
                >
                  {forgotPasswordLoading ? <Loader className={styles.loadingSpinner} size={18} /> : 'שלח קישור'}
                </button>
                <button 
                  type="button" 
                  className={`${styles.button} ${styles.secondaryButton}`}
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
              <div className={`${styles.feedbackMessage} ${forgotPasswordMessage.includes('שגיאה') ? styles.feedbackError : styles.feedbackSuccess}`}>
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
