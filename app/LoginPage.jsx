import React, { useState, useEffect } from 'react';
import { User, Lock, Loader, Shield, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import config from './config';
import styles from './login.module.css';

const SERVER_BASE = config.serverUrl;
const SERVER = `${SERVER_BASE}/allUsers`;
const UPDATE_PASSWORD = `${SERVER_BASE}/updatePassword`;
const GET_COINS_BALANCE = `${SERVER_BASE}/coinsBalance`;

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);
  const [status, setStatus] = useState("");
  const [loginMode, setLoginMode] = useState('user'); // 'user' or 'admin'
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  const setEmailandAdmin  = (val) => {
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

  const getCoinsBalance = async (userEmail) => {
    setIsFetchingUsers(true);
    try {
      const response = await fetch(GET_COINS_BALANCE + "/" + userEmail, {
        method: 'GET',
        mode: 'cors',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
      const data = await response.json();
      if (data.length > 0) {
        localStorage.setItem("currentBalance", data[0]["coins"]);
      }
      // setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users. Please try again.');
    } finally {
      setIsFetchingUsers(false);
    }
  }

  const fetchUsers = async () => {
    setIsFetchingUsers(true);
    try {
      const response = await fetch(SERVER, {
        method: 'GET',
        mode: 'cors',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users. Please try again.');
    } finally {
      setIsFetchingUsers(false);
    }
    try {
      const response = await fetch(SERVER_BASE + "/getStatus" , {
        method: 'GET',
        mode: 'cors',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
      const data = await response.json();
      setStatus(data["status"])
      // setStatus("ON")
      // setUsers(data);
    } catch (error) {
      setError('Failed to fetch status. Please try again.');
    }
  };

  const storeUserInfo = (user) => {
    // {key:value, key:value}
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
    const adminEmails = ["liorbs89@gmail.com", "eyalh747@gmail.com", "orperets11@gmail.com", "roeizer@shenkar.ac.il", "r_admin@gmail.com"];
    
    // When Michael is OFF, only allow admin login
    if (status === "OFF") {
      if (!adminEmails.includes(email)) {
        setError('המערכת כרגע כבויה - רק מנהלים יכולים להתחבר');
        setTimeout(() => setError(''), 3000);
        setIsLoading(false);
        return;
      }
      
      // For admin login when system is off
      if (user && password === user.password) {
        storeUserInfo(user);
        router.push('/admin');
      } else if (password === "shenkar") {
        setChangePassword(true);
      } else {
        setError('סיסמת מנהל שגויה');
        setTimeout(() => setError(''), 3000);
      }
      setIsLoading(false);
      return;
    }
    
    // Check if this is admin login mode (when system is ON)
    if (loginMode === 'admin') {
      if (!adminEmails.includes(email)) {
        setError('אין לך הרשאת מנהל');
        setTimeout(() => setError(''), 3000);
        setIsLoading(false);
        return;
      }

      // For admin login, check password and redirect to admin
      if (user && password === user.password) {
        storeUserInfo(user);
        router.push('/admin');
      } else if (password === "shenkar") {
        setChangePassword(true);
      } else {
        setError('סיסמת מנהל שגויה');
        setTimeout(() => setError(''), 3000);
      }
    } else {
      // Regular user login flow
      if (user && password === user.password) {
        getCoinsBalance(user.email);
        storeUserInfo(user);
        router.push('/entities/basic-chat');
      } else if (password === "shenkar") {
        setChangePassword(true);
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

    if (newPassword && newPassword !== "shenkar") {
      const user = users.find(item => item.email === email);
      if (user) {
        try {
          const response = await fetch(UPDATE_PASSWORD, {
            method: 'POST',
            mode: 'cors',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
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
              router.push('/admin');
            } else {
              router.push('/entities/questionnaire');
            }
          } else {
            setError('Failed to update password');
          }
        } catch (error) {
          console.error('Error updating password:', error);
          setError('Failed to update password');
        }
      }
    } else {
      setError('Invalid new password');
      setTimeout(() => setError(''), 3000);
    }

    setIsLoading(false);
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
        <div>
          <div className={styles.logoWrapper}>
            <div className={styles.avatarContainer}>
              <div className={styles.animatedAvatarWrapper}>
                <img className={styles.botImage} src="bot.png" alt="Bot" />
                <div className={styles.breathingEffect}></div>
                <div className={styles.welcomeGlow}></div>
              </div>
            </div>
            <div className={styles.assistantName}>
              <img className={styles.logoImage} src="logo.png" alt="Logo" />
              <h2 className={styles.assistantTitle}>MICHAEL</h2>
              <p className={styles.assistantSubtitle}>SQL AI Assistant</p>
              <p className={styles.welcomeMessage} style={{color: "orange"}}>Currently sleeping... 😴</p>
            </div>
          </div>
          
          <div className={styles.loginCard}>
            <div className={styles.assistantTitle} style={{color: "black", marginBottom: "20px"}}>Michael is sleeping now</div>
            <p className={styles.assistantSubtitle} style={{color: "black", marginBottom: "30px"}}>Take a break or check back later!</p>
            
            {/* Admin login section */}
            <div style={{borderTop: "1px solid #eee", paddingTop: "20px"}}>
              <h3 style={{color: "#666", fontSize: "14px", marginBottom: "15px"}}>Admin Access</h3>
              
              {!changePassword ? (
                <form className={styles.form} onSubmit={handleLogin}>
                  <div className={styles.inputGroup}>
                    <span className={styles.iconWrapper}>
                      <User size={18} />
                    </span>
                    <input 
                      type="email" 
                      className={styles.input}
                      placeholder="כתובת מייל מנהל" 
                      value={email}
                      onChange={(e) => setEmailandAdmin(e.target.value)}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <span className={styles.iconWrapper}>
                      <Lock size={18} />
                    </span>
                    <input 
                      type="password" 
                      className={styles.input}
                      placeholder="סיסמת מנהל"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <button type="submit" className={styles.button} disabled={isLoading}>
                    {isLoading ? <Loader className={styles.loadingSpinner} size={18} /> : 'כניסה כמנהל'}
                  </button>
                </form>
              ) : (
                <form className={styles.form} onSubmit={handleChangePassword}>
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
                    />
                  </div>
                  <button type="submit" className={styles.button} disabled={isLoading}>
                    {isLoading ? <Loader className={styles.loadingSpinner} size={18} /> : 'שנה סיסמה'}
                  </button>
                </form>
              )}
              {error && <div className={styles.errorMessage}>{error}</div>}
            </div>
          </div>
          
          {isLoading && (
            <div className={styles.loadingOverlay}>
              <Loader className={styles.loadingSpinner} size={48} />
            </div>
          )}
        </div>
      )}
      {status === "ON" && (
        <div>
        <div className={styles.logoWrapper}>
        <div className={styles.avatarContainer}>
          <div className={styles.animatedAvatarWrapper}>
            <img className={styles.botImage} src="bot.png" alt="Bot" />
            <div className={styles.breathingEffect}></div>
            <div className={styles.welcomeGlow}></div>
          </div>
        </div>
        <div className={styles.assistantName}>
          <img className={styles.logoImage} src="logo.png" alt="Logo" />
          <h2 className={styles.assistantTitle}>MICHAEL</h2>
          <p className={styles.assistantSubtitle}>SQL AI Assistant</p>
          <p className={styles.welcomeMessage}>Ready to help you master SQL!</p>
        </div>
      </div>
      <div className={styles.loginCard}>
        <h2 className={styles.title}>התחברות</h2>
        
        {/* Login Mode Selection */}
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
              />
            </div>
            <button type="submit" className={styles.button} disabled={isLoading}>
              {isLoading ? <Loader className={styles.loadingSpinner} size={18} /> : 
                loginMode === 'admin' ? 'כניסה כמנהל' : 'אישור'}
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleChangePassword}>
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
              />
            </div>
            <button type="submit" className={styles.button} disabled={isLoading}>
              {isLoading ? <Loader className={styles.loadingSpinner} size={18} /> : 'שנה סיסמה'}
            </button>
          </form>
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

    </div>
  );
};
export default LoginPage;