"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Settings, BarChart3, Search, Upload, Shield, Clock } from 'lucide-react';
import AdminLayout from './admin/AdminLayout';
import StatsCard from './admin/StatsCard';
import MissingAnswersAudit from './admin/MissingAnswersAudit';
import ErrorBanner from './admin/ErrorBanner';
import SkeletonCard from './admin/SkeletonCard';
import SearchBar from './admin/SearchBar';
import BulkActions from './admin/BulkActions';
import UsersList from './admin/UsersList';
import EnhancedSettingsToggle from './admin/EnhancedSettingsToggle';
import styles from './admin_page.module.css';
import config from '../config';

const SERVER_BASE = config.serverUrl;

const options = {
  'add_balance': 'הוסף מטבעות',
  'reduce_balance': 'הפחת מטבעות',
  'reset_password': 'איפוס סיסמה'
}

const AdminPage: React.FC = () => {
 const [currentUser, setCurrentUser] = useState(null);
 const [error, setError] = useState('');
 const [users, setUsers] = useState([]);
 const [classes, setClasses] = useState([{ id: 0, name: 'כל הכיתות' }]);
 const [isTokenBalanceVisible, setIsTokenBalanceVisible] = useState(true);
 const [isStatuseVisible, setIsStatusVisible] = useState(true);
 const [successMessage, setSuccessMessage] = useState('');
 const [selectedFile, setSelectedFile] = useState<File | null>(null);
 const [isUploading, setIsUploading] = useState(false);
 const [uploadResult, setUploadResult] = useState<any>(null);
 const [activeTab, setActiveTab] = useState('dashboard');
 const [loading, setLoading] = useState(true);
 const [dismissedMessages, setDismissedMessages] = useState<string[]>([]);

 // Fetch initial token visibility state
 useEffect(() => {
   fetch(`${SERVER_BASE}/getCoinsStatus`)
     .then(response => response.json())
     .then(data => setIsTokenBalanceVisible(data["status"] === "ON"))
     .catch(error => console.error('Error fetching token visibility:', error));
 }, []);

 // Fetch users and classes data
 useEffect(() => {
   const fetchData = async () => {
     setLoading(true);
     try {
       // Fetch users
       const usersResponse = await fetch(`${SERVER_BASE}/allUsers`);
       const usersData = await usersResponse.json();

       const coinsData = await fetch(`${SERVER_BASE}/getAllCoins`);
       const coins = await coinsData.json();
       usersData.forEach(user => {
        let temp = coins.filter(item => item.user === user.email)
        if (temp.length > 0) {
          user.coins = temp[0]["coins"]
        } else {
          user.coins = 0;
        }
       });
       setUsers(usersData);

       try {
         // Fetch classes if endpoint exists
         const classesResponse = await fetch(`${SERVER_BASE}/classes`);
         if (classesResponse.ok) {
           const classesData = await classesResponse.json();
           setClasses([{ id: 0, name: 'כל הכיתות' }, ...classesData]);
         }
       } catch (classErr) {
         console.log('Classes endpoint not available yet');
       }
     } catch (err) {
       console.error('Error fetching users:', err);
       setError('Failed to fetch users');
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
      if (data["status"] === 'ON') {
        setIsStatusVisible(true);
      } else {
        setIsStatusVisible(false);
      }
    } catch (error) {
      setError('Failed to fetch status. Please try again.');
    } finally {
      setLoading(false);
    }
   };

   fetchData();
 }, []);

 const [searchTerm, setSearchTerm] = useState('');
 const [selectedClass, setSelectedClass] = useState(0); // 0 represents all classes
 const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
 const [actionType, setActionType] = useState<string>('');
 const [balanceAmount, setBalanceAmount] = useState<string>('');
 const router = useRouter();

 useEffect(() => {
   const storedUser = localStorage.getItem("currentUser");
   if (!storedUser) {
     router.push('/login');
     return;
   }

   const user = JSON.parse(storedUser);
  
   // For now using a placeholder check -needs to check if keeping it in a list version or a db version
   const adminEmails = ["liorbs89@gmail.com", "eyalh747@gmail.com", "orperets11@gmail.com", "roeizer@shenkar.ac.il", "r_admin@gmail.com"];
   const isAdmin = adminEmails.includes(user.email);
  
   if (!isAdmin) {
     setError('אין לך הרשאת גישה לממשק המנהל');
     setTimeout(() => {
       router.push('/login');
     }, 3000);
     return;
   }

   setCurrentUser(user.name);
 }, [router]);

 const updateCoinsStatus = (value) => {
  fetch(`${SERVER_BASE}/setCoinsStatus`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ newStatus: value ? "ON" : "OFF"})
  });
 }

 const handleLogout = () => {
   localStorage.removeItem("currentUser");
   router.push('/');
 };

 const handleUploadExtraTime = async () => {
   if (!selectedFile) return;

   setIsUploading(true);
   setUploadResult(null);

   try {
     const formData = new FormData();
     formData.append('file', selectedFile);

     const response = await fetch('/api/admin/uploadExtraTime', {
       method: 'POST',
       body: formData,
     });

     const result = await response.json();

     if (!response.ok) {
       setUploadResult({
         success: false,
         message: result.error || 'שגיאה בהעלאת הקובץ',
         details: result.details
       });
     } else {
       setUploadResult({
         success: true,
         message: result.message,
         summary: result.summary
       });
       setSelectedFile(null);
     }
   } catch (error) {
     console.error('Error uploading extra time:', error);
     setUploadResult({
       success: false,
       message: 'שגיאה בהעלאת הקובץ'
     });
   } finally {
     setIsUploading(false);
   }
 };

 // Message handlers
 const handleSuccess = (message: string) => {
   setSuccessMessage(message);
   setTimeout(() => setSuccessMessage(''), 5000);
 };

 const handleError = (message: string) => {
   setError(message);
 };

 const dismissError = () => {
   setError('');
 };

 const dismissSuccess = () => {
   setSuccessMessage('');
 };

 const renderDashboard = () => (
   <div className={styles.dashboardSection}>
     {/* Hero Section with System Overview */}
     <div className={styles.heroSection}>
       <div className={styles.heroContent}>
         <div className={styles.heroText}>
           <h1>ברוכים הבאים למערכת הניהול</h1>
           <p>סקירה כללית של המערכת ופעולות מהירות</p>
         </div>
         <div className={styles.heroStats}>
           <div className={styles.heroStat}>
             <div className={styles.heroStatNumber}>{users.length}</div>
             <div className={styles.heroStatLabel}>משתמשים פעילים</div>
           </div>
           <div className={styles.heroStat}>
             <div className={styles.heroStatNumber}>{isStatuseVisible ? 'פעיל' : 'כבוי'}</div>
             <div className={styles.heroStatLabel}>מצב מערכת</div>
           </div>
         </div>
       </div>
     </div>

     {/* KPI Stats Grid */}
     <div className={styles.statsGrid}>
       {loading ? (
         <>
           <SkeletonCard variant="stat" />
         </>
       ) : (
         <>
           <StatsCard
             icon={Users}
             title="משתמשים רשומים"
             value={users.length}
             description='סה"כ משתמשים במערכת'
             trend={{
               value: 12,
               label: "השבוע האחרון",
               direction: "up"
             }}
             onClick={() => setActiveTab('users')}
           />
         </>
       )}
     </div>


     {/* Missing Answers Audit */}
     <MissingAnswersAudit
       onSuccess={handleSuccess}
       onError={handleError}
     />
   </div>
 );

 const renderSystemSettings = () => (
   <div className={styles.settingsSection}>
     <div className={styles.sectionHeader}>
       <h2 className={styles.sectionTitle}>הגדרות מערכת</h2>
       <p className={styles.sectionDescription}>
         ניהול הגדרות מערכת, מטבעות וירטואליים ומצב מייקל
       </p>
     </div>

     <div className={styles.settingsGrid}>
       <EnhancedSettingsToggle
         title="הגדרות מערכת"
         icon={Shield}
         items={[
           {
             id: 'virtual-coins',
             label: 'מטבעות וירטואליים',
             description: 'הצג יתרת מטבעות למשתמשים במערכת',
             helpText: 'כאשר מופעל, משתמשים יכולים לראות את יתרת המטבעות שלהם ולקבל מטבעות עבור פעילויות. כאשר כבוי, המטבעות לא יוצגו בכלל.',
             checked: isTokenBalanceVisible,
             onChange: async (checked) => {
               setIsTokenBalanceVisible(checked);
               updateCoinsStatus(checked);
             }
           },
           {
             id: 'michael-ai',
             label: 'מייקל AI',
             description: 'הפעל או כבה את עוזר הבינה המלאכותית מייקל',
             helpText: 'מייקל הוא עוזר AI שעוזר לתלמידים ללמוד SQL. כאשר מופעל, התלמידים יכולים לשאול שאלות ולקבל עזרה. כאשר כבוי, מייקל לא יהיה זמין.',
             checked: isStatuseVisible,
             onChange: async (checked) => {
               setIsStatusVisible(checked);
               try {
                 await fetch(`${SERVER_BASE}/setStatus`, {
                   method: 'POST',
                   headers: {
                     'Content-Type': 'application/json',
                   },
                   body: JSON.stringify({ newStatus: checked ? "ON" : "OFF"})
                 });
               } catch (error) {
                 console.error('Error updating status:', error);
                 setError('שגיאה בעדכון סטטוס מייקל');
               }
             }
           }
         ]}
       />

       <div className={styles.settingCard}>
         <div className={styles.settingHeader}>
           <Clock size={20} />
           <span>התאמות זמן בחינה</span>
         </div>
         <div className={styles.extraTimeManagement}>
           <div className={styles.uploadInstructions}>
             <h4>הוראות העלאה:</h4>
             <ul>
               <li>הקובץ חייב להכיל עמודות: ID (מספר זהות) ו-PERCENTAGE (אחוז זמן נוסף)</li>
               <li>אחוז הזמן הנוסף חייב להיות בין 0 ל-100</li>
               <li>במקרה של כפילויות, הרשומה האחרונה תתקבל</li>
               <li>תמיכה בקבצי .xlsx ו-.csv</li>
             </ul>
           </div>
           
           <div className={styles.fileUploadSection}>
             <input
               type="file"
               accept=".xlsx,.csv"
               onChange={(e) => {
                 const file = e.target.files?.[0];
                 if (file) {
                   setSelectedFile(file);
                 }
               }}
               className={styles.fileInput}
               id="extraTimeFile"
             />
             <label htmlFor="extraTimeFile" className={styles.fileInputLabel}>
               <Upload size={16} />
               בחר קובץ Excel/CSV
             </label>
             {selectedFile && (
               <div className={styles.fileInfo}>
                 <span>📄 {selectedFile.name}</span>
                 <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
               </div>
             )}
           </div>
           
           <button
             onClick={handleUploadExtraTime}
             disabled={!selectedFile || isUploading}
             className={styles.uploadButton}
           >
             {isUploading ? 'מעלה...' : 'העלה התאמות זמן'}
           </button>
           
           {uploadResult && (
             <div className={`${styles.uploadResult} ${uploadResult.success ? styles.success : styles.error}`}>
               <div className={styles.uploadResultTitle}>
                 {uploadResult.success ? '✅ הצלחה' : '❌ שגיאה'}
               </div>
               <div className={styles.uploadResultMessage}>
                 {uploadResult.message}
               </div>
               {uploadResult.summary && (
                 <div className={styles.uploadSummary}>
                   <div>סה&quot;כ רשומות: {uploadResult.summary.totalRecords}</div>
                   <div>נוספו: {uploadResult.summary.inserted}</div>
                   <div>עודכנו: {uploadResult.summary.updated}</div>
                   <div>שגיאות: {uploadResult.summary.errors}</div>
                 </div>
               )}
             </div>
           )}
         </div>
       </div>
     </div>
   </div>
 );

 const renderUserManagement = () => (
   <div className={styles.userManagementSection}>
     <div className={styles.sectionHeader}>
       <h2 className={styles.sectionTitle}>ניהול משתמשים</h2>
       <p className={styles.sectionDescription}>
         ניהול משתמשים, יתרות מטבעות ופעולות מרובות
       </p>
     </div>

     <div className={styles.controlsContainer}>
       {selectedUsers.length > 0 && (
         <BulkActions
           selectedUsers={selectedUsers}
           onSuccess={() => {
             handleSuccess('הפעולה בוצעה בהצלחה!');
             setSelectedUsers([]);
             // Refresh users data
             fetchUsersData();
           }}
           onError={handleError}
         />
       )}
       
       <SearchBar
         searchTerm={searchTerm}
         onSearchChange={setSearchTerm}
         selectedClass={selectedClass}
         onClassChange={setSelectedClass}
         classes={classes}
       />

       <UsersList
         users={users}
         searchTerm={searchTerm}
         selectedClass={selectedClass}
         selectedUsers={selectedUsers}
         onSelectionChange={setSelectedUsers}
         loading={loading}
       />
     </div>
   </div>
 );

 // Helper function to refresh users data
 const fetchUsersData = async () => {
   try {
     const usersResponse = await fetch(`${SERVER_BASE}/allUsers`);
     const usersData = await usersResponse.json();
     
     const coinsData = await fetch(`${SERVER_BASE}/getAllCoins`);
     const coins = await coinsData.json();
     usersData.forEach(user => {
      let temp = coins.filter(item => item.user === user.email)
      if (temp.length > 0) {
        user.coins = temp[0]["coins"]
      } else {
        user.coins = 0;
      }
     });
     setUsers(usersData);
   } catch (err) {
     console.error('Error fetching users:', err);
     setError('שגיאה בטעינת נתוני משתמשים');
   }
 };

 return error && !dismissedMessages.includes('main-error') ? (
   <div className={styles.adminContainer}>
     <ErrorBanner
       message="שגיאה בגישה למערכת הניהול"
       details={error}
       type="error"
       retryable
       dismissible
       onRetry={() => window.location.reload()}
       onDismiss={() => {
         setDismissedMessages(['main-error']);
         setError('');
       }}
     />
   </div>
 ) : (
   <AdminLayout
     activeTab={activeTab}
     onTabChange={setActiveTab}
     currentUser={currentUser}
     onLogout={handleLogout}
   >
     {/* Success/Error Messages */}
     {successMessage && (
       <ErrorBanner
         message={successMessage}
         type="info"
         dismissible
         onDismiss={dismissSuccess}
       />
     )}
     
     {error && (
       <ErrorBanner
         message="שגיאה במערכת"
         details={error}
         type="error"
         retryable
         dismissible
         onRetry={() => window.location.reload()}
         onDismiss={dismissError}
       />
     )}

     {/* Tab Content */}
     {activeTab === 'dashboard' && renderDashboard()}
     {activeTab === 'settings' && renderSystemSettings()}
     {activeTab === 'users' && renderUserManagement()}
   </AdminLayout>
 );
};
export default AdminPage;
