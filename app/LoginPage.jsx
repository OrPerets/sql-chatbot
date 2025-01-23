import React, { useState, useEffect } from 'react';
import { User, Lock, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import config from './config';
import styles from './login.module.css';

const SERVER_BASE = config.serverUrl;
const SERVER = `${SERVER_BASE}/allUsers`;
const UPDATE_PASSWORD = `${SERVER_BASE}/updatePassword`;

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchUsers();
  }, []);

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

    if (password === "shenkar") {
      setChangePassword(true);
    } else if (user && password === user.password) {
      storeUserInfo(user);
      router.push('/entities/basic-chat');
    } else {
      setError('Wrong Password or Email');
      setTimeout(() => setError(''), 3000);
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
            router.push('/entities/questionnaire');
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
      {/* <div className={styles.loginCard}>
        <div className={styles.assistantTitle} style={{color: "black"}}>Michael is sleeping now</div>
        <p className={styles.assistantTitle} style={{color: "black"}}>Take a break or check back later!</p>
      </div> */}
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
                onChange={(e) => setEmail(e.target.value)}
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
              {isLoading ? <Loader className={styles.loadingSpinner} size={18} /> : 'אישור'}
            </button>
            {/* Added this for the admin-interface: Button that redirects to the admin page, placed below the main login button */}
            <button 
              type="button" 
              className={styles.adminButton}
              onClick={() => router.push('/admin')}
            >
              כניסת מנהל מערכת
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
  );
};

export default LoginPage;
