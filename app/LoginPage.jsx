import React, { useState, useEffect } from "react";
import { User, Lock, Loader, Shield, UserCheck } from "lucide-react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

const ForgotPasswordModal = dynamic(
  () => import("./components/ForgotPasswordModal"),
  {
    ssr: false,
  }
);

const SERVER = `/api/users`;
const UPDATE_PASSWORD = `/api/users`;
const GET_COINS_BALANCE = `/api/users/balance`;

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

  const getCoinsBalance = async (userEmail) => {
    setIsFetchingUsers(true);
    try {
      const response = await fetch(`${GET_COINS_BALANCE}?email=${encodeURIComponent(userEmail)}`, {
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
      setError('Failed to fetch balance. Please try again.');
    } finally {
      setIsFetchingUsers(false);
    }
  }

  const fetchUsers = async () => {
    setIsFetchingUsers(true);
    try {
      const [usersResponse, statusResponse] = await Promise.all([
        fetch(SERVER, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        fetch("/api/admin/status", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ]);

      const usersData = await usersResponse.json();
      setUsers(usersData);

      const statusData = await statusResponse.json();
      // setStatus(statusData["status"]);
      setStatus(statusData?.status ?? "ON");
    } catch (error) {
      console.error("Error fetching users or status:", error);
      setError("Failed to fetch login data. Please try again.");
    } finally {
      setIsFetchingUsers(false);
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
        router.push('/admin');
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
        router.push('/entities/basic-chat');
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
          router.push('/admin');
        } else {
          router.push('/entities/questionnaire');
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
            <Image
              className={styles.botImage}
              src="/bot.png"
              alt="Bot"
              width={160}
              height={160}
              priority
            />
            <div className={styles.assistantName}>
              <Image
                className={styles.logoImage}
                src="/logo.png"
                alt="Logo"
                width={96}
                height={96}
                priority
              />
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
        <ForgotPasswordModal
          email={forgotPasswordEmail}
          onEmailChange={setForgotPasswordEmail}
          onClose={() => {
            setShowForgotPassword(false);
            setForgotPasswordEmail("");
            setForgotPasswordMessage("");
          }}
          onSubmit={handleForgotPassword}
          isLoading={forgotPasswordLoading}
          message={forgotPasswordMessage}
        />
      )}
    </div>
  );
};

export default LoginPage;
